import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ActivityLog } from '../../db/activity-log';
import { UnitOfWork } from '../../db/unit-of-work';
import { BranchesRepository } from './branches.repository';

export type BranchSettingChange = { dailyTarget?: string; dayCutoff?: string };

@Injectable()
export class BranchesService {
  constructor(private readonly repo: BranchesRepository, private readonly uow: UnitOfWork, private readonly activity: ActivityLog) {}

  async get(id: string) {
    const branch = await this.repo.findById(id);
    if (!branch) throw new NotFoundException();
    return branch;
  }

  /** Only the owner changes a target or cutoff; exactly one per request. Changes are logged. */
  async changeSetting(actorId: string, id: string, change: BranchSettingChange) {
    const field = (['dailyTarget', 'dayCutoff'] as const).filter(key => change[key] !== undefined);
    if (field.length !== 1) throw new UnprocessableEntityException('Set dailyTarget or dayCutoff');
    const key = field[0];
    const after = change[key]!;
    return this.uow.run(async tx => {
      const current = await this.repo.lockSettings(tx, id);
      if (!current) throw new NotFoundException();
      if (current[key] !== after) {
        if (key === 'dailyTarget') await this.repo.setDailyTarget(tx, id, after); else await this.repo.setDayCutoff(tx, id, after);
        await this.activity.record(tx, { branchId: id, actorId, action: key === 'dailyTarget' ? 'branch.target_changed' : 'branch.cutoff_changed', payload: { [key]: { before: current[key], after } } });
      }
      return { id, [key]: after };
    });
  }
}
