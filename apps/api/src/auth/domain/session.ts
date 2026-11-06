import { createHash, randomBytes } from 'node:crypto';

export const COOKIE = 'ade_session';
export const SESSION_DAYS = 7;
/** Only the hash of a session token is stored. */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('hex');
