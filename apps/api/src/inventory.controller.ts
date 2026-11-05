import { Body, ConflictException, Controller, Get, Inject, NotFoundException, Param, Patch, Post, Put, Query, Req, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Pool, PoolClient } from 'pg';
import { Request } from 'express';
import { DB_POOL } from './db/db.module';
import { logActivity } from './db/activity';
import { AccessGuard, Roles } from './auth/access.guard';
import { AuthService, sessionToken } from './auth/auth.service';

const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const quantity = (v: unknown): string | null => {
  const s = typeof v === 'number' ? String(v) : v;
  if (typeof s !== 'string' || !/^-?\d{1,9}(?:\.\d{1,3})?$/.test(s)) return null;
  return s;
};
const positiveMoney = (v: unknown): string | null => {
  const s = typeof v === 'number' ? String(v) : v;
  return typeof s === 'string' && /^\d{1,18}$/.test(s) && BigInt(s) <= 9223372036854775807n ? s : null;
};
const validName = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v.trim().length <= 120;
const validUnit = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v.trim().length <= 20;
const reorderStatuses = ['requested', 'received', 'cancelled'];
const reorderColumns = `r.id, r.branch_id as "branchId", r.item_id as "itemId", i.name as "itemName", i.unit, r.quantity::text, r.status, r.note,
  r.requested_by as "requestedBy", r.created_at as "createdAt", r.resolved_by as "resolvedBy", r.resolved_at as "resolvedAt", sm.id as "movementId"`;
const validNote = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.length <= 1000);

@ApiTags('inventory')
@Controller()
@UseGuards(AccessGuard)
export class InventoryController {
  constructor(@Inject(DB_POOL) private readonly pool: Pool, private readonly auth: AuthService) {}

  @Get('inventory-items') @Roles('owner')
  async items() {
    return (await this.pool.query('select id, name, unit, unit_cost::text as "unitCost", active from inventory_items order by name')).rows;
  }

  @Post('inventory-items') @Roles('owner')
  async createItem(@Body() body: Record<string, unknown>, @Req() req: Request) {
    const cost = positiveMoney(body?.unitCost);
    if (!validName(body?.name) || !validUnit(body?.unit) || cost === null) throw new UnprocessableEntityException('name, unit and non-negative unitCost in centavos are required');
    const actor = await this.auth.current(sessionToken(req));
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await client.query(`insert into inventory_items (name, unit, unit_cost) values ($1,$2,$3) returning id, name, unit, unit_cost::text as "unitCost", active`, [body.name.trim(), body.unit.trim(), cost]);
      const item = result.rows[0];
      await logActivity(client, { branchId: null, actorId: actor.user.id, action: 'inventory_item.created', payload: { itemId: item.id, after: item } });
      await client.query('commit');
      return item;
    } catch (error) { await client.query('rollback'); if ((error as { code?: string }).code === '23505') throw new UnprocessableEntityException('An inventory item with this name already exists'); throw error; }
    finally { client.release(); }
  }

  @Patch('inventory-items/:itemId') @Roles('owner')
  async updateItem(@Param('itemId') itemId: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    const keys = Object.keys(body ?? {}), cost = body?.unitCost === undefined ? undefined : positiveMoney(body.unitCost);
    if (!uuid(itemId) || !keys.length || keys.some(k => !['name', 'unit', 'unitCost', 'active'].includes(k)) || ('name' in body && !validName(body.name)) || ('unit' in body && !validUnit(body.unit)) || ('unitCost' in body && cost === null) || ('active' in body && body.active !== false)) throw new UnprocessableEntityException('Set name, unit, unitCost, or active: false');
    const actor = await this.auth.current(sessionToken(req));
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const current = await client.query('select id, name, unit, unit_cost::text as "unitCost", active from inventory_items where id=$1 for update', [itemId]);
      if (!current.rowCount) throw new NotFoundException();
      const before = current.rows[0];
      const updated = await client.query(`update inventory_items set name=$1, unit=$2, unit_cost=$3, active=$4 where id=$5 returning id, name, unit, unit_cost::text as "unitCost", active`, [body.name === undefined ? before.name : (body.name as string).trim(), body.unit === undefined ? before.unit : (body.unit as string).trim(), cost ?? before.unitCost, body.active === false ? false : before.active, itemId]);
      await logActivity(client, { branchId: null, actorId: actor.user.id, action: body.active === false ? 'inventory_item.archived' : 'inventory_item.updated', payload: { itemId, before, after: updated.rows[0] } });
      await client.query('commit');
      return updated.rows[0];
    } catch (error) { await client.query('rollback'); if ((error as { code?: string }).code === '23505') throw new UnprocessableEntityException('An inventory item with this name already exists'); throw error; }
    finally { client.release(); }
  }

  @Get('branches/:branchId/inventory') @Roles('owner', 'manager')
  async branchInventory(@Param('branchId') branchId: string, @Query('low') low?: string) {
    if (low !== undefined && !['true', 'false'].includes(low)) throw new UnprocessableEntityException('low must be true or false');
    const result = await this.pool.query(`select i.id as "itemId", i.name, i.unit, i.unit_cost::text as "unitCost", bi.par::text,
      coalesce(sum(sm.qty_delta),0)::text as "onHand", (bi.par is not null and coalesce(sum(sm.qty_delta),0) < bi.par) as "lowStock",
      coalesce(sum(sm.qty_delta),0) < 0 as "negativeStock",
      round(coalesce(sum(sm.qty_delta),0) * i.unit_cost)::text as value
      from inventory_items i left join branch_inventory bi on bi.item_id=i.id and bi.branch_id=$1
      left join stock_movements sm on sm.item_id=i.id and sm.branch_id=$1 where i.active
      group by i.id, bi.par order by i.name`, [branchId]);
    return low === 'true' ? result.rows.filter(item => item.lowStock || item.negativeStock) : result.rows;
  }

  @Put('branches/:branchId/inventory/:itemId') @Roles('owner', 'manager')
  async setPar(@Param('branchId') branchId: string, @Param('itemId') itemId: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    const par = body?.par === 0 ? '0' : quantity(body?.par);
    if (!uuid(branchId) || !uuid(itemId) || par === null || Number(par) < 0) throw new UnprocessableEntityException('par must be a non-negative quantity with up to three decimals');
    const actor = await this.auth.current(sessionToken(req));
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const before = await client.query('select par::text from branch_inventory where branch_id=$1 and item_id=$2 for update', [branchId, itemId]);
      const result = await client.query(`insert into branch_inventory (branch_id,item_id,par) select $1,id,$3 from inventory_items where id=$2 and active
        on conflict (branch_id,item_id) do update set par=excluded.par returning par::text`, [branchId, itemId, par ?? '0']);
      if (!result.rowCount) throw new NotFoundException('Active inventory item not found');
      const after = result.rows[0].par;
      await logActivity(client, { branchId, actorId: actor.user.id, action: 'inventory.par_set', payload: { itemId, par: { before: before.rows[0]?.par ?? null, after } } });
      await client.query('commit');
      return { branchId, itemId, par: after };
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }

  @Get('branches/:branchId/stock-movements') @Roles('owner', 'manager')
  async movements(@Param('branchId') branchId: string, @Query('itemId') itemId?: string) {
    if (!uuid(branchId) || (itemId && !uuid(itemId))) throw new UnprocessableEntityException('Invalid branch or item');
    return (await this.pool.query(`select sm.id, sm.branch_id as "branchId", sm.item_id as "itemId", i.name as "itemName", sm.type, sm.qty_delta::text as "qtyDelta", sm.note, sm.created_by as "createdBy", sm.reorder_request_id as "reorderRequestId", sm.created_at as "createdAt"
      from stock_movements sm join inventory_items i on i.id=sm.item_id where sm.branch_id=$1 and ($2::uuid is null or sm.item_id=$2) order by sm.created_at desc, sm.id`, [branchId, itemId ?? null])).rows;
  }

  @Post('branches/:branchId/stock-movements') @Roles('owner', 'manager')
  async move(@Param('branchId') branchId: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    const qty = quantity(body?.quantity), types = ['received', 'wastage', 'adjustment', 'count'];
    if (!uuid(branchId) || !uuid(body?.itemId) || !types.includes(body?.type as string) || qty === null || (body?.type !== 'count' && Number(qty) === 0) || !validNote(body?.note)) throw new UnprocessableEntityException('itemId, movement type, quantity and optional note are required');
    if ((body.type === 'received' && Number(qty) < 0) || (body.type === 'wastage' && Number(qty) < 0) || (body.type === 'count' && Number(qty) < 0)) throw new UnprocessableEntityException('quantity must be positive; adjustments may be negative');
    const actor = await this.auth.current(sessionToken(req));
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(hashtext($1),hashtext($2))', [branchId, body.itemId]);
      const item = await client.query('select id from inventory_items where id=$1 and active', [body.itemId]);
      if (!item.rowCount) throw new NotFoundException('Active inventory item not found');
      let delta = qty;
      if (body.type === 'wastage') delta = `-${qty}`;
      if (body.type === 'count') {
        const current = await client.query('select ($3::numeric - coalesce(sum(qty_delta),0))::text as delta from stock_movements where branch_id=$1 and item_id=$2', [branchId, body.itemId, qty]);
        delta = current.rows[0].delta;
      }
      const result = await client.query(`insert into stock_movements (branch_id,item_id,type,qty_delta,note,created_by) values ($1,$2,$3,$4,$5,$6)
        returning id, branch_id as "branchId", item_id as "itemId", type, qty_delta::text as "qtyDelta", note, created_by as "createdBy", created_at as "createdAt"`, [branchId, body.itemId, body.type, delta, body.note ?? null, actor.user.id]);
      await logActivity(client, { branchId, actorId: actor.user.id, action: 'stock.moved', payload: { movement: result.rows[0] } });
      await client.query('commit');
      return result.rows[0];
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }

  @Get('branches/:branchId/reorder-requests') @Roles('owner', 'manager')
  async reorderRequests(@Param('branchId') branchId: string, @Query('status') status?: string) {
    if (!uuid(branchId) || (status !== undefined && !reorderStatuses.includes(status))) throw new UnprocessableEntityException('Invalid branch or status');
    return (await this.pool.query(`select ${reorderColumns} from reorder_requests r join inventory_items i on i.id=r.item_id left join stock_movements sm on sm.reorder_request_id=r.id
      where r.branch_id=$1 and ($2::text is null or r.status=$2) order by r.created_at desc, r.id`, [branchId, status ?? null])).rows;
  }

  @Post('branches/:branchId/reorder-requests') @Roles('owner', 'manager')
  async requestReorder(@Param('branchId') branchId: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    const qty = quantity(body?.quantity);
    if (!uuid(branchId) || !uuid(body?.itemId) || qty === null || Number(qty) <= 0 || !validNote(body?.note)) throw new UnprocessableEntityException('itemId, positive quantity and optional note are required');
    const actor = await this.auth.current(sessionToken(req));
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const created = await client.query(`insert into reorder_requests (branch_id,item_id,quantity,note,requested_by) select $1,id,$3,$4,$5 from inventory_items where id=$2 and active returning id`,
        [branchId, body.itemId, qty, body.note ?? null, actor.user.id]);
      if (!created.rowCount) throw new NotFoundException('Active inventory item not found');
      const request = await this.reorderById(client, branchId, created.rows[0].id);
      await logActivity(client, { branchId, actorId: actor.user.id, action: 'reorder.requested', payload: { request } });
      await client.query('commit');
      return request;
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }

  @Post('branches/:branchId/reorder-requests/:requestId/receive') @Roles('owner', 'manager')
  receiveReorder(@Param('branchId') branchId: string, @Param('requestId') requestId: string, @Req() req: Request) {
    return this.resolveReorder(branchId, requestId, 'received', req);
  }

  @Post('branches/:branchId/reorder-requests/:requestId/cancel') @Roles('owner', 'manager')
  cancelReorder(@Param('branchId') branchId: string, @Param('requestId') requestId: string, @Req() req: Request) {
    return this.resolveReorder(branchId, requestId, 'cancelled', req);
  }

  private async resolveReorder(branchId: string, requestId: string, status: 'received' | 'cancelled', req: Request) {
    if (!uuid(branchId) || !uuid(requestId)) throw new UnprocessableEntityException('Invalid branch or reorder request');
    const actor = await this.auth.current(sessionToken(req));
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const current = await client.query('select item_id, quantity::text, status from reorder_requests where id=$1 and branch_id=$2 for update', [requestId, branchId]);
      if (!current.rowCount) throw new NotFoundException('Reorder request not found');
      if (current.rows[0].status !== 'requested') throw new ConflictException(`Reorder request is already ${current.rows[0].status}`);
      await client.query(`update reorder_requests set status=$1, resolved_by=$2, resolved_at=now() where id=$3`, [status, actor.user.id, requestId]);
      if (status === 'received') {
        await client.query('select pg_advisory_xact_lock(hashtext($1),hashtext($2))', [branchId, current.rows[0].item_id]);
        await client.query(`insert into stock_movements (branch_id,item_id,type,qty_delta,note,created_by,reorder_request_id) values ($1,$2,'received',$3,'Reorder received',$4,$5)`,
          [branchId, current.rows[0].item_id, current.rows[0].quantity, actor.user.id, requestId]);
      }
      const request = await this.reorderById(client, branchId, requestId);
      await logActivity(client, { branchId, actorId: actor.user.id, action: `reorder.${status}`, payload: { request } });
      await client.query('commit');
      return request;
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }

  private async reorderById(client: PoolClient, branchId: string, requestId: string) {
    return (await client.query(`select ${reorderColumns} from reorder_requests r join inventory_items i on i.id=r.item_id left join stock_movements sm on sm.reorder_request_id=r.id
      where r.id=$1 and r.branch_id=$2`, [requestId, branchId])).rows[0];
  }
}
