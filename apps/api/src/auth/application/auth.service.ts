import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { CurrentUser } from '../domain/current-user';
import { hashToken, newToken } from '../domain/session';
import { AuthRepository } from './auth.repository';

const dummyHash = argon2.hash('not-a-real-password');

// ponytail: in-memory per-email lockout, resets on restart; use a shared store if the API runs on several instances
const MAX_FAILURES = 5, LOCK_MS = 15 * 60_000;
const failures = new Map<string, { count: number; since: number }>();

@Injectable()
export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  /** Same error for an unknown email and a wrong password. */
  async login(email: string, password: string) {
    const key = email.toLowerCase(), failed = failures.get(key);
    if (failed && Date.now() - failed.since > LOCK_MS) failures.delete(key);
    if ((failures.get(key)?.count ?? 0) >= MAX_FAILURES) throw new HttpException('Too many failed attempts; try again later', HttpStatus.TOO_MANY_REQUESTS);
    try { return await this.attempt(email, password); } catch (error) {
      if (error instanceof UnauthorizedException) failures.set(key, { count: (failures.get(key)?.count ?? 0) + 1, since: failures.get(key)?.since ?? Date.now() });
      throw error;
    }
  }

  private async attempt(email: string, password: string) {
    const user = await this.repo.findActiveByEmail(email);
    if (!user) { await argon2.verify(await dummyHash, password).catch(() => false); throw new UnauthorizedException('Invalid email or password'); }
    if (!(await argon2.verify(user.passwordHash, password))) throw new UnauthorizedException('Invalid email or password');
    failures.delete(email.toLowerCase());
    const token = newToken();
    await this.repo.createSession(hashToken(token), user.id);
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }

  async current(token?: string): Promise<CurrentUser> {
    if (!token) throw new UnauthorizedException();
    const user = await this.repo.touchSession(hashToken(token));
    if (!user) throw new UnauthorizedException();
    return { user, branches: await this.repo.branchesFor(user) };
  }

  async logout(token?: string) {
    if (token) await this.repo.deleteSession(hashToken(token));
  }
}
