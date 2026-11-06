import { Inject, Injectable } from '@nestjs/common';
import { and, desc, asc, eq, sql } from 'drizzle-orm';
import { DB, Db } from '../../db/db.module';
import { inventoryItems, reorderRequests, stockMovements } from '../../db/schema';
import { Executor } from '../../db/unit-of-work';
import { asText, lockActiveItem } from '../../shared/sql';
import { ReorderStatus, ReordersRepository } from '../application/reorders.repository';

const view = {
  id: reorderRequests.id, branchId: reorderRequests.branchId, itemId: reorderRequests.itemId, itemName: inventoryItems.name, unit: inventoryItems.unit,
  quantity: asText(reorderRequests.quantity), status: reorderRequests.status, note: reorderRequests.note, requestedBy: reorderRequests.requestedBy,
  createdAt: reorderRequests.createdAt, resolvedBy: reorderRequests.resolvedBy, resolvedAt: reorderRequests.resolvedAt, movementId: stockMovements.id,
};

@Injectable()
export class DrizzleReordersRepository extends ReordersRepository {
  constructor(@Inject(DB) private readonly db: Db) { super(); }

  private select(exec: Executor) {
    return exec.select(view).from(reorderRequests).innerJoin(inventoryItems, eq(inventoryItems.id, reorderRequests.itemId))
      .leftJoin(stockMovements, eq(stockMovements.reorderRequestId, reorderRequests.id));
  }

  list(branchId: string, status: ReorderStatus | null) {
    return this.select(this.db).where(and(eq(reorderRequests.branchId, branchId), status ? eq(reorderRequests.status, status) : undefined)).orderBy(desc(reorderRequests.createdAt), asc(reorderRequests.id));
  }

  async byId(tx: Executor, branchId: string, id: string) {
    const [row] = await this.select(tx).where(and(eq(reorderRequests.id, id), eq(reorderRequests.branchId, branchId)));
    return row;
  }

  async branchExists(tx: Executor, branchId: string) {
    const rows = await tx.execute(sql`select id from branches where id = ${branchId} for key share`);
    return rows.rows.length > 0;
  }

  async insert(tx: Executor, r: { branchId: string; itemId: string; quantity: string; note: string | null; requestedBy: string }) {
    const rows = await tx.execute<{ id: string }>(sql`insert into reorder_requests (branch_id, item_id, quantity, note, requested_by)
      select ${r.branchId}, id, ${r.quantity}, ${r.note}, ${r.requestedBy} from inventory_items where id = ${r.itemId} and active returning id`);
    return rows.rows[0]?.id ?? null;
  }

  async lock(tx: Executor, branchId: string, id: string) {
    const [row] = await tx.select({ itemId: reorderRequests.itemId, quantity: asText(reorderRequests.quantity), status: reorderRequests.status })
      .from(reorderRequests).where(and(eq(reorderRequests.id, id), eq(reorderRequests.branchId, branchId))).for('update');
    return row ?? null;
  }

  async resolve(tx: Executor, id: string, status: 'received' | 'cancelled', by: string) {
    await tx.update(reorderRequests).set({ status, resolvedBy: by, resolvedAt: sql`now()` }).where(eq(reorderRequests.id, id));
  }

  async lockStock(tx: Executor, branchId: string, itemId: string) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${branchId}), hashtext(${itemId}))`);
  }

  async itemActive(tx: Executor, itemId: string) {
    return lockActiveItem(tx, itemId);
  }

  async insertReceivedMovement(tx: Executor, m: { branchId: string; itemId: string; quantity: string; createdBy: string; reorderRequestId: string }) {
    await tx.insert(stockMovements).values({ branchId: m.branchId, itemId: m.itemId, type: 'received', qtyDelta: m.quantity, note: 'Reorder received', createdBy: m.createdBy, reorderRequestId: m.reorderRequestId });
  }
}
