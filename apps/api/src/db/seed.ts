import { Pool } from 'pg';
import * as argon2 from 'argon2';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed production');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const branches = [
      ['main', 'Tigers cafe Main'], ['annex', 'Tigers cafe Annex'], ['pacol', 'Tigers cafe Pacol'],
    ];
    for (const [code, name] of branches) await pool.query('insert into branches (code, name) values ($1, $2) on conflict (code) do update set name = excluded.name', [code, name]);
    const pass = await argon2.hash(process.env.DEV_PASSWORD ?? 'tigers123', { type: argon2.argon2id });
    const people = [
      ['roy@tigerscafe.ph', 'Roy Fabay', 'owner', null],
      ['main@tigerscafe.ph', 'Mika Santos', 'manager', 'main'],
      ['annex@tigerscafe.ph', 'Paolo Reyes', 'manager', 'annex'],
      ['pacol@tigerscafe.ph', 'Liza Cruz', 'manager', 'pacol'],
    ] as const;
    for (const [email, name, role, branch] of people) {
      const result = await pool.query(`insert into users (email, password_hash, name, role) values ($1, $2, $3, $4)
        on conflict (lower(email)) do update set password_hash = excluded.password_hash, name = excluded.name, role = excluded.role, active = true returning id`, [email, pass, name, role]);
      await pool.query('delete from user_branches where user_id = $1', [result.rows[0].id]);
      if (branch) await pool.query('insert into user_branches (user_id, branch_id) select $1, id from branches where code = $2', [result.rows[0].id, branch]);
    }
    const categories = ['Coffee', 'Food', 'Pastry', 'Tea'];
    for (const category of categories) await pool.query('insert into product_categories (name) values ($1) on conflict (name) do nothing', [category]);
    const products = [
      ['Flat white', 'Coffee', 140, 74], ['Oat latte', 'Coffee', 165, 68], ['Avocado toast', 'Food', 240, 62],
      ['Cappuccino', 'Coffee', 135, 71], ['Butter croissant', 'Pastry', 110, 64], ['Iced matcha', 'Tea', 170, 66],
    ] as const;
    for (const [product, category, price, margin] of products) {
      await pool.query(`insert into products (category_id, name, price, unit_cost) select id, $1, $2, $3 from product_categories where name = $4
        on conflict (category_id, name) do nothing`, [product, price * 100, Math.round(price * (100 - margin)), category]);
    }
    for (const category of ['ingredients and supplies', 'payroll', 'rent', 'utilities', 'other']) {
      await pool.query('insert into expense_categories (name) values ($1) on conflict (name) do nothing', [category]);
    }
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
