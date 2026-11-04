import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { DB_POOL } from '../db/db.module';
import { Request } from 'express';

const COOKIE = 'ade_session';
const MAX_AGE = 7 * 24 * 60 * 60;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const dummyHash = argon2.hash('not-a-real-password');

@Injectable()
export class AuthService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async login(email: string, password: string) {
    const result = await this.pool.query('select id, email, password_hash, name, role from users where lower(email) = lower($1) and active', [email]);
    const user = result.rows[0];
    if (!user) { await argon2.verify(await dummyHash, password).catch(() => false); throw new UnauthorizedException('Invalid email or password'); }
    if (!(await argon2.verify(user.password_hash, password))) throw new UnauthorizedException('Invalid email or password');
    const token = randomBytes(32).toString('hex');
    await this.pool.query('insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + interval \'7 days\')', [hash(token), user.id]);
    return { cookie: this.cookie(token), user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }

  cookie(token: string) {
    return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  }

  clearCookie() { return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`; }

  async current(token?: string) {
    if (!token) throw new UnauthorizedException();
    const result = await this.pool.query(`update sessions s set expires_at = now() + interval '7 days'
      from users u where s.user_id = u.id and s.token_hash = $1 and s.expires_at > now() and u.active
      returning u.id, u.email, u.name, u.role`, [hash(token)]);
    const user = result.rows[0];
    if (!user) throw new UnauthorizedException();
    const branchResult = user.role === 'owner'
      ? await this.pool.query('select id, code, name from branches order by code')
      : await this.pool.query('select b.id, b.code, b.name from branches b join user_branches ub on ub.branch_id = b.id where ub.user_id = $1 order by b.code', [user.id]);
    return { user, branches: branchResult.rows };
  }

  async logout(token?: string) {
    if (token) await this.pool.query('delete from sessions where token_hash = $1', [hash(token)]);
  }
}

export { COOKIE };
export const sessionToken = (req: Request) => {
  const pair = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`));
  return pair?.slice(COOKIE.length + 1);
};
