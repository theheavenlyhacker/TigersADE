import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { DB, Db } from '../../db/db.module';
import { branches, sessions, userBranches, users } from '../../db/schema';
import { AuthRepository } from '../application/auth.repository';
import { SESSION_DAYS } from '../domain/session';

const extended = sql`now() + ${`${SESSION_DAYS} days`}::interval`;

@Injectable()
export class DrizzleAuthRepository extends AuthRepository {
  constructor(@Inject(DB) private readonly db: Db) { super(); }

  async findActiveByEmail(email: string) {
    const [row] = await this.db.select({ id: users.id, email: users.email, name: users.name, role: users.role, passwordHash: users.passwordHash })
      .from(users).where(and(sql`lower(${users.email}) = lower(${email})`, eq(users.active, true)));
    return row ?? null;
  }

  async createSession(tokenHash: string, userId: string) {
    await this.db.insert(sessions).values({ tokenHash, userId, expiresAt: extended });
  }

  async touchSession(tokenHash: string) {
    const [session] = await this.db.select({ userId: sessions.userId }).from(sessions).innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, sql`now()`), eq(users.active, true)));
    if (!session) return null;
    await this.db.update(sessions).set({ expiresAt: extended }).where(eq(sessions.tokenHash, tokenHash));
    const [user] = await this.db.select({ id: users.id, email: users.email, name: users.name, role: users.role }).from(users).where(eq(users.id, session.userId));
    return user ?? null;
  }

  async branchesFor(user: { id: string; role: string }) {
    const columns = { id: branches.id, code: branches.code, name: branches.name };
    if (user.role === 'owner') return this.db.select(columns).from(branches).orderBy(asc(branches.code));
    return this.db.select(columns).from(branches).innerJoin(userBranches, eq(userBranches.branchId, branches.id))
      .where(eq(userBranches.userId, user.id)).orderBy(asc(branches.code));
  }

  async deleteSession(tokenHash: string) {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }
}
