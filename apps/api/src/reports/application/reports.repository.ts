export interface BranchSetting { id: string; cutoff: string; target: string }
export interface DateWindow { id: string; start: string; end: string }
export interface SummaryWindows { today: string; monday: string; month: string; prevStart: string; compareEnd: string }

export abstract class ReportsRepository {
  /** Branches in code order. */
  abstract branchSettings(ids: string[]): Promise<BranchSetting[]>;
  abstract inventoryValues(ids: string[]): Promise<Map<string, string>>;
  abstract salesFigures(branchId: string, w: SummaryWindows): Promise<{ today: string; week: string; mtd: string; customers: number; previous: string }>;
  abstract expensesTotal(branchId: string, from: string, to: string): Promise<string>;
  abstract trend(windows: DateWindow[], bucket: 'day' | 'week' | 'month'): Promise<Array<{ date: string; sales: string }>>;
  abstract comparison(days: Array<{ id: string; date: string }>): Promise<unknown[]>;
  abstract bestSellers(ids: string[], from: string, to: string): Promise<unknown[]>;
  abstract peakHours(ids: string[], from: string, to: string): Promise<unknown[]>;
  abstract productSales(ids: string[]): Promise<unknown[]>;
  abstract expenseReport(bounds: DateWindow[]): Promise<{ categories: unknown[]; expenses: string; sales: string }>;
}
