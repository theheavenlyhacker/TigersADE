import { Body, ConflictException, Controller, Get, Inject, NotFoundException, Param, Post, Query, Req, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Pool } from 'pg';
import { Request } from 'express';
import { DB_POOL } from './db/db.module';
import { AccessGuard, Roles } from './auth/access.guard';
import { AuthService, sessionToken } from './auth/auth.service';
import { logActivity } from './db/activity';
import { CLOCK, Clock } from './clock';

const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const date = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const parsed = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === v;
};
const money = (v: unknown): v is string => typeof v === 'string' && /^\d{1,18}$/.test(v) && BigInt(v) <= 9223372036854775807n;

function businessDate(now: Date, cutoff: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const day = `${values.year}-${values.month}-${values.day}`;
  return `${values.hour}:${values.minute}:00` < cutoff.slice(0, 5) + ':00' ? new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10) : day;
}

@ApiTags('cash closes')
@Controller('branches/:branchId/cash-closes')
@UseGuards(AccessGuard)
@Roles('manager')
export class CashClosesController {
  constructor(@Inject(DB_POOL) private readonly pool: Pool, private readonly auth: AuthService, @Inject(CLOCK) private readonly clock: Clock) {}

  @Get('preview')
  async preview(@Param('branchId') branchId: string, @Query('businessDate') requestedDate: string) {
    if (!uuid(branchId) || (requestedDate !== undefined && !date(requestedDate))) throw new UnprocessableEntityException('businessDate must be a business date');
    const branch = await this.pool.query('select day_cutoff from branches where id = $1', [branchId]);
    if (!branch.rowCount) throw new NotFoundException();
    const businessDate = requestedDate ?? this.currentBusinessDate(branch.rows[0].day_cutoff);
    const [sales, close] = await Promise.all([
      this.pool.query(`select coalesce(sum(total), 0)::text as "cashSales" from sales where branch_id = $1 and business_date = $2 and payment_method = 'cash' and voided_at is null`, [branchId, businessDate]),
      this.pool.query(`select id, opening_float as "openingFloat", cash_sales as "cashSales", expected_cash as "expectedCash", counted_cash as "countedCash", variance, note from cash_closes where branch_id = $1 and business_date = $2`, [branchId, businessDate]),
    ]);
    return { businessDate, cashSales: sales.rows[0].cashSales, close: close.rows[0] ?? null };
  }

  @Post()
  async submit(@Param('branchId') branchId: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    if (!uuid(branchId) || !date(body?.businessDate) || !money(body?.openingFloat) || !money(body?.countedCash) || (body?.note !== undefined && (typeof body.note !== 'string' || body.note.length > 1000))) {
      throw new UnprocessableEntityException('businessDate, non-negative openingFloat and countedCash, and optional note are required');
    }
    const actor = await this.auth.current(sessionToken(req));
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const branch = await client.query('select id from branches where id = $1 for update', [branchId]);
      if (!branch.rowCount) throw new NotFoundException();
      const sales = await client.query(`select coalesce(sum(total), 0)::text as cash_sales from sales where branch_id = $1 and business_date = $2 and payment_method = 'cash' and voided_at is null`, [branchId, body.businessDate]);
      const opening = BigInt(body.openingFloat);
      const cashSales = BigInt(sales.rows[0].cash_sales);
      const expected = opening + cashSales;
      const counted = BigInt(body.countedCash);
      if (expected > 9223372036854775807n) throw new UnprocessableEntityException('Expected cash is too large');
      const inserted = await client.query(`insert into cash_closes (branch_id, business_date, opening_float, cash_sales, expected_cash, counted_cash, variance, note, submitted_by)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        returning id, branch_id as "branchId", business_date::text as "businessDate", opening_float::text as "openingFloat", cash_sales::text as "cashSales", expected_cash::text as "expectedCash", counted_cash::text as "countedCash", variance::text, note`,
      [branchId, body.businessDate, opening.toString(), cashSales.toString(), expected.toString(), counted.toString(), (counted - expected).toString(), body.note ?? null, actor.user.id]);
      await logActivity(client, { branchId, actorId: actor.user.id, action: 'cash_close.submitted', payload: { ...inserted.rows[0] } });
      await client.query('commit');
      return inserted.rows[0];
    } catch (error) {
      await client.query('rollback');
      if ((error as { code?: string })?.code === '23505') throw new ConflictException('A cash close already exists for this business day');
      throw error;
    } finally { client.release(); }
  }

  @Get()
  async list(@Param('branchId') branchId: string) {
    if (!uuid(branchId)) throw new UnprocessableEntityException('Invalid branch');
    const result = await this.pool.query(`select id, business_date::text as "businessDate", opening_float::text as "openingFloat", cash_sales::text as "cashSales", expected_cash::text as "expectedCash", counted_cash::text as "countedCash", variance::text, note, submitted_by as "submittedBy", created_at as "createdAt" from cash_closes where branch_id = $1 order by business_date desc`, [branchId]);
    return result.rows;
  }

  private currentBusinessDate(cutoff: string) {
    return businessDate(this.clock.now(), cutoff);
  }
}
