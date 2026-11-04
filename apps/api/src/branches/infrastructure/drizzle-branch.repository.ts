import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Db, DB } from '../../db/db.module';
import { branches } from '../../db/schema';
import { BranchRepository } from '../domain/branch.repository';

@Injectable()
export class DrizzleBranchRepository extends BranchRepository {
  constructor(@Inject(DB) private readonly db: Db) {
    super();
  }

  findAll() {
    return this.db.select().from(branches);
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(branches).where(eq(branches.id, id));
    return row ?? null;
  }
}
