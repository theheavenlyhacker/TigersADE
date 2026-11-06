export type DomainErrorKind = 'notFound' | 'conflict' | 'forbidden' | 'invalid';

/** A business-rule violation raised by pure domain code (no Nest); the application layer maps it to HTTP with `asHttp`. */
export class DomainError extends Error {
  constructor(readonly kind: DomainErrorKind, message: string) { super(message); }
}
