import { Global, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export const DB = Symbol('DB');
export const DB_POOL = Symbol('DB_POOL');
export type Db = NodePgDatabase;

class DbLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  onApplicationShutdown() {
    return this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DB_POOL,
      useFactory: () => new Pool({ connectionString: process.env.DATABASE_URL }),
    },
    { provide: DB, useFactory: (pool: Pool): Db => drizzle(pool), inject: [DB_POOL] },
    DbLifecycle,
  ],
  exports: [DB, DB_POOL],
})
export class DbModule {}
