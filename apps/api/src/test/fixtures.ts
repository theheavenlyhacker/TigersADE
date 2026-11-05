import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';

const seedUuid = (value: string) => {
  const hex = createHash('sha256').update(value).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20)}`;
};

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_TEST_FIXTURES !== '1') throw new Error('Test fixtures are for tests only: set ALLOW_TEST_FIXTURES=1 (never in production)');
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(process.env.DATABASE_URL ?? '')) throw new Error('Test fixtures only run against a local database');
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
    const roster = [
      ['main', 'Mika Santos', 'Branch manager', '06:00', '14:00'], ['main', 'Jon Dela Cruz', 'Barista', '06:00', '14:00'],
      ['annex', 'Paolo Reyes', 'Branch manager', '07:00', '15:00'], ['annex', 'Ana Lim', 'Cashier', '14:00', '22:00'],
      ['pacol', 'Liza Cruz', 'Branch manager', '08:00', '16:00'], ['pacol', 'Ben Tan', 'Barista', '14:00', '22:00'],
    ] as const;
    for (const [code, staffName, position, start, end] of roster) {
      const staff = await pool.query(`insert into staff_members(branch_id,name,position,shift_start,shift_end)
        select id,$2,$3,$4,$5 from branches where code=$1
        on conflict do nothing returning id`, [code, staffName, position, start, end]);
      const row = staff.rows[0] ?? (await pool.query('select s.id from staff_members s join branches b on b.id=s.branch_id where b.code=$1 and s.name=$2 limit 1', [code, staffName])).rows[0];
      if (position === 'Branch manager') await pool.query('update users set staff_member_id=$1 where email=$2', [row.id, `${code}@tigerscafe.ph`]);
    }
    const cashier = await pool.query(`insert into users (email, password_hash, name, role) values ('cashier@tigerscafe.ph', $1, 'Ana Lim', 'cashier')
      on conflict (lower(email)) do update set password_hash=excluded.password_hash, name=excluded.name, role=excluded.role, active=true returning id`, [pass]);
    await pool.query('delete from user_branches where user_id = $1', [cashier.rows[0].id]);
    await pool.query('insert into user_branches (user_id, branch_id) select $1, id from branches where code = $2', [cashier.rows[0].id, 'main']);
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
    const productRows = await pool.query('select id, name, price, unit_cost from products where active order by name');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const todayUtc = Date.parse(`${today}T00:00:00Z`);
    for (const [code] of branches) {
      const branch = await pool.query('select id from branches where code = $1', [code]);
      const hasSales = await pool.query('select 1 from sales where branch_id = $1 limit 1', [branch.rows[0].id]);
      if (hasSales.rowCount) continue;
      for (let daysAgo = 59; daysAgo >= 0; daysAgo--) {
        const businessDate = new Date(todayUtc - daysAgo * 86400000).toISOString().slice(0, 10);
        const saleId = seedUuid(`seed-sale:${code}:${businessDate}`);
        const saleNo = 60 - daysAgo;
        const item = productRows.rows[saleNo % productRows.rows.length];
        const qty = 1 + saleNo % 3;
        const sale = await pool.query(`insert into sales (id, branch_id, sale_no, business_date, payment_method, total, cashier_id)
          values ($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing returning id`, [saleId, branch.rows[0].id, saleNo, businessDate, ['cash', 'gcash', 'maya', 'card'][saleNo % 4], BigInt(item.price) * BigInt(qty), cashier.rows[0].id]);
        if (sale.rowCount) await pool.query(`insert into sale_lines (sale_id, product_id, product_name, unit_price, unit_cost, qty)
          values ($1,$2,$3,$4,$5,$6)`, [saleId, item.id, item.name, item.price, item.unit_cost, qty]);
      }
      await pool.query('update branches set next_sale_no = greatest(next_sale_no, 61) where id = $1', [branch.rows[0].id]);
    }
    for (const category of ['ingredients and supplies', 'payroll', 'rent', 'utilities', 'other']) {
      await pool.query('insert into expense_categories (name) values ($1) on conflict (name) do nothing', [category]);
    }
    const stock = [
      ['Espresso beans', 'kg', 180000, 'main', 42, 30], ['Espresso beans', 'kg', 180000, 'annex', 25, 25], ['Espresso beans', 'kg', 180000, 'pacol', 9, 25],
      ['Oat milk', 'L', 8500, 'main', 12, 40], ['Oat milk', 'L', 8500, 'pacol', 8, 30],
      ['Croissant dough', 'pcs', 5500, 'main', 90, 80], ['Matcha powder', 'kg', 420000, 'annex', 3, 6],
      ['Avocados', 'pcs', 6500, 'annex', 18, 30], ['Paper cups', 'pcs', 120, 'pacol', 600, 500],
    ] as const;
    for (const [name, unit, cost, code, onHand, par] of stock) {
      await pool.query('insert into inventory_items (name, unit, unit_cost) values ($1,$2,$3) on conflict (name) do update set unit=excluded.unit, unit_cost=excluded.unit_cost, active=true', [name, unit, cost]);
      const opening = await pool.query(`insert into branch_inventory (branch_id,item_id,par) select b.id,i.id,$3 from branches b cross join inventory_items i
        where b.code=$1 and i.name=$2 on conflict (branch_id,item_id) do nothing returning branch_id,item_id`, [code, name, String(par)]);
      if (opening.rowCount) {
        const actor = await pool.query('select id from users where email=$1', [`${code}@tigerscafe.ph`]);
        const movement = await pool.query(`insert into stock_movements (branch_id,item_id,type,qty_delta,note,created_by)
          select $1,$2,'adjustment',$3,'Opening stock from prototype',$4 returning id`, [opening.rows[0].branch_id, opening.rows[0].item_id, String(onHand), actor.rows[0].id]);
        await pool.query(`insert into activity_log (branch_id,actor_id,action,payload) values ($1,$2,'stock.moved',$3::jsonb)`, [opening.rows[0].branch_id, actor.rows[0].id, JSON.stringify({ movementId: movement.rows[0].id, itemId: opening.rows[0].item_id, type: 'adjustment', qtyDelta: String(onHand), note: 'Opening stock from prototype' })]);
      }
    }
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
