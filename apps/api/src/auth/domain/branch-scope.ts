import { DomainError } from '../../shared/domain-error';
import { CurrentUser } from './current-user';

/**
 * Which branches a report or listing may cover. `all` is for the owner only;
 * a single id must be one the user can see; omitted means every branch they can see.
 */
export function branchScope(current: CurrentUser, branch?: string): string[] {
  if (branch === undefined) return current.branches.map(b => b.id);
  if (branch === 'all') {
    if (current.user.role !== 'owner') throw new DomainError('forbidden', 'Forbidden');
    return current.branches.map(b => b.id);
  }
  if (!current.branches.some(b => b.id === branch)) throw new DomainError('forbidden', 'Forbidden');
  return [branch];
}
