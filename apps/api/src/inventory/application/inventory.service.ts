import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityLog } from '../../db/activity-log';
import { UnitOfWork } from '../../db/unit-of-work';
import { MovementType, isLowStock, isNegativeStock, movementDelta } from '../domain/stock';
import { InventoryRepository, ItemView } from './inventory.repository';

@Injectable()
export class InventoryService {
  constructor(private readonly repo: InventoryRepository, private readonly uow: UnitOfWork, private readonly activity: ActivityLog) {}

  listItems() { return this.repo.listItems(); }

  createItem(actorId: string, input: { name: string; unit: string; unitCost: string }) {
    return this.uow.run(async tx => {
      const item = await this.repo.insertItem(tx, input);
      await this.activity.record(tx, { branchId: null, actorId, action: 'inventory_item.created', payload: { itemId: item.id, after: item } });
      return item;
    });
  }

  changeItem(actorId: string, id: string, change: { name?: string; unit?: string; unitCost?: string; active?: false }) {
    return this.uow.run(async tx => {
      const before = await this.repo.lockItem(tx, id);
      if (!before) throw new NotFoundException();
      const next: ItemView = { ...before, name: change.name ?? before.name, unit: change.unit ?? before.unit, unitCost: change.unitCost ?? before.unitCost, active: change.active === false ? false : before.active };
      const after = await this.repo.saveItem(tx, id, next);
      await this.activity.record(tx, { branchId: null, actorId, action: change.active === false ? 'inventory_item.archived' : 'inventory_item.updated', payload: { itemId: id, before, after } });
      return after;
    });
  }

  /** Stock on hand is the sum of movements; low stock is below par; stock may go negative. */
  async branchStock(branchId: string, lowOnly: boolean) {
    const rows = (await this.repo.branchStock(branchId)).map(row => ({ ...row, lowStock: isLowStock(row.onHand, row.par), negativeStock: isNegativeStock(row.onHand) }));
    return lowOnly ? rows.filter(row => row.lowStock || row.negativeStock) : rows;
  }

  setPar(actorId: string, branchId: string, itemId: string, par: string) {
    return this.uow.run(async tx => {
      const result = await this.repo.setPar(tx, branchId, itemId, par);
      if (!result) throw new NotFoundException('Active inventory item not found');
      await this.activity.record(tx, { branchId, actorId, action: 'inventory.par_set', payload: { itemId, par: result } });
      return { branchId, itemId, par: result.after };
    });
  }

  listMovements(branchId: string, itemId: string | null) { return this.repo.listMovements(branchId, itemId); }

  recordMovement(actorId: string, branchId: string, input: { itemId: string; type: MovementType; quantity: string; note?: string | null }) {
    return this.uow.run(async tx => {
      await this.repo.lockStock(tx, branchId, input.itemId);
      if (!(await this.repo.activeItemExists(tx, input.itemId))) throw new NotFoundException('Active inventory item not found');
      const onHand = input.type === 'count' ? await this.repo.onHand(tx, branchId, input.itemId) : '0';
      const movement = await this.repo.insertMovement(tx, { branchId, itemId: input.itemId, type: input.type, qtyDelta: movementDelta(input.type, input.quantity, onHand), note: input.note ?? null, createdBy: actorId });
      await this.activity.record(tx, { branchId, actorId, action: 'stock.moved', payload: { movement } });
      return movement;
    });
  }
}
