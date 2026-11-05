import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DB, Db } from '../../db/db.module';
import { branches, cashCloses, sales } from '../../db/schema';
import { Executor } from '../../db/unit-of-work';
import { UNIQUE_VIOLATION, pgCode } from '../../shared/pg-error';
import { asText } from '../../shared/sql';
import { CashClosesRepository, CashCloseFigures } from '../application/cash-closes.repository';

const figures = {
  openingFloat: asText(cashCloses.openingFloat), cashSales: asText(cashCloses.cashSales), expectedCash: asText(cashCloses.expectedCash),
  countedCash: asText(cashCloses.countedCash), variance: asText(cashCloses.variance), note: cashCloses.note,
};

@Injectable()
export class DrizzleCashClosesRepository extends CashClosesRepository {
  constructor(@Inject(DB) private readonly db: Db) { super(); }

  async dayCutoff(branchId: string) {
    const [row] = await this.db.select({ dayCutoff: sql<string>`${branches.dayCutoff}::text` }).from(branches).where(eq(branches.id, branchId));
    return row?.dayCutoff ?? null;
  }

  async lockBranch(tx: Executor, branchId: string) {
    const [row] = await tx.select({ dayCutoff: sql<string>`${branches.dayCutoff}::text` }).from(branches).where(eq(branches.id, branchId)).for('update');
    return row ?? null;
  }

  async cashSales(exec: Executor = this.db, branchId: string, businessDate: string) {
    const [row] = await exec.select({ total: sql<string>`coalesce(sum(${sales.total}), 0)::text` }).from(sales)
      .where(and(eq(sales.branchId, branchId), eq(sales.businessDate, businessDate), eq(sales.paymentMethod, 'cash'), sql`${sales.voidedAt} is null`));
    return row.total;
  }

  async find(branchId: string, businessDate: string) {
    const [row] = await this.db.select({ id: cashCloses.id, ...figures }).from(cashCloses).where(and(eq(cashCloses.branchId, branchId), eq(cashCloses.businessDate, businessDate)));
    return row ?? null;
  }

  async insert(tx: Executor, c: CashCloseFigures & { branchId: string; businessDate: string; submittedBy: string }) {
    try {
      const [row] = await tx.insert(cashCloses).values({
        branchId: c.branchId, businessDate: c.businessDate, openingFloat: BigInt(c.openingFloat), cashSales: BigInt(c.cashSales),
        expectedCash: BigInt(c.expectedCash), countedCash: BigInt(c.countedCash), variance: BigInt(c.variance), note: c.note, submittedBy: c.submittedBy,
      }).returning({ id: cashCloses.id, branchId: cashCloses.branchId, businessDate: sql<string>`${cashCloses.businessDate}::text`, ...figures });
      return row;
    } catch (error) {
      if (pgCode(error) === UNIQUE_VIOLATION) throw new ConflictException('A cash close already exists for this business day');
      throw error;
    }
  }
}
