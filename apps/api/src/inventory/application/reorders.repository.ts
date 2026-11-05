import { Executor } from '../../db/unit-of-work';

export type ReorderStatus = 'requested' | 'received' | 'cancelled';
export interface ReorderView {
  id: string; branchId: string; itemId: string; itemName: string; unit: string; quantity: string; status: ReorderStatus; note: string | null;
  requestedBy: string; createdAt: Date; resolvedBy: string | null; resolvedAt: Date | null; movementId: string | null;
}

export abstract class ReordersRepository {
  abstract list(branchId: string, status: ReorderStatus | null): Promise<ReorderView[]>;
  abstract byId(tx: Executor, branchId: string, id: string): Promise<ReorderView>;
  abstract branchExists(tx: Executor, branchId: string): Promise<boolean>;
  /** Inserts only for an active item; returns the new id or null. */
  abstract insert(tx: Executor, r: { branchId: string; itemId: string; quantity: string; note: string | null; requestedBy: string }): Promise<string | null>;
  abstract lock(tx: Executor, branchId: string, id: string): Promise<{ itemId: string; quantity: string; status: ReorderStatus } | null>;
  abstract resolve(tx: Executor, id: string, status: 'received' | 'cancelled', by: string): Promise<void>;
  /** Serialises with other stock changes for the same (branch, item). */
  abstract lockStock(tx: Executor, branchId: string, itemId: string): Promise<void>;
  abstract insertReceivedMovement(tx: Executor, m: { branchId: string; itemId: string; quantity: string; createdBy: string; reorderRequestId: string }): Promise<void>;
}
