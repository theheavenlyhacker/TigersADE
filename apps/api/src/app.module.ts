import { Module } from '@nestjs/common';
import { BranchesModule } from './branches/branches.module';
import { DbModule } from './db/db.module';

@Module({ imports: [DbModule, BranchesModule] })
export class AppModule {}
