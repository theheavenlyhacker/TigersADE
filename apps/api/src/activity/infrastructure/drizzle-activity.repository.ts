import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { DB, Db } from '../../db/db.module';
import { activityLog, branches, users } from '../../db/schema';
import { ActivityRepository } from '../application/activity.repository';

@Injectable()
export class DrizzleActivityRepository extends ActivityRepository {
  constructor(@Inject(DB) private readonly db: Db) { super(); }

  async list(branchIds: string[], before: string | null, limit: number) {
    if (!branchIds.length) return [];
    const cursor = before === null ? undefined : or(
      lt(activityLog.createdAt, sql`(select created_at from activity_log where id = ${before}::bigint)`),
      and(eq(activityLog.createdAt, sql`(select created_at from activity_log where id = ${before}::bigint)`), lt(activityLog.id, BigInt(before))),
    );
    return this.db.select({
      id: sql<string>`${activityLog.id}::text`, branchId: activityLog.branchId, branchName: branches.name,
      actorId: activityLog.actorId, actorName: users.name, action: activityLog.action, payload: activityLog.payload, createdAt: activityLog.createdAt,
    }).from(activityLog).innerJoin(users, eq(users.id, activityLog.actorId)).leftJoin(branches, eq(branches.id, activityLog.branchId))
      .where(and(inArray(activityLog.branchId, branchIds), cursor)).orderBy(desc(activityLog.createdAt), desc(activityLog.id)).limit(limit);
  }
}
