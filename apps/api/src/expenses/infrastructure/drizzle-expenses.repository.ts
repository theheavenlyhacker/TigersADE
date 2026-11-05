import { Inject, Injectable } from '@nestjs/common';
import { and, between, desc, eq, sql } from 'drizzle-orm';
import { DB, Db } from '../../db/db.module';
import { expenseCategories, expenses } from '../../db/schema';
import { Executor } from '../../db/unit-of-work';
import { asText } from '../../shared/sql';
import { ExpenseFields, ExpensesRepository } from '../application/expenses.repository';

const view = {
  id: expenses.id, branchId: expenses.branchId, categoryId: expenses.categoryId,
  businessDate: sql<string>`${expenses.businessDate}::text`, amount: asText(expenses.amount), note: expenses.note,
};

@Injectable()
export class DrizzleExpensesRepository extends ExpensesRepository {
  constructor(@Inject(DB) private readonly db: Db) { super(); }

  list(branchId: string, from: string, to: string) {
    return this.db.select({ ...view, categoryName: expenseCategories.name, recordedBy: expenses.recordedBy, updatedAt: expenses.updatedAt })
      .from(expenses).innerJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
      .where(and(eq(expenses.branchId, branchId), between(expenses.businessDate, from, to))).orderBy(desc(expenses.businessDate), desc(expenses.createdAt));
  }

  async insert(tx: Executor, branchId: string, recordedBy: string, f: ExpenseFields) {
    if (!(await this.categoryExists(tx, f.categoryId))) return null;
    const [row] = await tx.insert(expenses).values({ branchId, categoryId: f.categoryId, businessDate: f.businessDate, amount: BigInt(f.amount), note: f.note, recordedBy })
      .returning({ ...view, recordedBy: expenses.recordedBy });
    return row;
  }

  async lock(tx: Executor, branchId: string, id: string) {
    const [row] = await tx.select(view).from(expenses).where(and(eq(expenses.id, id), eq(expenses.branchId, branchId))).for('update');
    return row ?? null;
  }

  async categoryExists(tx: Executor, id: string) {
    return (await tx.select({ id: expenseCategories.id }).from(expenseCategories).where(eq(expenseCategories.id, id))).length > 0;
  }

  async save(tx: Executor, id: string, f: ExpenseFields) {
    const [row] = await tx.update(expenses).set({ categoryId: f.categoryId, businessDate: f.businessDate, amount: BigInt(f.amount), note: f.note, updatedAt: sql`now()` })
      .where(eq(expenses.id, id)).returning(view);
    return row;
  }

  async delete(tx: Executor, branchId: string, id: string) {
    const [row] = await tx.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.branchId, branchId))).returning(view);
    return row ?? null;
  }
}
