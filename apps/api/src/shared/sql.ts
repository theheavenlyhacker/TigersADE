import { and, eq, sql } from 'drizzle-orm';
import { inventoryItems } from '../db/schema';
import { Executor } from '../db/unit-of-work';

/** Postgres bigint/numeric column as a string, so JSON never loses precision. */
export const asText = (column: object) => sql<string>`${column}::text`;

/** A Postgres array literal built from bound parameters (Drizzle expands raw JS arrays into a list instead). */
export const pgArray = (values: string[], type: 'uuid' | 'date') =>
  values.length ? sql`array[${sql.join(values.map(v => sql`${v}`), sql`, `)}]::${sql.raw(type)}[]` : sql`'{}'::${sql.raw(type)}[]`;

/** True if the inventory item exists and is active; the share lock stops a concurrent archive until this transaction ends. */
export async function lockActiveItem(tx: Executor, itemId: string) {
  return (await tx.select({ id: inventoryItems.id }).from(inventoryItems).where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.active, true))).for('share')).length > 0;
}
