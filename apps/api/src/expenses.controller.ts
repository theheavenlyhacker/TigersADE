import { Body, Controller, Delete, ForbiddenException, Get, Inject, NotFoundException, Param, Patch, Post, Query, Req, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Pool } from 'pg';
import { Request } from 'express';
import { DB_POOL } from './db/db.module';
import { logActivity } from './db/activity';
import { AccessGuard, Roles } from './auth/access.guard';
import { AuthService, sessionToken } from './auth/auth.service';

const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const date = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const parsed = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === v;
};
const amount = (v: unknown): string | null => {
  if (typeof v === 'number' && Number.isSafeInteger(v) && v > 0) return String(v);
  if (typeof v === 'string' && /^[1-9]\d*$/.test(v) && BigInt(v) <= 9223372036854775807n) return v;
  return null;
};
const note = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.length <= 1000);

@ApiTags('expenses')
@Controller('branches/:branchId/expenses')
@UseGuards(AccessGuard)
@Roles('owner', 'manager')
export class ExpensesController {
  constructor(@Inject(DB_POOL) private readonly pool: Pool, private readonly auth: AuthService) {}

  @Get()
  async list(@Param('branchId') branchId: string, @Query('from') from: string, @Query('to') to: string) {
    if (!uuid(branchId) || !date(from) || !date(to) || from > to) throw new UnprocessableEntityException('from and to must be business dates, with from <= to');
    return (await this.pool.query(`select e.id, e.branch_id as "branchId", e.category_id as "categoryId", c.name as "categoryName", e.business_date::text as "businessDate", e.amount::text, e.note, e.recorded_by as "recordedBy", e.updated_at as "updatedAt"
      from expenses e join expense_categories c on c.id=e.category_id where e.branch_id=$1 and e.business_date between $2 and $3 order by e.business_date desc, e.created_at desc`, [branchId, from, to])).rows;
  }

  @Post()
  async create(@Param('branchId') branchId: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    if (!uuid(branchId) || !uuid(body?.categoryId) || !date(body?.businessDate) || amount(body?.amount) === null || !note(body?.note)) throw new UnprocessableEntityException('categoryId, businessDate, positive amount in centavos, and an optional note of at most 1000 characters are required');
    const actor = await this.auth.current(sessionToken(req));
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await client.query(`insert into expenses (branch_id, category_id, business_date, amount, note, recorded_by)
        select $1, id, $3, $4, $5, $6 from expense_categories where id=$2 returning id, branch_id as "branchId", category_id as "categoryId", business_date::text as "businessDate", amount::text, note, recorded_by as "recordedBy"`, [branchId, body.categoryId, body.businessDate, amount(body.amount), body.note ?? null, actor.user.id]);
      if (!result.rowCount) throw new NotFoundException('Expense category not found');
      const row = result.rows[0];
      await logActivity(client, { branchId, actorId: actor.user.id, action: 'expense.created', payload: { expenseId: row.id, after: row } });
      await client.query('commit');
      return row;
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }

  @Patch(':expenseId')
  async update(@Param('branchId') branchId: string, @Param('expenseId') expenseId: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    const allowed = ['categoryId', 'businessDate', 'amount', 'note'];
    const keys = Object.keys(body ?? {});
    if (!uuid(branchId) || !uuid(expenseId) || !keys.length || keys.some(k => !allowed.includes(k)) || ('categoryId' in body && !uuid(body.categoryId)) || ('businessDate' in body && !date(body.businessDate)) || ('amount' in body && amount(body.amount) === null) || ('note' in body && !note(body.note))) throw new UnprocessableEntityException('Set valid categoryId, businessDate, positive amount in centavos, or an optional note of at most 1000 characters');
    const actor = await this.auth.current(sessionToken(req));
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const current = await client.query(`select id, branch_id as "branchId", category_id as "categoryId", business_date::text as "businessDate", amount::text, note from expenses where id=$1 and branch_id=$2 for update`, [expenseId, branchId]);
      if (!current.rowCount) throw new NotFoundException();
      const before = current.rows[0];
      if (body.categoryId) {
        const category = await client.query('select id from expense_categories where id=$1', [body.categoryId]);
        if (!category.rowCount) throw new NotFoundException('Expense category not found');
      }
      const after = { ...before, categoryId: body.categoryId ?? before.categoryId, businessDate: body.businessDate ?? before.businessDate, amount: body.amount === undefined ? before.amount : amount(body.amount), note: body.note === undefined ? before.note : body.note };
      const result = await client.query(`update expenses set category_id=$1, business_date=$2, amount=$3, note=$4, updated_at=now() where id=$5 returning id, branch_id as "branchId", category_id as "categoryId", business_date::text as "businessDate", amount::text, note`, [after.categoryId, after.businessDate, after.amount, after.note, expenseId]);
      await logActivity(client, { branchId, actorId: actor.user.id, action: 'expense.updated', payload: { expenseId, before, after: result.rows[0] } });
      await client.query('commit');
      return result.rows[0];
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }

  @Delete(':expenseId')
  async remove(@Param('branchId') branchId: string, @Param('expenseId') expenseId: string, @Req() req: Request) {
    if (!uuid(branchId) || !uuid(expenseId)) throw new UnprocessableEntityException('Invalid expense');
    const actor = await this.auth.current(sessionToken(req));
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await client.query(`delete from expenses where id=$1 and branch_id=$2 returning id, branch_id as "branchId", category_id as "categoryId", business_date::text as "businessDate", amount::text, note`, [expenseId, branchId]);
      if (!result.rowCount) throw new NotFoundException();
      await logActivity(client, { branchId, actorId: actor.user.id, action: 'expense.deleted', payload: { expenseId, before: result.rows[0] } });
      await client.query('commit');
      return { id: expenseId };
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }
}

@ApiTags('reports')
@Controller('reports')
@UseGuards(AccessGuard)
@Roles('owner', 'manager')
export class ExpenseReportsController {
  constructor(@Inject(DB_POOL) private readonly pool: Pool, private readonly auth: AuthService) {}

  private async branches(branch: string, req: Request) {
    const current = await this.auth.current(sessionToken(req));
    if (branch === 'all' && current.user.role === 'owner') return (await this.pool.query('select id from branches order by code')).rows.map(r => r.id as string);
    if (uuid(branch) && (current.user.role === 'owner' || current.branches.some(b => b.id === branch))) return [branch];
    if (branch === 'all' || uuid(branch)) throw new ForbiddenException();
    throw new UnprocessableEntityException('branch must be an accessible branch id or all for the owner');
  }

  @Get('summary')
  async summary(@Query('branch') branch: string, @Req() req: Request) {
    const ids = await this.branches(branch, req);
    const rows = await this.pool.query(`select b.id as "branchId", coalesce(s.total,0)::text as sales, coalesce(e.total,0)::text as expenses
      from branches b left join (select branch_id, sum(total) total from sales where voided_at is null and business_date between date_trunc('month', (now() at time zone 'Asia/Manila'))::date and (now() at time zone 'Asia/Manila')::date group by branch_id) s on s.branch_id=b.id
      left join (select branch_id, sum(amount) total from expenses where business_date between date_trunc('month', (now() at time zone 'Asia/Manila'))::date and (now() at time zone 'Asia/Manila')::date group by branch_id) e on e.branch_id=b.id where b.id=any($1::uuid[]) order by b.code`, [ids]);
    const branches = rows.rows.map(r => ({ ...r, operatingContribution: (BigInt(r.sales) - BigInt(r.expenses)).toString() }));
    return { branches, sales: branches.reduce((n, b) => n + BigInt(b.sales), 0n).toString(), expenses: branches.reduce((n, b) => n + BigInt(b.expenses), 0n).toString(), operatingContribution: branches.reduce((n, b) => n + BigInt(b.operatingContribution), 0n).toString() };
  }

  @Get('expenses')
  async report(@Query('branch') branch: string, @Query('month') month: string, @Req() req: Request) {
    if (!/^\d{4}-\d{2}$/.test(month ?? '') || Number(month.slice(5)) < 1 || Number(month.slice(5)) > 12) throw new UnprocessableEntityException('month must be YYYY-MM');
    const ids = await this.branches(branch, req);
    const from = `${month}-01`, monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const to = month === today.slice(0, 7) ? today : monthEnd;
    const [categories, totals] = await Promise.all([
      this.pool.query(`select c.id as "categoryId", c.name as "categoryName", coalesce(sum(e.amount),0)::text as total from expense_categories c left join expenses e on e.category_id=c.id and e.branch_id=any($1::uuid[]) and e.business_date between $2 and $3 group by c.id, c.name order by c.name`, [ids, from, to]),
      this.pool.query(`select coalesce((select sum(amount) from expenses where branch_id=any($1::uuid[]) and business_date between $2 and $3),0)::text as expenses, coalesce((select sum(total) from sales where branch_id=any($1::uuid[]) and business_date between $2 and $3 and voided_at is null),0)::text as sales`, [ids, from, to]),
    ]);
    const totalExpenses = totals.rows[0].expenses as string, sales = totals.rows[0].sales as string;
    return { month, categories: categories.rows, expenses: totalExpenses, sales, shareOfSales: BigInt(sales) === 0n ? null : Number((BigInt(totalExpenses) * 10000n) / BigInt(sales)) / 100 };
  }
}
