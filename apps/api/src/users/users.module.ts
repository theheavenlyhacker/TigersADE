import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersRepository } from './application/users.repository';
import { UsersService } from './application/users.service';
import { DrizzleUsersRepository } from './infrastructure/drizzle-users.repository';
import { UsersController } from './presentation/users.controller';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService, { provide: UsersRepository, useClass: DrizzleUsersRepository }],
})
export class UsersModule {}
