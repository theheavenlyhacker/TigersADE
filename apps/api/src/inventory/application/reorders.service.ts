import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ActivityLog } from '../../db/activity-log';
import { UnitOfWork } from '../../db/unit-of-work';
import { asHttp } from '../../shared/as-http';
import { movementDelta } from '../domain/stock';
import { ReorderStatus, ReordersRepository } from './reorders.repository';

@Injectable()
export class ReordersService {
  constructor(private readonly repo: ReordersRepository, private readonly uow: UnitOfWork, private readonly activity: ActivityLog) {}

  list(branchId: string, status: ReorderStatus | null) { return this.repo.list(branchId, status); }

  request(actorId: string, branchId: string, input: { itemId: string; quantity: string; note?: string | null }) {
    asHttp(() => movementDelta('received', input.quantity, '0')); // rejects zero and negative quantities
    return this.uow.run(async tx => {
      if (!(await this.repo.branchExists(tx, branchId))) throw new NotFoundException();
      const id = await this.repo.insert(tx, { branchId, itemId: input.itemId, quantity: input.quantity, note: input.note ?? null, requestedBy: actorId });
      if (!id) throw new NotFoundException('Active inventory item not found');
      const request = await this.repo.byId(tx, branchId, id);
      await this.activity.record(tx, { branchId, actorId, action: 'reorder.requested', payload: { request } });
      return request;
    });
  }

  /** Receiving records a `received` stock movement linked to the request; cancelling records nothing. */
  resolve(actorId: string, branchId: string, requestId: string, status: 'received' | 'cancelled') {
    return this.uow.run(async tx => {
      const current = await this.repo.lock(tx, branchId, requestId);
      if (!current) throw new NotFoundException('Reorder request not found');
      if (current.status !== 'requested') throw new ConflictException(`Reorder request is already ${current.status}`);
      await this.repo.resolve(tx, requestId, status, actorId);
      if (status === 'received') {
        await this.repo.lockStock(tx, branchId, current.itemId);
        if (!(await this.repo.itemActive(tx, current.itemId))) throw new ConflictException('Inventory item is archived');
        await this.repo.insertReceivedMovement(tx, { branchId, itemId: current.itemId, quantity: current.quantity, createdBy: actorId, reorderRequestId: requestId });
      }
      const request = await this.repo.byId(tx, branchId, requestId);
      await this.activity.record(tx, { branchId, actorId, action: `reorder.${status}`, payload: { request } });
      return request;
    });
  }
}
