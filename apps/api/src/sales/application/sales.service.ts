import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CurrentUser } from '../../auth/domain/current-user';
import { ActivityLog } from '../../db/activity-log';
import { UnitOfWork } from '../../db/unit-of-work';
import { businessDate } from '../../shared/business-date';
import { CLOCK, Clock } from '../../shared/clock';
import { asHttp } from '../../shared/as-http';
import { SaleLineInput, assertCanVoid, priceSale } from '../domain/sale';
import { SalesRepository } from './sales.repository';

export interface RecordSale { id: string; paymentMethod: string; lines: SaleLineInput[] }

@Injectable()
export class SalesService {
  constructor(
    private readonly repo: SalesRepository, private readonly uow: UnitOfWork, private readonly activity: ActivityLog,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Idempotent on the client-generated sale id: a retry returns the stored sale with `created: false`. */
  record(actor: CurrentUser['user'], branchId: string, input: RecordSale) {
    return this.uow.run(async tx => {
      const branch = await this.repo.lockBranch(tx, branchId);
      if (!branch) throw new NotFoundException();
      const existing = await this.repo.findSale(tx, input.id);
      if (existing) {
        if (existing.branchId !== branchId) throw new NotFoundException();
        return { sale: existing, created: false };
      }
      const saleDate = businessDate(this.clock.now(), branch.dayCutoff);
      if (await this.repo.isDayClosed(tx, branchId, saleDate)) throw new ConflictException('This business day is already closed');
      const products = await this.repo.findProducts(tx, input.lines.map(l => l.productId));
      const { lines, total } = asHttp(() => priceSale(products, input.lines));
      const saleNo = await this.repo.allocateSaleNo(tx, branchId);
      const sale = { id: input.id, branchId, saleNo, businessDate: saleDate, paymentMethod: input.paymentMethod, total: total.toString() };
      await this.repo.insertSale(tx, { ...sale, cashierId: actor.id }, lines);
      return { sale: { ...sale, lines }, created: true };
    });
  }

  void(actor: CurrentUser['user'], branchId: string, saleId: string, reason: string) {
    return this.uow.run(async tx => {
      const branch = await this.repo.lockBranch(tx, branchId);
      if (!branch) throw new NotFoundException();
      const sale = await this.repo.lockSale(tx, saleId, branchId);
      if (!sale) throw new NotFoundException('Sale not found');
      const dayClosed = await this.repo.isDayClosed(tx, branchId, sale.businessDate);
      asHttp(() => assertCanVoid({ voided: sale.voided, dayClosed }));
      const voided = await this.repo.markVoided(tx, saleId, { actorId: actor.id, at: this.clock.now(), reason });
      await this.activity.record(tx, { branchId, actorId: actor.id, action: 'sale.voided', payload: { saleId, saleNo: sale.saleNo, reason } });
      return voided;
    });
  }

  list(branchId: string, from: string, to: string) { return this.repo.list(branchId, from, to); }
}
