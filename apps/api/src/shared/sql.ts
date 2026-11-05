import { sql } from 'drizzle-orm';

/** Postgres bigint/numeric column as a string, so JSON never loses precision. */
export const asText = (column: object) => sql<string>`${column}::text`;
export const INT8_MAX = 9223372036854775807n;

/** A Postgres array literal built from bound parameters (Drizzle expands raw JS arrays into a list instead). */
export const pgArray = (values: string[], type: 'uuid' | 'date') =>
  values.length ? sql`array[${sql.join(values.map(v => sql`${v}`), sql`, `)}]::${sql.raw(type)}[]` : sql`'{}'::${sql.raw(type)}[]`;
