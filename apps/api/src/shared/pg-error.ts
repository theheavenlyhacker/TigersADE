import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
/** Postgres error code, whether the driver error is raw or wrapped by Drizzle (`cause`). */
export const pgCode = (error: unknown): string | undefined =>
  (error as { code?: string })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;
export const UNIQUE_VIOLATION = '23505';
export const FOREIGN_KEY_VIOLATION = '23503';

/** Runs `work`; a unique violation becomes `onUnique()`, everything else rethrows. */
export async function orConflict<T>(work: Promise<T>, onUnique: () => Error): Promise<T> {
  try { return await work; } catch (error) {
    if (pgCode(error) === UNIQUE_VIOLATION) throw onUnique();
    throw error;
  }
}

/** Maps a write failure to HTTP: unique violation to 409, missing foreign key to 422, anything else rethrown. */
export function translatePgWrite(error: unknown, uniqueMessage: string): never {
  const code = pgCode(error);
  if (code === UNIQUE_VIOLATION) throw new ConflictException(uniqueMessage);
  if (code === FOREIGN_KEY_VIOLATION) throw new UnprocessableEntityException('Referenced record does not exist');
  throw error;
}
