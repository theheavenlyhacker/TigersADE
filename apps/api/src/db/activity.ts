import { PoolClient } from 'pg';

export function logActivity(client: PoolClient, entry: {
  branchId: string | null;
  actorId: string;
  action: string;
  payload: Record<string, unknown>;
}) {
  return client.query(
    'insert into activity_log (branch_id, actor_id, action, payload) values ($1, $2, $3, $4)',
    [entry.branchId, entry.actorId, entry.action, JSON.stringify(entry.payload)],
  );
}
