import { shiftDate } from '../../shared/business-date';

export type Bucket = 'day' | 'week' | 'month';

/** Monday of the week `date` falls in. */
export const weekStart = (date: string) => shiftDate(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
export const monthStart = (date: string) => `${date.slice(0, 7)}-01`;

/** Growth compares month-to-date sales with the same number of days last month (clamped to its length). */
export function growthWindow(date: string) {
  const [year, month, dayNumber] = date.split('-').map(Number);
  const previousMonth = new Date(Date.UTC(year, month - 2, 1));
  const start = previousMonth.toISOString().slice(0, 10);
  const lastDay = new Date(Date.UTC(previousMonth.getUTCFullYear(), previousMonth.getUTCMonth() + 1, 0)).getUTCDate();
  return { from: start, to: shiftDate(start, Math.min(dayNumber, lastDay) - 1) };
}

export const growthPercent = (mtd: bigint, previous: bigint) => (previous ? (Number(mtd - previous) / Number(previous)) * 100 : null);

/** The trend looks back 84 days, snapped to the start of the bucket. */
export function trendStart(bucket: Bucket, end: string) {
  const lookback = shiftDate(end, -83);
  return bucket === 'week' ? weekStart(lookback) : bucket === 'month' ? monthStart(lookback) : lookback;
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

/** Daily average of the window, ± 8 %. */
export function forecast(totalSales: number, windows: Array<{ start: string; end: string }>) {
  const average = Math.round(totalSales / windows.reduce((sum, w) => sum + daysBetween(w.start, w.end), 0));
  return { dailyAverage: String(average), lower: String(Math.round(average * 0.92)), upper: String(Math.round(average * 1.08)) };
}

export interface BranchFigures {
  branchId: string; date: string; today: string; week: string; mtd: string; sales: string; customers: number; previous: string;
  expenses: string; dailyTarget: string; inventoryValue: string;
}

/** Totals across branches. Operating contribution is month-to-date sales minus month-to-date expenses. */
export function rollUp(branches: BranchFigures[]) {
  const sum = (pick: (b: BranchFigures) => string) => branches.reduce((n, b) => n + BigInt(pick(b)), 0n);
  const today = sum(b => b.today), mtd = sum(b => b.mtd), previous = sum(b => b.previous), expenses = sum(b => b.expenses), target = sum(b => b.dailyTarget);
  return {
    date: branches[0]?.date, branches, today: today.toString(), week: sum(b => b.week).toString(), mtd: mtd.toString(), sales: mtd.toString(),
    customers: branches.reduce((n, b) => n + b.customers, 0), growth: growthPercent(mtd, previous), expenses: expenses.toString(),
    inventoryValue: sum(b => b.inventoryValue).toString(), operatingContribution: (mtd - expenses).toString(), dailyTarget: target.toString(),
    targetProgress: target ? (Number(today) / Number(target)) * 100 : null,
  };
}

/** Expenses as a percentage of sales, two decimals; null when there were no sales. */
export const shareOfSales = (expenses: string, sales: string) => (BigInt(sales) === 0n ? null : Number((BigInt(expenses) * 10000n) / BigInt(sales)) / 100);

/** A month's reporting range: the whole month, or up to today if it is the current one. */
export function monthRange(month: string, today: string) {
  const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10);
  return { from: `${month}-01`, to: month === today.slice(0, 7) ? today : monthEnd };
}
