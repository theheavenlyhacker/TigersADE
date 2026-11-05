export interface ActivityItem {
  id: string; branchId: string | null; branchName: string | null; actorId: string; actorName: string;
  action: string; payload: unknown; createdAt: Date;
}

export abstract class ActivityRepository {
  /** Newest first; `before` is the id of the last entry already seen. */
  abstract list(branchIds: string[], before: string | null, limit: number): Promise<ActivityItem[]>;
}
