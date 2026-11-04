import { Controller, ForbiddenException, Get, Inject, Query, Req, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { Pool } from 'pg';
import { Request } from 'express';
import { DB_POOL } from './db/db.module';
import { AccessGuard, Roles } from './auth/access.guard';
import { AuthService, sessionToken } from './auth/auth.service';
import { CLOCK, Clock } from './clock';
import { businessDate } from './business-date';

export class BranchQuery {
  @IsString() @IsNotEmpty() branch!: string;
}
export class SummaryQuery extends BranchQuery {
  @IsOptional() @IsISO8601({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
}
export class TrendQuery extends BranchQuery {
  @IsIn(['daily', 'weekly', 'monthly']) granularity = 'daily';
  @IsOptional() @IsISO8601({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
}
export class SalesRangeQuery extends BranchQuery {
  @IsISO8601({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @IsISO8601({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
}

const shift = (s: string, n: number) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const growthWindow = (date: string) => {
  const [year, month, dayNumber] = date.split('-').map(Number);
  const previousMonth = new Date(Date.UTC(year, month - 2, 1));
  const start = previousMonth.toISOString().slice(0, 10);
  const lastDay = new Date(Date.UTC(previousMonth.getUTCFullYear(), previousMonth.getUTCMonth() + 1, 0)).getUTCDate();
  return { from: start, to: shift(start, Math.min(dayNumber, lastDay) - 1) };
};

@Controller('reports')
@UseGuards(AccessGuard)
@Roles('owner', 'manager')
export class ReportsController {
  constructor(@Inject(DB_POOL) private readonly pool: Pool, private readonly auth: AuthService, @Inject(CLOCK) private readonly clock: Clock) {}

  private async scope(branch: string, req: Request) {
    const current = await this.auth.current(sessionToken(req));
    if (branch === 'all' && current.user.role !== 'owner') throw new ForbiddenException();
    if (branch !== 'all' && !current.branches.some(b => b.id === branch)) throw new ForbiddenException();
    return branch === 'all' ? current.branches.map(b => b.id) : [branch];
  }

  @Get('summary') async summary(@Query() query: SummaryQuery, @Req() req: Request) {
    const ids = await this.scope(query.branch, req);
    const branches = await this.pool.query('select id, day_cutoff::text cutoff, coalesce(daily_target, 0)::text target from branches where id = any($1::uuid[]) order by code', [ids]);
    const summaries = await Promise.all(branches.rows.map(async ({ id, cutoff, target }) => {
      const today = query.date ?? businessDate(this.clock.now(), cutoff as string);
      const monday = shift(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
      const month = `${today.slice(0, 7)}-01`;
      const { from: prevStart, to: compareEnd } = growthWindow(today);
      const result = await this.pool.query(`select
      coalesce(sum(total) filter(where business_date = $2), 0)::text today,
      coalesce(sum(total) filter(where business_date between $3 and $2), 0)::text week,
      coalesce(sum(total) filter(where business_date between $4 and $2), 0)::text mtd,
      count(*) filter(where business_date between $4 and $2)::int customers,
      coalesce(sum(total) filter(where business_date between $5 and $6), 0)::text previous
      from sales where branch_id = $1 and voided_at is null
      and (business_date between $3 and $2 or business_date between $4 and $2 or business_date between $5 and $6)`,
      [id, today, monday, month, prevStart, compareEnd]);
      const expenses = await this.pool.query('select coalesce(sum(amount), 0)::text expenses from expenses where branch_id = $1 and business_date between $2 and $3', [id, month, today]);
      const row = result.rows[0];
      return { branchId: id, date: today, today: row.today, week: row.week, mtd: row.mtd, sales: row.mtd, customers: row.customers, previous: row.previous, expenses: expenses.rows[0].expenses, dailyTarget: target };
    }));
    const sum = (key: string) => summaries.reduce((n, b) => n + BigInt(b[key as keyof typeof b] as string), 0n).toString();
    const previous = BigInt(sum('previous'));
    const mtd = BigInt(sum('mtd'));
    const target = BigInt(sum('dailyTarget'));
    const today = BigInt(sum('today'));
    const expenses = BigInt(sum('expenses'));
    return { date: summaries[0]?.date, branches: summaries, today: today.toString(), week: sum('week'), mtd: mtd.toString(), sales: mtd.toString(), customers: summaries.reduce((n, b) => n + b.customers, 0), growth: previous ? Number(mtd - previous) / Number(previous) * 100 : null, expenses: expenses.toString(), operatingContribution: (mtd - expenses).toString(), dailyTarget: target.toString(), targetProgress: target ? Number(today) / Number(target) * 100 : null };
  }

  @Get('trend') async trend(@Query() query: TrendQuery, @Req() req: Request) {
    const ids = await this.scope(query.branch, req);
    const branches = await this.pool.query('select id, day_cutoff::text cutoff from branches where id = any($1::uuid[]) order by code', [ids]);
    const bucket = query.granularity === 'weekly' ? 'week' : query.granularity === 'monthly' ? 'month' : 'day';
    const windows = branches.rows.map(({ id, cutoff }) => {
      const end = query.date ?? businessDate(this.clock.now(), cutoff as string);
      const lookback = shift(end, -83);
      const start = bucket === 'week'
        ? shift(lookback, -((new Date(`${lookback}T00:00:00Z`).getUTCDay() + 6) % 7))
        : bucket === 'month' ? `${lookback.slice(0, 7)}-01` : lookback;
      return { id, start, end };
    });
    const result = await this.pool.query(`with grouped as (
      select s.branch_id, date_trunc('${bucket}', s.business_date::timestamp)::date bucket, sum(s.total)::bigint sales
      from sales s join unnest($1::uuid[], $2::date[], $3::date[]) w(branch_id, start_date, end_date) on w.branch_id = s.branch_id
      where s.business_date between w.start_date and w.end_date and s.voided_at is null group by 1, 2
    ), buckets as (
      select w.branch_id, generate_series(date_trunc('${bucket}', w.start_date::timestamp)::date,
        date_trunc('${bucket}', w.end_date::timestamp)::date, interval '1 ${bucket}')::date bucket
      from unnest($1::uuid[], $2::date[], $3::date[]) w(branch_id, start_date, end_date)
    ) select buckets.bucket::text date, coalesce(sum(grouped.sales), 0)::text sales
      from buckets left join grouped using (branch_id, bucket) group by buckets.bucket order by buckets.bucket`,
    [windows.map(w => w.id), windows.map(w => w.start), windows.map(w => w.end)]);
    const total = result.rows.reduce((sum, row) => sum + Number(row.sales), 0);
    const businessDays = windows.reduce((sum, w) => sum + Math.round((Date.parse(`${w.end}T00:00:00Z`) - Date.parse(`${w.start}T00:00:00Z`)) / 86_400_000) + 1, 0);
    const average = Math.round(total / businessDays);
    return { granularity: query.granularity, series: result.rows, forecast: { dailyAverage: String(average), lower: String(Math.round(average * .92)), upper: String(Math.round(average * 1.08)) } };
  }

  @Get('comparison') @Roles('owner') async comparison(@Req() req: Request) {
    const branchDates = await this.pool.query('select id, day_cutoff::text cutoff from branches where id = any($1::uuid[]) order by code', [await this.scope('all', req)]);
    const dates = branchDates.rows.map(b => ({ id: b.id, date: businessDate(this.clock.now(), b.cutoff) }));
    const result = await this.pool.query(`with branch_days as (
      select id, today, date_trunc('month', today - interval '1 month')::date previous_start,
        (date_trunc('month', today - interval '1 month')::date + least(extract(day from today)::int,
        extract(day from (date_trunc('month', today - interval '1 month') + interval '1 month - 1 day'))::int) - 1) previous_end
      from unnest($1::uuid[], $2::date[]) d(id, today)
    ), figures as (
      select b.id, b.name, b.code, d.today::text as date,
        coalesce(sum(s.total) filter(where s.business_date = d.today), 0)::text today,
        coalesce(sum(s.total) filter(where s.business_date between date_trunc('week', d.today)::date and d.today), 0)::text week,
        coalesce(sum(s.total) filter(where s.business_date between date_trunc('month', d.today)::date and d.today), 0)::text mtd,
        coalesce(sum(s.total) filter(where s.business_date between d.previous_start and d.previous_end), 0)::text previous
      from branches b join branch_days d on d.id = b.id
      left join sales s on s.branch_id = b.id and s.voided_at is null
        and s.business_date between least(date_trunc('week', d.today)::date, d.previous_start) and d.today
      group by b.id, b.name, b.code, d.today, d.previous_start, d.previous_end
    ) select *, case when previous::numeric = 0 then null else (mtd::numeric - previous::numeric) / previous::numeric * 100 end growth,
      case when sum(mtd::numeric) over () = 0 then 0 else mtd::numeric / sum(mtd::numeric) over () * 100 end share
      from figures order by code`, [dates.map(b => b.id), dates.map(b => b.date)]);
    return result.rows;
  }

  @Get('best-sellers') async best(@Query() query: SalesRangeQuery, @Req() req: Request) {
    if (query.from > query.to) throw new UnprocessableEntityException('from must be on or before to');
    const ids = await this.scope(query.branch, req);
    const result = await this.pool.query(`select l.product_id as "productId", l.product_name as name, sum(l.qty)::int units,
      sum(l.qty * l.unit_price)::text revenue,
      case when sum(l.qty * l.unit_price) = 0 then 0 else round((sum(l.qty * (l.unit_price - l.unit_cost))::numeric / sum(l.qty * l.unit_price)) * 100, 2) end margin
      from sale_lines l join sales s on s.id = l.sale_id where s.branch_id = any($1::uuid[])
      and s.business_date between $2 and $3 and s.voided_at is null group by l.product_id, l.product_name
      order by sum(l.qty * l.unit_price) desc`, [ids, query.from, query.to]);
    return result.rows;
  }

  @Get('peak-hours') async peak(@Query() query: SalesRangeQuery, @Req() req: Request) {
    if (query.from > query.to) throw new UnprocessableEntityException('from must be on or before to');
    const ids = await this.scope(query.branch, req);
    const result = await this.pool.query(`select extract(hour from s.created_at at time zone 'Asia/Manila')::int as local_hour,
      count(*)::int customers, coalesce(sum(s.total), 0)::text sales from sales s where s.branch_id = any($1::uuid[])
      and s.business_date between $2 and $3 and s.voided_at is null group by local_hour order by local_hour`, [ids, query.from, query.to]);
    return result.rows;
  }

  @Get('product-sales') async productSales(@Query() query: BranchQuery, @Req() req: Request) {
    const ids = await this.scope(query.branch, req);
    const result = await this.pool.query(`select l.product_id as "productId", coalesce(sum(l.qty), 0)::int units,
      coalesce(sum(l.qty * l.unit_price), 0)::text revenue from sale_lines l join sales s on s.id = l.sale_id
      where s.branch_id = any($1::uuid[]) and s.voided_at is null group by l.product_id`, [ids]);
    return result.rows;
  }
}
