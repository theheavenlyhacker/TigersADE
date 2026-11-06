import { BranchRef, Role } from '../domain/current-user';

export interface LoginRecord { id: string; email: string; name: string; role: Role; passwordHash: string }

export abstract class AuthRepository {
  abstract findActiveByEmail(email: string): Promise<LoginRecord | null>;
  abstract createSession(tokenHash: string, userId: string): Promise<void>;
  /** Extends a live session and returns its active user, or null. */
  abstract touchSession(tokenHash: string): Promise<{ id: string; email: string; name: string; role: Role } | null>;
  abstract branchesFor(user: { id: string; role: Role }): Promise<BranchRef[]>;
  abstract deleteSession(tokenHash: string): Promise<void>;
}
