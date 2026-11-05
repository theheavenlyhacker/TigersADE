import { Executor } from '../../db/unit-of-work';
import { MovementType } from '../domain/stock';

export interface ItemView { id: string; name: string; unit: string; unitCost: string; active: boolean }
export interface BranchStockRow { itemId: string; name: string; unit: string; unitCost: string; par: string | null; onHand: string; value: string }
export interface MovementView { id: string; branchId: string; itemId: string; type: MovementType; qtyDelta: string; note: string | null; createdBy: string; createdAt: Date }

export abstract class InventoryRepository {
  abstract listItems(): Promise<ItemView[]>;
  /** A duplicate name raises UnprocessableEntityException. */
  abstract insertItem(tx: Executor, item: { name: string; unit: string; unitCost: string }): Promise<ItemView>;
  abstract lockItem(tx: Executor, id: string): Promise<ItemView | null>;
  abstract saveItem(tx: Executor, id: string, item: ItemView): Promise<ItemView>;

  abstract branchStock(branchId: string): Promise<BranchStockRow[]>;
  /** Sets the par for an active item at a branch. Returns null if there is no such active item. */
  abstract setPar(tx: Executor, branchId: string, itemId: string, par: string): Promise<{ before: string | null; after: string } | null>;

  /** Serialises stock changes for one (branch, item). */
  abstract lockStock(tx: Executor, branchId: string, itemId: string): Promise<void>;
  abstract activeItemExists(tx: Executor, itemId: string): Promise<boolean>;
  abstract onHand(tx: Executor, branchId: string, itemId: string): Promise<string>;
  abstract insertMovement(tx: Executor, movement: { branchId: string; itemId: string; type: MovementType; qtyDelta: string; note: string | null; createdBy: string }): Promise<MovementView>;
  abstract listMovements(branchId: string, itemId: string | null): Promise<Array<MovementView & { itemName: string; reorderRequestId: string | null }>>;
}
