import { Controller, Get, Param } from '@nestjs/common';
import { GetBranchUseCase } from '../application/use-cases/get-branch.use-case';
import { ListBranchesUseCase } from '../application/use-cases/list-branches.use-case';

@Controller('branches')
export class BranchesController {
  constructor(
    private readonly listBranches: ListBranchesUseCase,
    private readonly getBranch: GetBranchUseCase,
  ) {}

  @Get()
  list() {
    return this.listBranches.execute();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.getBranch.execute(id);
  }
}
