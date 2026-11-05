import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityLog } from '../../db/activity-log';
import { UnitOfWork } from '../../db/unit-of-work';
import { ExpenseFields, ExpensesRepository } from './expenses.repository';

@Injectable()
export class ExpensesService {
  constructor(private readonly repo: ExpensesRepository, private readonly uow: UnitOfWork, private readonly activity: ActivityLog) {}

  list(branchId: string, from: string, to: string) { return this.repo.list(branchId, from, to); }

  create(actorId: string, branchId: string, fields: ExpenseFields) {
    return this.uow.run(async tx => {
      const expense = await this.repo.insert(tx, branchId, actorId, fields);
      if (!expense) throw new NotFoundException('Expense category not found');
      await this.activity.record(tx, { branchId, actorId, action: 'expense.created', payload: { expenseId: expense.id, after: expense } });
      return expense;
    });
  }

  update(actorId: string, branchId: string, id: string, change: Partial<ExpenseFields>) {
    return this.uow.run(async tx => {
      const before = await this.repo.lock(tx, branchId, id);
      if (!before) throw new NotFoundException();
      if (change.categoryId && !(await this.repo.categoryExists(tx, change.categoryId))) throw new NotFoundException('Expense category not found');
      const after = await this.repo.save(tx, id, {
        categoryId: change.categoryId ?? before.categoryId, businessDate: change.businessDate ?? before.businessDate,
        amount: change.amount ?? before.amount, note: change.note === undefined ? before.note : change.note,
      });
      await this.activity.record(tx, { branchId, actorId, action: 'expense.updated', payload: { expenseId: id, before, after } });
      return after;
    });
  }

  /** Expenses are the only records that are hard-deleted; the log keeps what was removed. */
  remove(actorId: string, branchId: string, id: string) {
    return this.uow.run(async tx => {
      const before = await this.repo.delete(tx, branchId, id);
      if (!before) throw new NotFoundException();
      await this.activity.record(tx, { branchId, actorId, action: 'expense.deleted', payload: { expenseId: id, before } });
      return { id };
    });
  }
}
