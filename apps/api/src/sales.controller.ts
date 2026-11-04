import { Body, ConflictException, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, Post, Query, Req, Res, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Pool } from 'pg';
import { Request, Response } from 'express';
import { DB_POOL } from './db/db.module';
import { AccessGuard, Roles } from './auth/access.guard';
import { AuthService, sessionToken } from './auth/auth.service';
import { CLOCK, Clock } from './clock';
import { logActivity } from './db/activity';
import { businessDate, date, uuid } from './business-date';
const paymentMethods = ['cash', 'gcash', 'maya', 'card'];

@ApiTags('sales')
@Controller('branches/:branchId/sales')
@UseGuards(AccessGuard)
export class SalesController {
  constructor(@Inject(DB_POOL) private readonly pool: Pool, private readonly auth: AuthService, @Inject(CLOCK) private readonly clock: Clock) {}

  @Post()
  async record(@Param('branchId') branchId: string, @Body() body: Record<string, unknown>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!uuid(branchId) || !uuid(body?.id) || !paymentMethods.includes(body?.paymentMethod as string) || !Array.isArray(body?.lines) || !body.lines.length || body.lines.length > 100 || body.lines.some((line: any) => !uuid(line?.productId) || !Number.isSafeInteger(line?.qty) || line.qty < 1 || line.qty > 2147483647) || new Set(body.lines.map((line: any) => line.productId)).size !== body.lines.length) {
      throw new UnprocessableEntityException('id, paymentMethod and unique productId/positive qty lines are required');
    }
    const actor = await this.auth.current(sessionToken(req));
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const branch = await client.query('select id, day_cutoff from branches where id = $1 for update', [branchId]);
      if (!branch.rowCount) throw new NotFoundException();
      const existing = await client.query('select id, branch_id, sale_no, business_date::text, payment_method, total::text from sales where id = $1', [body.id]);
      if (existing.rowCount) {
        if (existing.rows[0].branch_id !== branchId) throw new NotFoundException();
        const lines = await client.query('select product_id as "productId", product_name as "productName", unit_price::text as "unitPrice", unit_cost::text as "unitCost", qty from sale_lines where sale_id = $1 order by id', [body.id]);
        await client.query('commit');
        res.status(200);
        const row = existing.rows[0];
        return { id: row.id, branchId: row.branch_id, saleNo: row.sale_no, businessDate: row.business_date, paymentMethod: row.payment_method, total: row.total, lines: lines.rows };
      }
      const saleDate = businessDate(this.clock.now(), branch.rows[0].day_cutoff);
      const closed = await client.query('select 1 from cash_closes where branch_id = $1 and business_date = $2', [branchId, saleDate]);
      if (closed.rowCount) throw new ConflictException('This business day is already closed');
      const productIds = body.lines.map((line: any) => line.productId);
      const products = await client.query('select id, name, price::text, unit_cost::text, active from products where id = any($1::uuid[])', [productIds]);
      if (products.rowCount !== productIds.length) throw new NotFoundException('Product not found');
      if (products.rows.some(product => !product.active)) throw new UnprocessableEntityException('Archived products cannot be sold');
      const byId = new Map(products.rows.map(product => [product.id, product]));
      const saleLines = body.lines.map((line: any) => ({ ...byId.get(line.productId), productId: line.productId, qty: line.qty }));
      const total = saleLines.reduce((sum: bigint, line: any) => sum + BigInt(line.price) * BigInt(line.qty), 0n);
      if (total > 9223372036854775807n) throw new UnprocessableEntityException('Sale total is too large');
      const allocated = await client.query('update branches set next_sale_no = next_sale_no + 1 where id = $1 returning next_sale_no - 1 as sale_no', [branchId]);
      const sale = await client.query(`insert into sales (id, branch_id, sale_no, business_date, payment_method, total, cashier_id)
        values ($1, $2, $3, $4, $5, $6, $7) returning id, branch_id, sale_no, business_date::text, payment_method, total::text`, [body.id, branchId, allocated.rows[0].sale_no, saleDate, body.paymentMethod, total.toString(), actor.user.id]);
      for (const line of saleLines) await client.query(`insert into sale_lines (sale_id, product_id, product_name, unit_price, unit_cost, qty)
        values ($1, $2, $3, $4, $5, $6)`, [body.id, line.productId, line.name, line.price, line.unit_cost, line.qty]);
      await client.query('commit');
      const row = sale.rows[0];
      return { id: row.id, branchId: row.branch_id, saleNo: row.sale_no, businessDate: row.business_date, paymentMethod: row.payment_method, total: row.total,
        lines: saleLines.map((line: any) => ({ productId: line.productId, productName: line.name, unitPrice: line.price, unitCost: line.unit_cost, qty: line.qty })) };
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }

  @Post(':saleId/void')
  async void(@Param('branchId') branchId: string, @Param('saleId') saleId: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    if (!uuid(branchId) || !uuid(saleId) || typeof body?.reason !== 'string' || !body.reason.trim() || body.reason.trim().length > 1000) {
      throw new UnprocessableEntityException('A reason of 1 to 1000 characters is required');
    }
    const actor = await this.auth.current(sessionToken(req));
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const branch = await client.query('select day_cutoff from branches where id = $1 for update', [branchId]);
      if (!branch.rowCount) throw new NotFoundException();
      const result = await client.query(`select id, branch_id, sale_no, business_date::text, voided_at, voided_by, void_reason
        from sales where id = $1 and branch_id = $2 for update`, [saleId, branchId]);
      if (!result.rowCount) throw new NotFoundException('Sale not found');
      const sale = result.rows[0];
      if (sale.voided_at) throw new ConflictException('Sale is already voided');
      const closed = await client.query('select 1 from cash_closes where branch_id = $1 and business_date = $2', [branchId, sale.business_date]);
      if (closed.rowCount) throw new ConflictException('This business day is already closed');
      if (actor.user.role === 'cashier' && sale.business_date !== businessDate(this.clock.now(), branch.rows[0].day_cutoff)) {
        throw new ForbiddenException('Cashiers can only void sales from the current business day');
      }
      const voidedAt = this.clock.now();
      const updated = await client.query(`update sales set voided_at = $3, voided_by = $4, void_reason = $5
        where id = $1 and branch_id = $2 returning id, branch_id as "branchId", sale_no as "saleNo", business_date::text as "businessDate", voided_at as "voidedAt", voided_by as "voidedBy", void_reason as "voidReason"`,
      [saleId, branchId, voidedAt, actor.user.id, body.reason.trim()]);
      await logActivity(client, { branchId, actorId: actor.user.id, action: 'sale.voided', payload: { saleId, saleNo: sale.sale_no, reason: body.reason.trim() } });
      await client.query('commit');
      return updated.rows[0];
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }

  @Get()
  @Roles('owner', 'manager')
  async list(@Param('branchId') branchId: string, @Query('from') from: string, @Query('to') to: string) {
    if (!uuid(branchId) || !date(from) || !date(to) || from > to) throw new UnprocessableEntityException('from and to must be business dates, with from <= to');
    const result = await this.pool.query(`select id, branch_id as "branchId", sale_no as "saleNo", business_date::text as "businessDate", payment_method as "paymentMethod", total::text, created_at as "createdAt", voided_at as "voidedAt", voided_by as "voidedBy", void_reason as "voidReason"
      from sales where branch_id = $1 and business_date between $2 and $3 order by business_date desc, sale_no desc`, [branchId, from, to]);
    return result.rows;
  }
}
