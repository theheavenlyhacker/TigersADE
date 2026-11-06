import { and, eq } from 'drizzle-orm';
import { inventoryItems } from '../../db/schema';
import { Executor } from '../../db/unit-of-work';

/** True if the inventory item exists and is active; the share lock stops a concurrent archive until this transaction ends. */
export async function lockActiveItem(tx: Executor, itemId: string) {
  return (await tx.select({ id: inventoryItems.id }).from(inventoryItems).where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.active, true))).for('share')).length > 0;
}
