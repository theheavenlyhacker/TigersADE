import { Executor } from '../../db/unit-of-work';

export interface CashCloseFigures { openingFloat: string; cashSales: string; expectedCash: string; countedCash: string; variance: string; note: string | null }
export interface CashCloseView extends CashCloseFigures { id: string; branchId: string; businessDate: string }

export abstract class CashClosesRepository {
  abstract dayCutoff(branchId: string): Promise<string | null>;
  abstract lockBranch(tx: Executor, branchId: string): Promise<{ dayCutoff: string } | null>;
  /** Sum of the day's non-voided cash sales, centavos. */
  abstract cashSales(exec: Executor | undefined, branchId: string, businessDate: string): Promise<string>;
  abstract find(branchId: string, businessDate: string): Promise<(CashCloseFigures & { id: string }) | null>;
  /** Throws ConflictException if the day already has a close. */
  abstract insert(tx: Executor, close: CashCloseFigures & { branchId: string; businessDate: string; submittedBy: string }): Promise<CashCloseView>;
}
