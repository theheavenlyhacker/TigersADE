import { Executor } from '../../db/unit-of-work';

export interface BranchView { id: string; code: string; name: string; dailyTarget: string | null; dayCutoff: string }
export interface BranchSettings { dailyTarget: string | null; dayCutoff: string }

export abstract class BranchesRepository {
  abstract findById(id: string): Promise<BranchView | null>;
  /** Locks the branch row and returns its settings ("HH:MM" cutoff), or null if it does not exist. */
  abstract lockSettings(tx: Executor, id: string): Promise<BranchSettings | null>;
  abstract setDailyTarget(tx: Executor, id: string, centavos: string): Promise<void>;
  abstract setDayCutoff(tx: Executor, id: string, cutoff: string): Promise<void>;
}
