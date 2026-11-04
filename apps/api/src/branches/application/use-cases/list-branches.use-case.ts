import { Injectable } from '@nestjs/common';
import { Branch } from '../../domain/branch.entity';
import { BranchRepository } from '../../domain/branch.repository';

@Injectable()
export class ListBranchesUseCase {
  constructor(private readonly branches: BranchRepository) {}

  execute(): Promise<Branch[]> {
    return this.branches.findAll();
  }
}
