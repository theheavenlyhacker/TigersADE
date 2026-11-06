import { Injectable } from '@nestjs/common';
import { activityLog } from './schema';
import { Executor } from './unit-of-work';

export interface ActivityEntry {
  branchId: string | null;
  actorId: string;
  action: string;
  payload: Record<string, unknown>;
}

/** The one place the activity log is written, always inside the caller's transaction. */
@Injectable()
export class ActivityLog {
  async record(tx: Executor, entry: ActivityEntry) {
    await tx.insert(activityLog).values(entry);
  }
}
