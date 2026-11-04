import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessGuard } from './access.guard';
import { BranchesController } from './branches.controller';

@Module({ controllers: [AuthController, BranchesController], providers: [AuthService, AccessGuard], exports: [AccessGuard] })
export class AuthModule {}
