import { ConflictException, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DB, Db } from '../../db/db.module';
import { staffMembers } from '../../db/schema';
import { translatePgWrite } from '../../shared/pg-error';
import { StaffFields, StaffRepository } from '../application/staff.repository';

const view = {
  id: staffMembers.id, branchId: staffMembers.branchId, name: staffMembers.name, position: staffMembers.position,
  shiftStart: sql<string>`to_char(${staffMembers.shiftStart}, 'HH24:MI')`, shiftEnd: sql<string>`to_char(${staffMembers.shiftEnd}, 'HH24:MI')`,
};

const translate = (error: unknown) => translatePgWrite(error, 'A record with this name already exists');

@Injectable()
export class DrizzleStaffRepository extends StaffRepository {
  constructor(@Inject(DB) private readonly db: Db) { super(); }

  list(branchId: string) {
    return this.db.select(view).from(staffMembers).where(and(eq(staffMembers.branchId, branchId), eq(staffMembers.active, true))).orderBy(asc(staffMembers.name));
  }

  async create(branchId: string, f: StaffFields) {
    try {
      const [row] = await this.db.insert(staffMembers).values({ branchId, name: f.name.trim(), position: f.position.trim(), shiftStart: f.shiftStart, shiftEnd: f.shiftEnd }).returning(view);
      return row;
    } catch (error) { return translate(error); }
  }

  async update(branchId: string, id: string, f: StaffFields) {
    try {
      const [row] = await this.db.update(staffMembers).set({ name: f.name.trim(), position: f.position.trim(), shiftStart: f.shiftStart, shiftEnd: f.shiftEnd })
        .where(and(eq(staffMembers.id, id), eq(staffMembers.branchId, branchId), eq(staffMembers.active, true))).returning(view);
      return row ?? null;
    } catch (error) { return translate(error); }
  }

  async archive(branchId: string, id: string) {
    const rows = await this.db.update(staffMembers).set({ active: false })
      .where(and(eq(staffMembers.id, id), eq(staffMembers.branchId, branchId), eq(staffMembers.active, true))).returning({ id: staffMembers.id });
    return rows.length > 0;
  }
}
