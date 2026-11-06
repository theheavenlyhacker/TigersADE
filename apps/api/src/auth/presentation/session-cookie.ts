import { Request } from 'express';
import { COOKIE, SESSION_DAYS } from '../domain/session';

const flags = () => `Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
export const sessionCookie = (token: string) => `${COOKIE}=${token}; ${flags()}; Max-Age=${SESSION_DAYS * 24 * 60 * 60}`;
export const clearedCookie = () => `${COOKIE}=; ${flags()}; Max-Age=0`;
export const sessionToken = (req: Request) =>
  req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
