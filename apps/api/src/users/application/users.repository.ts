import { Role } from '../../auth/domain/current-user';
import { Executor } from '../../db/unit-of-work';

export interface UserView { id: string; email: string; name: string; role: Role; active: boolean; staffMemberId: string | null }
export interface NewUser { email: string; passwordHash: string; name: string; role: Role; staffMemberId: string | null }

export abstract class UsersRepository {
  abstract list(): Promise<Array<UserView & { branchIds: string[] }>>;
  /** Branch of an active staff member, or null if there is none. */
  abstract activeStaffBranch(tx: Executor, staffMemberId: string): Promise<string | null>;
  abstract insert(tx: Executor, user: NewUser): Promise<UserView>;
  abstract replaceBranches(tx: Executor, userId: string, branchIds: string[]): Promise<void>;
  /** Current role and branch ids, or null if the user does not exist. */
  abstract current(tx: Executor, id: string): Promise<{ role: Role; branchIds: string[] } | null>;
  abstract updateRole(tx: Executor, id: string, role: Role, staff: { set: boolean; staffMemberId: string | null }): Promise<void>;
  abstract deactivate(tx: Executor, id: string): Promise<{ id: string; email: string } | null>;
  abstract deleteSessions(tx: Executor, userId: string): Promise<void>;
  abstract setPassword(tx: Executor, id: string, passwordHash: string): Promise<boolean>;
}
