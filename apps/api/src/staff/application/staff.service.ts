import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { StaffFields, StaffRepository } from './staff.repository';

export type StaffInput = Partial<StaffFields> & { active?: false };

@Injectable()
export class StaffService {
  constructor(private readonly repo: StaffRepository) {}

  list(branchId: string) { return this.repo.list(branchId); }

  create(branchId: string, input: StaffInput) { return this.repo.create(branchId, complete(input)); }

  async update(branchId: string, id: string, input: StaffInput) {
    if (input.active === false && Object.keys(input).length === 1) {
      if (!(await this.repo.archive(branchId, id))) throw new NotFoundException();
      return { id, active: false };
    }
    const updated = await this.repo.update(branchId, id, complete(input));
    if (!updated) throw new NotFoundException();
    return updated;
  }
}

function complete(input: StaffInput): StaffFields {
  const { name, position, shiftStart, shiftEnd } = input;
  if (!name || !position || !shiftStart || !shiftEnd || 'active' in input) throw new UnprocessableEntityException('Provide name, position and shift times in HH:MM format');
  return { name, position, shiftStart, shiftEnd };
}
