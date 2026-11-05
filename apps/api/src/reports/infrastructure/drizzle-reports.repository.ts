import { Inject, Injectable } from '@nestjs/common';
import { and, between, eq, inArray, sql } from 'drizzle-orm';
import { DB, Db } from '../../db/db.module';
import { saleLines, sales } from '../../db/schema';
import { pgArray } from '../../shared/sql';
import { BranchSetting, DateWindow, ReportsRepository, SummaryWindows } from '../application/reports.repository';

@Injectable()
export class DrizzleReportsRepository extends ReportsRepository {
  constructor(@Inject(DB) private readonly db: Db) { super(); }

  private async rows<T>(query: ReturnType<typeof sql>) { return (await this.db.execute(query)).rows as T[]; }

  branchSettings(ids: string[]) {
    return this.rows<BranchSetting>(sql`select id, day_cutoff::text as cutoff, coalesce(daily_target, 0)::text as target from branches where id = any(${pgArray(ids, 'uuid')}) order by code`);
  }

  async inventoryValues(ids: string[]) {
    const rows = await this.rows<{ id: string; value: string }>(sql`select b.id, round(coalesce(sum(coalesce(m.on_hand,0) * i.unit_cost),0))::text as value
      from branches b cross join inventory_items i left join lateral (select sum(qty_delta) on_hand from stock_movements where branch_id=b.id and item_id=i.id) m on true
      where b.id = any(${pgArray(ids, 'uuid')}) and i.active group by b.id`);
    return new Map(rows.map(row => [row.id, row.value]));
  }

  async salesFigures(branchId: string, w: SummaryWindows) {
    const [row] = await this.rows<{ today: string; week: string; mtd: string; customers: number; previous: string }>(sql`select
      coalesce(sum(total) filter(where business_date = ${w.today}), 0)::text as today,
      coalesce(sum(total) filter(where business_date between ${w.monday} and ${w.today}), 0)::text as week,
      coalesce(sum(total) filter(where business_date between ${w.month} and ${w.today}), 0)::text as mtd,
      count(*) filter(where business_date between ${w.month} and ${w.today})::int as customers,
      coalesce(sum(total) filter(where business_date between ${w.prevStart} and ${w.compareEnd}), 0)::text as previous
      from sales where branch_id = ${branchId} and voided_at is null
      and (business_date between ${w.monday} and ${w.today} or business_date between ${w.month} and ${w.today} or business_date between ${w.prevStart} and ${w.compareEnd})`);
    return row;
  }

  async expensesTotal(branchId: string, from: string, to: string) {
    const [row] = await this.rows<{ expenses: string }>(sql`select coalesce(sum(amount), 0)::text as expenses from expenses where branch_id = ${branchId} and business_date between ${from} and ${to}`);
    return row.expenses;
  }

  trend(windows: DateWindow[], bucket: 'day' | 'week' | 'month') {
    const unit = sql.raw(bucket);
    const w = sql`unnest(${pgArray(windows.map(x => x.id), 'uuid')}, ${pgArray(windows.map(x => x.start), 'date')}, ${pgArray(windows.map(x => x.end), 'date')}) w(branch_id, start_date, end_date)`;
    return this.rows<{ date: string; sales: string }>(sql`with grouped as (
      select s.branch_id, date_trunc('${unit}', s.business_date::timestamp)::date bucket, sum(s.total)::bigint sales
      from sales s join ${w} on w.branch_id = s.branch_id
      where s.business_date between w.start_date and w.end_date and s.voided_at is null group by 1, 2
    ), buckets as (
      select w.branch_id, generate_series(date_trunc('${unit}', w.start_date::timestamp)::date,
        date_trunc('${unit}', w.end_date::timestamp)::date, interval '1 ${unit}')::date bucket
      from ${w}
    ) select buckets.bucket::text as date, coalesce(sum(grouped.sales), 0)::text as sales
      from buckets left join grouped using (branch_id, bucket) group by buckets.bucket order by buckets.bucket`);
  }

  comparison(days: Array<{ id: string; date: string }>) {
    return this.rows<unknown>(sql`with branch_days as (
      select id, today, date_trunc('month', today - interval '1 month')::date previous_start,
        (date_trunc('month', today - interval '1 month')::date + least(extract(day from today)::int,
        extract(day from (date_trunc('month', today - interval '1 month') + interval '1 month - 1 day'))::int) - 1) previous_end
      from unnest(${pgArray(days.map(d => d.id), 'uuid')}, ${pgArray(days.map(d => d.date), 'date')}) d(id, today)
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
      from figures order by code`);
  }

  bestSellers(ids: string[], from: string, to: string) {
    return this.db.select({
      productId: saleLines.productId, name: saleLines.productName, units: sql<number>`sum(${saleLines.qty})::int`,
      revenue: sql<string>`sum(${saleLines.qty} * ${saleLines.unitPrice})::text`,
      margin: sql<string>`case when sum(${saleLines.qty} * ${saleLines.unitPrice}) = 0 then 0 else round((sum(${saleLines.qty} * (${saleLines.unitPrice} - ${saleLines.unitCost}))::numeric / sum(${saleLines.qty} * ${saleLines.unitPrice})) * 100, 2) end`,
    }).from(saleLines).innerJoin(sales, eq(sales.id, saleLines.saleId))
      .where(and(inArray(sales.branchId, ids), between(sales.businessDate, from, to), sql`${sales.voidedAt} is null`))
      .groupBy(saleLines.productId, saleLines.productName).orderBy(sql`sum(${saleLines.qty} * ${saleLines.unitPrice}) desc`);
  }

  peakHours(ids: string[], from: string, to: string) {
    return this.rows<unknown>(sql`select extract(hour from s.created_at at time zone 'Asia/Manila')::int as local_hour,
      count(*)::int as customers, coalesce(sum(s.total), 0)::text as sales from sales s where s.branch_id = any(${pgArray(ids, 'uuid')})
      and s.business_date between ${from} and ${to} and s.voided_at is null group by local_hour order by local_hour`);
  }

  productSales(ids: string[]) {
    return this.db.select({ productId: saleLines.productId, units: sql<number>`coalesce(sum(${saleLines.qty}), 0)::int`, revenue: sql<string>`coalesce(sum(${saleLines.qty} * ${saleLines.unitPrice}), 0)::text` })
      .from(saleLines).innerJoin(sales, eq(sales.id, saleLines.saleId)).where(and(inArray(sales.branchId, ids), sql`${sales.voidedAt} is null`)).groupBy(saleLines.productId);
  }

  async expenseReport(bounds: DateWindow[]) {
    const within = (alias: string, branchColumn: string) => bounds.length
      ? sql.join(bounds.map(b => sql`(${sql.raw(`${alias}.${branchColumn}`)} = ${b.id} and ${sql.raw(`${alias}.business_date`)} between ${b.start} and ${b.end})`), sql` or `)
      : sql`false`;
    const [categories, totals] = await Promise.all([
      this.rows<unknown>(sql`select c.id as "categoryId", c.name as "categoryName", coalesce(sum(e.amount),0)::text as total from expense_categories c
        left join expenses e on e.category_id = c.id and (${within('e', 'branch_id')}) group by c.id, c.name order by c.name`),
      this.rows<{ expenses: string; sales: string }>(sql`select coalesce(sum(e.amount),0)::text as expenses,
        coalesce((select sum(s.total) from sales s where s.voided_at is null and (${within('s', 'branch_id')})),0)::text as sales
        from expenses e where ${within('e', 'branch_id')}`),
    ]);
    return { categories, expenses: totals[0].expenses, sales: totals[0].sales };
  }
}
