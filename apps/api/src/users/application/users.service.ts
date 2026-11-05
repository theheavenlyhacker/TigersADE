import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Role } from '../../auth/domain/current-user';
import { ActivityLog } from '../../db/activity-log';
import { asHttp } from '../../shared/as-http';
import { Executor, UnitOfWork } from '../../db/unit-of-work';
import { assertBranchAssignment, assertStaffLink } from '../domain/user-rules';
import { UsersRepository } from './users.repository';

export interface CreateUser { email: string; name: string; password: string; role: Role; branchIds: string[]; staffMemberId?: string | null }
export interface ChangeUser { role: Role; branchIds: string[]; staffMemberId?: string | null }

const hash = (password: string) => argon2.hash(password, { type: argon2.argon2id });

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository, private readonly uow: UnitOfWork, private readonly activity: ActivityLog) {}

  list() { return this.repo.list(); }

  async create(actorId: string, input: CreateUser) {
    asHttp(() => assertBranchAssignment(input.role, input.branchIds));
    const branchIds = [...new Set(input.branchIds)];
    const passwordHash = await hash(input.password);
    return this.uow.run(async tx => {
      await this.checkStaffLink(tx, input.role, branchIds, input.staffMemberId);
      const user = await this.repo.insert(tx, { email: input.email, passwordHash, name: input.name, role: input.role, staffMemberId: input.staffMemberId || null });
      await this.repo.replaceBranches(tx, user.id, branchIds);
      await this.activity.record(tx, { branchId: null, actorId, action: 'user.created', payload: { userId: user.id, email: input.email, role: input.role } });
      return user;
    });
  }

  async change(id: string, input: ChangeUser) {
    asHttp(() => assertBranchAssignment(input.role, input.branchIds));
    const branchIds = [...new Set(input.branchIds)];
    await this.uow.run(async tx => {
      await this.checkStaffLink(tx, input.role, branchIds, input.staffMemberId);
      const staff = { set: input.staffMemberId !== undefined, staffMemberId: input.staffMemberId || null };
      if (!(await this.repo.updateRole(tx, id, input.role, staff))) throw new NotFoundException();
      await this.repo.replaceBranches(tx, id, branchIds);
    });
    return { id, role: input.role, branchIds: input.branchIds };
  }

  /** Deactivating ends every session the user has. */
  async deactivate(actorId: string, id: string) {
    if (actorId === id) throw new ConflictException('You cannot deactivate your own account');
    await this.uow.run(async tx => {
      const user = await this.repo.deactivate(tx, id);
      if (!user) throw new NotFoundException();
      await this.repo.deleteSessions(tx, id);
      await this.activity.record(tx, { branchId: null, actorId, action: 'user.deactivated', payload: { userId: id, email: user.email } });
    });
    return { id, active: false };
  }

  /** A reset ends every session the user has, like deactivating. */
  async resetPassword(id: string, password: string) {
    const passwordHash = await hash(password);
    await this.uow.run(async tx => {
      if (!(await this.repo.setPassword(tx, id, passwordHash))) throw new NotFoundException();
      await this.repo.deleteSessions(tx, id);
    });
    return { id };
  }

  private async checkStaffLink(tx: Executor, role: Role, branchIds: string[], staffMemberId?: string | null) {
    if (staffMemberId) {
      const staffBranch = await this.repo.activeStaffBranch(tx, staffMemberId);
      asHttp(() => assertStaffLink(role, branchIds, staffBranch));
    }
  }
}
