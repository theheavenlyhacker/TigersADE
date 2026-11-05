import { Executor } from '../../db/unit-of-work';

export interface ExpenseFields { categoryId: string; businessDate: string; amount: string; note: string | null }
export interface ExpenseView extends ExpenseFields { id: string; branchId: string }
export interface ExpenseListItem extends ExpenseView { categoryName: string; recordedBy: string; updatedAt: Date }

export abstract class ExpensesRepository {
  abstract list(branchId: string, from: string, to: string): Promise<ExpenseListItem[]>;
  /** Inserts only if the category exists; otherwise returns null. */
  abstract insert(tx: Executor, branchId: string, recordedBy: string, fields: ExpenseFields): Promise<(ExpenseView & { recordedBy: string }) | null>;
  abstract lock(tx: Executor, branchId: string, id: string): Promise<ExpenseView | null>;
  abstract categoryExists(tx: Executor, id: string): Promise<boolean>;
  abstract save(tx: Executor, id: string, fields: ExpenseFields): Promise<ExpenseView>;
  abstract delete(tx: Executor, branchId: string, id: string): Promise<ExpenseView | null>;
}
