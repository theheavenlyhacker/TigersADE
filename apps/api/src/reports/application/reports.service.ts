import { Inject, Injectable } from '@nestjs/common';
import { branchScope } from '../../auth/domain/branch-scope';
import { asHttp } from '../../shared/domain-error';
import { CurrentUser } from '../../auth/domain/current-user';
import { businessDate } from '../../shared/business-date';
import { CLOCK, Clock } from '../../shared/clock';
import { Bucket, forecast, growthWindow, monthRange, monthStart, rollUp, shareOfSales, trendStart, weekStart } from '../domain/reporting';
import { ReportsRepository } from './reports.repository';

const BUCKETS: Record<'daily' | 'weekly' | 'monthly', Bucket> = { daily: 'day', weekly: 'week', monthly: 'month' };

const scope = (current: CurrentUser, branch?: string) => asHttp(() => branchScope(current, branch));

@Injectable()
export class ReportsService {
  constructor(private readonly repo: ReportsRepository, @Inject(CLOCK) private readonly clock: Clock) {}

  /** Figures come from sales at query time and are never stored (ADR-0001). */
  async summary(current: CurrentUser, query: { branch: string; date?: string }) {
    const ids = scope(current, query.branch);
    const [settings, inventory] = await Promise.all([this.repo.branchSettings(ids), this.repo.inventoryValues(ids)]);
    const branches = await Promise.all(settings.map(async ({ id, cutoff, target }) => {
      const today = query.date ?? businessDate(this.clock.now(), cutoff);
      const month = monthStart(today);
      const { from: prevStart, to: compareEnd } = growthWindow(today);
      const [sales, expenses] = await Promise.all([
        this.repo.salesFigures(id, { today, monday: weekStart(today), month, prevStart, compareEnd }),
        this.repo.expensesTotal(id, month, today),
      ]);
      return { branchId: id, date: today, today: sales.today, week: sales.week, mtd: sales.mtd, sales: sales.mtd, customers: sales.customers, previous: sales.previous, expenses, dailyTarget: target, inventoryValue: inventory.get(id) ?? '0' };
    }));
    return rollUp(branches);
  }

  async trend(current: CurrentUser, query: { branch: string; granularity: 'daily' | 'weekly' | 'monthly'; date?: string }) {
    const settings = await this.repo.branchSettings(scope(current, query.branch));
    const bucket = BUCKETS[query.granularity];
    const windows = settings.map(({ id, cutoff }) => {
      const end = query.date ?? businessDate(this.clock.now(), cutoff);
      return { id, start: trendStart(bucket, end), end };
    });
    const series = await this.repo.trend(windows, bucket);
    const total = series.reduce((sum, row) => sum + Number(row.sales), 0);
    return { granularity: query.granularity, series, forecast: forecast(total, windows) };
  }

  async comparison(current: CurrentUser) {
    const settings = await this.repo.branchSettings(scope(current, 'all'));
    return this.repo.comparison(settings.map(b => ({ id: b.id, date: businessDate(this.clock.now(), b.cutoff) })));
  }

  bestSellers(current: CurrentUser, q: { branch: string; from: string; to: string }) { return this.repo.bestSellers(scope(current, q.branch), q.from, q.to); }
  peakHours(current: CurrentUser, q: { branch: string; from: string; to: string }) { return this.repo.peakHours(scope(current, q.branch), q.from, q.to); }
  productSales(current: CurrentUser, branch: string) { return this.repo.productSales(scope(current, branch)); }

  async expenses(current: CurrentUser, q: { branch: string; month: string }) {
    const settings = await this.repo.branchSettings(scope(current, q.branch));
    const bounds = settings.map(({ id, cutoff }) => ({ id, ...(({ from, to }) => ({ start: from, end: to }))(monthRange(q.month, businessDate(this.clock.now(), cutoff))) }));
    const { categories, expenses, sales } = await this.repo.expenseReport(bounds);
    return { month: q.month, categories, expenses, sales, shareOfSales: shareOfSales(expenses, sales) };
  }
}
