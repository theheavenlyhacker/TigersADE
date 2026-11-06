import { Module } from '@nestjs/common';
import { AuthRepository } from './application/auth.repository';
import { AuthService } from './application/auth.service';
import { DrizzleAuthRepository } from './infrastructure/drizzle-auth.repository';
import { AccessGuard } from './presentation/access.guard';
import { AuthController } from './presentation/auth.controller';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AccessGuard, { provide: AuthRepository, useClass: DrizzleAuthRepository }],
  exports: [AuthService, AccessGuard],
})
export class AuthModule {}
