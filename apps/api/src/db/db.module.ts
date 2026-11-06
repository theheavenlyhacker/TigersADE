import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ActivityLog } from './activity-log';
import { DB, DB_POOL } from './tokens';
import { UnitOfWork } from './unit-of-work';

export { DB, DB_POOL };
export type Db = NodePgDatabase;

class DbLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}
  onApplicationShutdown() { return this.pool.end(); }
}

@Global()
@Module({
  providers: [
    { provide: DB_POOL, useFactory: () => new Pool({ connectionString: process.env.DATABASE_URL }) },
    { provide: DB, useFactory: (pool: Pool): Db => drizzle(pool), inject: [DB_POOL] },
    DbLifecycle, UnitOfWork, ActivityLog,
  ],
  exports: [DB, UnitOfWork, ActivityLog],
})
export class DbModule {}
