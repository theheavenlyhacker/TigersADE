import { Module } from '@nestjs/common';
import { GetBranchUseCase } from './application/use-cases/get-branch.use-case';
import { ListBranchesUseCase } from './application/use-cases/list-branches.use-case';
import { BranchRepository } from './domain/branch.repository';
import { DrizzleBranchRepository } from './infrastructure/drizzle-branch.repository';
import { BranchesController } from './presentation/branches.controller';

@Module({
  controllers: [BranchesController],
  providers: [
    ListBranchesUseCase,
    GetBranchUseCase,
    { provide: BranchRepository, useClass: DrizzleBranchRepository },
  ],
})
export class BranchesModule {}
