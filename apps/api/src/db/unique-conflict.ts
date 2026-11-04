import { ConflictException } from '@nestjs/common';

export function rethrowUniqueConflict(error: unknown): never {
  if ((error as { code?: string })?.code === '23505') {
    throw new ConflictException('A record with this name already exists');
  }
  throw error;
}
