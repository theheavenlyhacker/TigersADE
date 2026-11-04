import { Pool } from 'pg';

export async function catalogVersion(pool: Pool) {
  const result = await pool.query(`select to_char(max(updated_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as version from (
    select updated_at from branches union all select updated_at from products
    union all select updated_at from product_categories union all select updated_at from expense_categories
  ) catalog_updates`);
  return result.rows[0].version ?? new Date(0).toISOString();
}
