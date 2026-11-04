import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { branches } from './schema';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await drizzle(pool).insert(branches).values([
    { id: 'main', name: 'Tigers cafe Main', today: 107000, week: 752500, mtd: 1798000, target: 100000 },
    { id: 'annex', name: 'Tigers cafe Annex', today: 78750, week: 535000, mtd: 1372500, target: 80000 },
    { id: 'pacol', name: 'Tigers cafe Pacol', today: 66000, week: 435000, mtd: 1142500, target: 70000 },
  ]).onConflictDoNothing();
  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
