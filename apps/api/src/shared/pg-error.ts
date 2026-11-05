/** Postgres error code, whether the driver error is raw or wrapped by Drizzle (`cause`). */
export const pgCode = (error: unknown): string | undefined =>
  (error as { code?: string })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;
export const UNIQUE_VIOLATION = '23505';
export const FOREIGN_KEY_VIOLATION = '23503';
