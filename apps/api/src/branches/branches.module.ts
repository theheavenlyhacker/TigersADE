import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BranchesRepository } from './application/branches.repository';
import { BranchesService } from './application/branches.service';
import { DrizzleBranchesRepository } from './infrastructure/drizzle-branches.repository';
import { BranchesController } from './presentation/branches.controller';

@Module({
  imports: [AuthModule],
  controllers: [BranchesController],
  providers: [BranchesService, { provide: BranchesRepository, useClass: DrizzleBranchesRepository }],
})
export class BranchesModule {}
