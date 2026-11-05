import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DB, Db } from '../../db/db.module';
import { branches } from '../../db/schema';
import { Executor } from '../../db/unit-of-work';
import { BranchesRepository } from '../application/branches.repository';

@Injectable()
export class DrizzleBranchesRepository extends BranchesRepository {
  constructor(@Inject(DB) private readonly db: Db) { super(); }

  async findById(id: string) {
    const [row] = await this.db.select({ id: branches.id, code: branches.code, name: branches.name, dailyTarget: sql<string | null>`${branches.dailyTarget}::text`, dayCutoff: sql<string>`${branches.dayCutoff}::text` })
      .from(branches).where(eq(branches.id, id));
    return row ?? null;
  }

  async lockSettings(tx: Executor, id: string) {
    const [row] = await tx.select({ dailyTarget: sql<string | null>`${branches.dailyTarget}::text`, dayCutoff: sql<string>`to_char(${branches.dayCutoff}, 'HH24:MI')` })
      .from(branches).where(eq(branches.id, id)).for('update');
    return row ?? null;
  }

  async setDailyTarget(tx: Executor, id: string, centavos: string) {
    await tx.update(branches).set({ dailyTarget: BigInt(centavos), updatedAt: sql`now()` }).where(eq(branches.id, id));
  }

  async setDayCutoff(tx: Executor, id: string, cutoff: string) {
    await tx.update(branches).set({ dayCutoff: cutoff, updatedAt: sql`now()` }).where(eq(branches.id, id));
  }
}
