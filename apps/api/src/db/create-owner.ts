import { Pool } from 'pg';
import * as argon2 from 'argon2';

/** First-run setup on an empty database: one branch and one owner login. Re-running only adds what is missing. */
async function main() {
  const { OWNER_EMAIL, OWNER_NAME = 'Owner', OWNER_PASSWORD, BRANCH_CODE = 'main', BRANCH_NAME = 'Main' } = process.env;
  if (!OWNER_EMAIL || !OWNER_PASSWORD || OWNER_PASSWORD.length < 8) throw new Error('Set OWNER_EMAIL and OWNER_PASSWORD (at least 8 characters)');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query('insert into branches (code, name) values ($1, $2) on conflict (code) do nothing', [BRANCH_CODE, BRANCH_NAME]);
    await pool.query(`insert into expense_categories (name) select unnest($1::text[]) on conflict (name) do nothing`, [['Ingredients and supplies', 'Payroll', 'Rent', 'Utilities', 'Other']]);
    const hash = await argon2.hash(OWNER_PASSWORD, { type: argon2.argon2id });
    const created = await pool.query(`insert into users (email, password_hash, name, role) values ($1, $2, $3, 'owner') on conflict (lower(email)) do nothing returning id`, [OWNER_EMAIL, hash, OWNER_NAME]);
    console.log(created.rowCount ? `Created owner ${OWNER_EMAIL}` : `${OWNER_EMAIL} already exists; nothing changed`);
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
