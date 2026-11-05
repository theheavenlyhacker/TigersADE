import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityLog } from '../../db/activity-log';
import { UnitOfWork } from '../../db/unit-of-work';
import { businessDate as currentBusinessDate } from '../../shared/business-date';
import { CLOCK, Clock } from '../../shared/clock';
import { asHttp } from '../../shared/domain-error';
import { assertDayHasStarted, reconcile } from '../domain/cash-close';
import { CashClosesRepository } from './cash-closes.repository';

@Injectable()
export class CashClosesService {
  constructor(
    private readonly repo: CashClosesRepository, private readonly uow: UnitOfWork, private readonly activity: ActivityLog,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async preview(branchId: string, requestedDate?: string) {
    const cutoff = await this.repo.dayCutoff(branchId);
    if (cutoff === null) throw new NotFoundException();
    const businessDate = requestedDate ?? currentBusinessDate(this.clock.now(), cutoff);
    const [cashSales, close] = await Promise.all([this.repo.cashSales(undefined, branchId, businessDate), this.repo.find(branchId, businessDate)]);
    return { businessDate, cashSales, close };
  }

  /** The close is computed and stored at submit time and can never change; after it, no more sales for that day. */
  submit(actorId: string, branchId: string, input: { businessDate: string; openingFloat: string; countedCash: string; note?: string }) {
    return this.uow.run(async tx => {
      const branch = await this.repo.lockBranch(tx, branchId);
      if (!branch) throw new NotFoundException();
      asHttp(() => assertDayHasStarted(input.businessDate, currentBusinessDate(this.clock.now(), branch.dayCutoff)));
      const cashSales = await this.repo.cashSales(tx, branchId, input.businessDate);
      const { expectedCash, variance } = asHttp(() => reconcile(BigInt(input.openingFloat), BigInt(cashSales), BigInt(input.countedCash)));
      const close = await this.repo.insert(tx, {
        branchId, businessDate: input.businessDate, openingFloat: input.openingFloat, cashSales, expectedCash: expectedCash.toString(),
        countedCash: input.countedCash, variance: variance.toString(), note: input.note ?? null, submittedBy: actorId,
      });
      await this.activity.record(tx, { branchId, actorId, action: 'cash_close.submitted', payload: { ...close } });
      return close;
    });
  }
}
