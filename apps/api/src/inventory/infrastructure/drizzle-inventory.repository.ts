import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { DB, Db } from '../../db/db.module';
import { branchInventory, inventoryItems, stockMovements } from '../../db/schema';
import { Executor } from '../../db/unit-of-work';
import { orConflict } from '../../shared/pg-error';
import { asText } from '../../shared/sql';
import { lockActiveItem } from './active-item';
import { InventoryRepository, ItemView } from '../application/inventory.repository';

const itemView = { id: inventoryItems.id, name: inventoryItems.name, unit: inventoryItems.unit, unitCost: asText(inventoryItems.unitCost), active: inventoryItems.active };
const movementView = {
  id: stockMovements.id, branchId: stockMovements.branchId, itemId: stockMovements.itemId, type: stockMovements.type,
  qtyDelta: asText(stockMovements.qtyDelta), note: stockMovements.note, createdBy: stockMovements.createdBy, createdAt: stockMovements.createdAt,
};

const uniqueName = <T>(work: Promise<T>) => orConflict(work, () => new UnprocessableEntityException('An inventory item with this name already exists'));

@Injectable()
export class DrizzleInventoryRepository extends InventoryRepository {
  constructor(@Inject(DB) private readonly db: Db) { super(); }

  listItems() { return this.db.select(itemView).from(inventoryItems).orderBy(asc(inventoryItems.name)); }

  async insertItem(tx: Executor, item: { name: string; unit: string; unitCost: string }) {
    const [row] = await uniqueName(tx.insert(inventoryItems).values({ name: item.name, unit: item.unit, unitCost: BigInt(item.unitCost) }).returning(itemView));
    return row;
  }

  async lockItem(tx: Executor, id: string) {
    const [row] = await tx.select(itemView).from(inventoryItems).where(eq(inventoryItems.id, id)).for('update');
    return row ?? null;
  }

  async saveItem(tx: Executor, id: string, item: ItemView) {
    const [row] = await uniqueName(tx.update(inventoryItems).set({ name: item.name, unit: item.unit, unitCost: BigInt(item.unitCost), active: item.active }).where(eq(inventoryItems.id, id)).returning(itemView));
    return row;
  }

  async branchStock(branchId: string) {
    const onHand = sql<string>`coalesce(sum(${stockMovements.qtyDelta}), 0)::text`;
    return this.db.select({
      itemId: inventoryItems.id, name: inventoryItems.name, unit: inventoryItems.unit, unitCost: asText(inventoryItems.unitCost),
      par: sql<string | null>`${branchInventory.par}::text`, onHand,
      value: sql<string>`round(coalesce(sum(${stockMovements.qtyDelta}), 0) * ${inventoryItems.unitCost})::text`,
    }).from(inventoryItems)
      .leftJoin(branchInventory, and(eq(branchInventory.itemId, inventoryItems.id), eq(branchInventory.branchId, branchId)))
      .leftJoin(stockMovements, and(eq(stockMovements.itemId, inventoryItems.id), eq(stockMovements.branchId, branchId)))
      .where(eq(inventoryItems.active, true)).groupBy(inventoryItems.id, branchInventory.par).orderBy(asc(inventoryItems.name));
  }

  async setPar(tx: Executor, branchId: string, itemId: string, par: string) {
    const [before] = await tx.select({ par: sql<string>`${branchInventory.par}::text` }).from(branchInventory)
      .where(and(eq(branchInventory.branchId, branchId), eq(branchInventory.itemId, itemId))).for('update');
    const rows = await tx.execute<{ par: string }>(sql`insert into branch_inventory (branch_id, item_id, par) select ${branchId}, id, ${par} from inventory_items where id = ${itemId} and active
      on conflict (branch_id, item_id) do update set par = excluded.par returning par::text`);
    return rows.rows.length ? { before: before?.par ?? null, after: rows.rows[0].par } : null;
  }

  async lockStock(tx: Executor, branchId: string, itemId: string) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${branchId}), hashtext(${itemId}))`);
  }

  async activeItemExists(tx: Executor, itemId: string) {
    return lockActiveItem(tx, itemId);
  }

  async onHand(tx: Executor, branchId: string, itemId: string) {
    const [row] = await tx.select({ onHand: sql<string>`coalesce(sum(${stockMovements.qtyDelta}), 0)::text` }).from(stockMovements)
      .where(and(eq(stockMovements.branchId, branchId), eq(stockMovements.itemId, itemId)));
    return row.onHand;
  }

  async insertMovement(tx: Executor, m: { branchId: string; itemId: string; type: 'received' | 'wastage' | 'adjustment' | 'count'; qtyDelta: string; note: string | null; createdBy: string }) {
    const [row] = await tx.insert(stockMovements).values(m).returning(movementView);
    return row;
  }

  listMovements(branchId: string, itemId: string | null) {
    return this.db.select({ ...movementView, itemName: inventoryItems.name, reorderRequestId: stockMovements.reorderRequestId })
      .from(stockMovements).innerJoin(inventoryItems, eq(inventoryItems.id, stockMovements.itemId))
      .where(and(eq(stockMovements.branchId, branchId), itemId ? eq(stockMovements.itemId, itemId) : undefined))
      .orderBy(desc(stockMovements.createdAt), asc(stockMovements.id));
  }
}
