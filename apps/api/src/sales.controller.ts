import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Post, Query, Req, Res, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Pool } from 'pg';
import { Request, Response } from 'express';
import { DB_POOL } from './db/db.module';
import { AccessGuard } from './auth/access.guard';
import { AuthService, sessionToken } from './auth/auth.service';
import { CLOCK, Clock } from './clock';

const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const paymentMethods = ['cash', 'gcash', 'maya', 'card'];

function businessDate(now: Date, cutoff: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const day = `${values.year}-${values.month}-${values.day}`;
  return `${values.hour}:${values.minute}:00` < cutoff.slice(0, 5) + ':00'
    ? new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10) : day;
}

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
      const productIds = body.lines.map((line: any) => line.productId);
      const products = await client.query('select id, name, price::text, unit_cost::text, active from products where id = any($1::uuid[])', [productIds]);
      if (products.rowCount !== productIds.length) throw new NotFoundException('Product not found');
      if (products.rows.some(product => !product.active)) throw new UnprocessableEntityException('Archived products cannot be sold');
      const byId = new Map(products.rows.map(product => [product.id, product]));
      const saleLines = body.lines.map((line: any) => ({ ...byId.get(line.productId), productId: line.productId, qty: line.qty }));
      const total = saleLines.reduce((sum: bigint, line: any) => sum + BigInt(line.price) * BigInt(line.qty), 0n);
      if (total > 9223372036854775807n) throw new UnprocessableEntityException('Sale total is too large');
      const date = businessDate(this.clock.now(), branch.rows[0].day_cutoff);
      const allocated = await client.query('update branches set next_sale_no = next_sale_no + 1 where id = $1 returning next_sale_no - 1 as sale_no', [branchId]);
      const sale = await client.query(`insert into sales (id, branch_id, sale_no, business_date, payment_method, total, cashier_id)
        values ($1, $2, $3, $4, $5, $6, $7) returning id, branch_id, sale_no, business_date::text, payment_method, total::text`, [body.id, branchId, allocated.rows[0].sale_no, date, body.paymentMethod, total.toString(), actor.user.id]);
      for (const line of saleLines) await client.query(`insert into sale_lines (sale_id, product_id, product_name, unit_price, unit_cost, qty)
        values ($1, $2, $3, $4, $5, $6)`, [body.id, line.productId, line.name, line.price, line.unit_cost, line.qty]);
      await client.query('commit');
      const row = sale.rows[0];
      return { id: row.id, branchId: row.branch_id, saleNo: row.sale_no, businessDate: row.business_date, paymentMethod: row.payment_method, total: row.total,
        lines: saleLines.map((line: any) => ({ productId: line.productId, productName: line.name, unitPrice: line.price, unitCost: line.unit_cost, qty: line.qty })) };
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }

  @Get()
  async list(@Param('branchId') branchId: string, @Query('from') from: string, @Query('to') to: string) {
    if (!uuid(branchId) || !date(from) || !date(to) || from > to) throw new UnprocessableEntityException('from and to must be business dates, with from <= to');
    const result = await this.pool.query(`select id, branch_id as "branchId", sale_no as "saleNo", business_date::text as "businessDate", payment_method as "paymentMethod", total::text, created_at as "createdAt"
      from sales where branch_id = $1 and business_date between $2 and $3 order by business_date desc, sale_no desc`, [branchId, from, to]);
    return result.rows;
  }
}
