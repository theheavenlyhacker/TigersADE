import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DB, Db } from '../../db/db.module';
import { sessions, staffMembers, userBranches, users } from '../../db/schema';
import { Executor } from '../../db/unit-of-work';
import { translatePgWrite } from '../../shared/pg-error';
import { NewUser, UsersRepository } from '../application/users.repository';

const view = { id: users.id, email: users.email, name: users.name, role: users.role, active: users.active, staffMemberId: users.staffMemberId };

const translate = (error: unknown) => translatePgWrite(error, 'Email already exists');

@Injectable()
export class DrizzleUsersRepository extends UsersRepository {
  constructor(@Inject(DB) private readonly db: Db) { super(); }

  async list() {
    const rows = await this.db.select({ ...view, branchIds: sql<string[]>`coalesce(json_agg(${userBranches.branchId}) filter (where ${userBranches.branchId} is not null), '[]')` })
      .from(users).leftJoin(userBranches, eq(userBranches.userId, users.id)).groupBy(users.id).orderBy(asc(users.name));
    return rows;
  }

  async activeStaffBranch(tx: Executor, staffMemberId: string) {
    const [row] = await tx.select({ branchId: staffMembers.branchId }).from(staffMembers).where(and(eq(staffMembers.id, staffMemberId), eq(staffMembers.active, true)));
    return row?.branchId ?? null;
  }

  async insert(tx: Executor, user: NewUser) {
    try { return (await tx.insert(users).values(user).returning(view))[0]; } catch (error) { return translate(error); }
  }

  async replaceBranches(tx: Executor, userId: string, branchIds: string[]) {
    try {
      await tx.delete(userBranches).where(eq(userBranches.userId, userId));
      if (branchIds.length) await tx.insert(userBranches).values(branchIds.map(branchId => ({ userId, branchId })));
    } catch (error) { translate(error); }
  }

  async current(tx: Executor, id: string) {
    const [user] = await tx.select({ role: users.role }).from(users).where(eq(users.id, id)).for('no key update'); // not 'update': that would block FK key-share locks taken by sales and user_branches inserts
    if (!user) return null;
    const rows = await tx.select({ branchId: userBranches.branchId }).from(userBranches).where(eq(userBranches.userId, id));
    return { role: user.role, branchIds: rows.map(r => r.branchId).sort() };
  }

  async updateRole(tx: Executor, id: string, role: 'owner' | 'manager' | 'cashier', staff: { set: boolean; staffMemberId: string | null }) {
    try {
      await tx.update(users).set(staff.set ? { role, staffMemberId: staff.staffMemberId } : { role }).where(eq(users.id, id));
    } catch (error) { translate(error); }
  }

  async deactivate(tx: Executor, id: string) {
    const [row] = await tx.update(users).set({ active: false }).where(and(eq(users.id, id), eq(users.active, true))).returning({ id: users.id, email: users.email });
    return row ?? null;
  }

  async deleteSessions(tx: Executor, userId: string) {
    await tx.delete(sessions).where(eq(sessions.userId, userId));
  }

  async setPassword(tx: Executor, id: string, passwordHash: string) {
    const rows = await tx.update(users).set({ passwordHash }).where(and(eq(users.id, id), eq(users.active, true))).returning({ id: users.id });
    return rows.length > 0;
  }
}
