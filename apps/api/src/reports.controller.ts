import { Controller, ForbiddenException, Get, Inject, Query, Req, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { IsIn, IsISO8601, IsNotEmpty, IsString, Matches } from 'class-validator';
import { Pool } from 'pg';
import { Request } from 'express';
import { DB_POOL } from './db/db.module';
import { AccessGuard, Roles } from './auth/access.guard';
import { AuthService, sessionToken } from './auth/auth.service';
import { CLOCK, Clock } from './clock';

export class BranchQuery {
  @IsString() @IsNotEmpty() branch!: string;
}
export class SummaryQuery extends BranchQuery {
  @IsISO8601({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
}
export class TrendQuery extends BranchQuery {
  @IsIn(['daily', 'weekly', 'monthly']) granularity = 'daily';
  @IsISO8601({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
}
export class SalesRangeQuery extends BranchQuery {
  @IsISO8601({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @IsISO8601({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
}

const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
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
    const today = query.date;
    const monday = shift(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
    const month = `${today.slice(0, 7)}-01`;
    const { from: prevStart, to: compareEnd } = growthWindow(today);
    const result = await this.pool.query(`select
      coalesce(sum(total) filter(where business_date = $2), 0)::text today,
      coalesce(sum(total) filter(where business_date between $3 and $2), 0)::text week,
      coalesce(sum(total) filter(where business_date between $4 and $2), 0)::text mtd,
      count(*) filter(where business_date between $4 and $2)::int customers,
      coalesce(sum(total) filter(where business_date between $5 and $6), 0)::text previous
      from sales where branch_id = any($1::uuid[]) and voided_at is null
      and (business_date between $3 and $2 or business_date between $4 and $2 or business_date between $5 and $6)`,
    [ids, today, monday, month, prevStart, compareEnd]);
    const row = result.rows[0];
    const growth = Number(row.previous) ? (Number(row.mtd) - Number(row.previous)) / Number(row.previous) * 100 : null;
    const targets = await this.pool.query('select coalesce(sum(daily_target), 0)::text target from branches where id = any($1::uuid[])', [ids]);
    return { today: row.today, week: row.week, mtd: row.mtd, customers: row.customers, growth, dailyTarget: targets.rows[0].target, targetProgress: Number(targets.rows[0].target) ? Number(row.today) / Number(targets.rows[0].target) * 100 : null };
  }

  @Get('trend') async trend(@Query() query: TrendQuery, @Req() req: Request) {
    const ids = await this.scope(query.branch, req);
    const end = query.date || day(this.clock.now());
    const bucket = query.granularity === 'weekly' ? 'week' : query.granularity === 'monthly' ? 'month' : 'day';
    const lookback = shift(end, -83);
    const start = bucket === 'week'
      ? shift(lookback, -((new Date(`${lookback}T00:00:00Z`).getUTCDay() + 6) % 7))
      : bucket === 'month' ? `${lookback.slice(0, 7)}-01` : lookback;
    const result = await this.pool.query(`with grouped as (
      select date_trunc('${bucket}', business_date::timestamp)::date bucket, sum(total)::bigint sales
      from sales where branch_id = any($1::uuid[]) and business_date between $2 and $3 and voided_at is null
      group by 1
    ), buckets as (
      select generate_series(date_trunc('${bucket}', $2::date)::date, date_trunc('${bucket}', $3::date)::date, interval '1 ${bucket}')::date bucket
    ) select buckets.bucket::text date, coalesce(grouped.sales, 0)::text sales from buckets left join grouped using (bucket) order by buckets.bucket`, [ids, start, end]);
    const total = result.rows.reduce((sum, row) => sum + Number(row.sales), 0);
    const businessDays = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
    const average = Math.round(total / businessDays);
    return { granularity: query.granularity, series: result.rows, forecast: { dailyAverage: String(average), lower: String(Math.round(average * .92)), upper: String(Math.round(average * 1.08)) } };
  }

  @Get('comparison') @Roles('owner') async comparison(@Req() req: Request) {
    const today = day(this.clock.now());
    const { from, to } = growthWindow(today);
    const result = await this.pool.query(`with figures as (
      select b.id, b.name, b.code,
        coalesce(sum(s.total) filter(where s.business_date = $1), 0)::text today,
        coalesce(sum(s.total) filter(where s.business_date between date_trunc('week', $1::date)::date and $1), 0)::text week,
        coalesce(sum(s.total) filter(where s.business_date between date_trunc('month', $1::date)::date and $1), 0)::text mtd,
        coalesce(sum(s.total) filter(where s.business_date between $2 and $3), 0)::text previous
      from branches b left join sales s on s.branch_id = b.id and s.voided_at is null
      group by b.id
    ) select *, case when previous::numeric = 0 then null else (mtd::numeric - previous::numeric) / previous::numeric * 100 end growth,
      case when sum(mtd::numeric) over () = 0 then 0 else mtd::numeric / sum(mtd::numeric) over () * 100 end share
      from figures order by code`, [today, from, to]);
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
