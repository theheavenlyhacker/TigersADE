import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { CurrentUser } from '../domain/current-user';
import { hashToken, newToken } from '../domain/session';
import { AuthRepository } from './auth.repository';

const dummyHash = argon2.hash('not-a-real-password');

// ponytail: in-memory per-email limit, resets on restart; use a shared store if the API runs on several instances
const MAX_ATTEMPTS = 5, WINDOW_MS = 15 * 60_000;
const attempts = new Map<string, { count: number; resetAt: number }>();

/** Reserve an attempt before verifying, so parallel guesses cannot slip past the limit. Swept lazily to bound memory. */
function reserveAttempt(key: string) {
  const now = Date.now();
  if (attempts.size > 1000) for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k);
  let entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) attempts.set(key, entry = { count: 0, resetAt: now + WINDOW_MS });
  if (entry.count >= MAX_ATTEMPTS) throw new HttpException('Too many login attempts; try again later', HttpStatus.TOO_MANY_REQUESTS);
  entry.count++;
}

@Injectable()
export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  /** Same error for an unknown email and a wrong password. */
  async login(email: string, password: string) {
    const key = email.toLowerCase();
    reserveAttempt(key);
    const result = await this.attempt(email, password);
    attempts.delete(key);
    return result;
  }

  private async attempt(email: string, password: string) {
    const user = await this.repo.findActiveByEmail(email);
    if (!user) { await argon2.verify(await dummyHash, password).catch(() => false); throw new UnauthorizedException('Invalid email or password'); }
    if (!(await argon2.verify(user.passwordHash, password))) throw new UnauthorizedException('Invalid email or password');
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
