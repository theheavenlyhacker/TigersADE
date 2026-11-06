import { ConflictException, ForbiddenException, HttpException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CurrentUser } from '../auth/domain/current-user';
import { branchScope } from '../auth/domain/branch-scope';
import { DomainError, DomainErrorKind } from './domain-error';

const http: Record<DomainErrorKind, new (message?: string) => HttpException> = {
  notFound: NotFoundException, conflict: ConflictException, forbidden: ForbiddenException, invalid: UnprocessableEntityException,
};

/** Run a domain rule, mapping its DomainError to the matching Nest exception. */
export function asHttp<T>(rule: () => T): T {
  try { return rule(); } catch (error) {
    if (error instanceof DomainError) throw new http[error.kind](error.message);
    throw error;
  }
}

/** The branch ids a user may read for an optional `branch` query ('all' is owner-only). */
export const scopeBranches = (current: CurrentUser, branch?: string) => asHttp(() => branchScope(current, branch));
