import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessGuard } from './access.guard';
import { BranchesController } from './branches.controller';
import { ActivityController } from './activity.controller';
import { CatalogController } from '../catalog.controller';

@Module({ controllers: [AuthController, BranchesController, ActivityController, CatalogController], providers: [AuthService, AccessGuard], exports: [AccessGuard] })
export class AuthModule {}
