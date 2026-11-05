import { Inject, Injectable } from '@nestjs/common';
import { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import { PgDatabase } from 'drizzle-orm/pg-core';
import type { Db } from './db.module';
import { DB } from './tokens';

/** Anything queries can run on: the database itself or an open transaction. */
export type Executor = PgDatabase<NodePgQueryResultHKT>;

/** Runs a use case's writes in one transaction. Throwing rolls everything back. */
@Injectable()
export class UnitOfWork {
  constructor(@Inject(DB) private readonly db: Db) {}
  run<T>(work: (tx: Executor) => Promise<T>): Promise<T> {
    return this.db.transaction(tx => work(tx));
  }
}
