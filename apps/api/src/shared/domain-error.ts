import { ConflictException, ForbiddenException, HttpException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

export type DomainErrorKind = 'notFound' | 'conflict' | 'forbidden' | 'invalid';

/** A business-rule violation raised by pure domain code; the application layer turns it into an HTTP error. */
export class DomainError extends Error {
  constructor(readonly kind: DomainErrorKind, message: string) { super(message); }
}

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
