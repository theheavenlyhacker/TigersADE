import { Injectable, NotFoundException } from '@nestjs/common';
import { Branch } from '../../domain/branch.entity';
import { BranchRepository } from '../../domain/branch.repository';

@Injectable()
export class GetBranchUseCase {
  constructor(private readonly branches: BranchRepository) {}

  async execute(id: string): Promise<Branch> {
    const branch = await this.branches.findById(id);
    if (!branch) throw new NotFoundException(`Branch ${id} not found`);
    return branch;
  }
}
