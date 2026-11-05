import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser as Current } from '../../auth/domain/current-user';
import { AccessGuard, CurrentUser } from '../../auth/presentation/access.guard';
import { Roles } from '../../auth/presentation/roles.decorator';
import { uuidPipe } from '../../shared/validation';
import { UsersService } from '../application/users.service';
import { ChangeUserDto, CreateUserDto, ResetPasswordDto } from './users.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(AccessGuard)
@Roles('owner')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() { return this.users.list(); }

  @Post()
  create(@Body() body: CreateUserDto, @CurrentUser() { user }: Current) { return this.users.create(user.id, body); }

  @Patch(':id')
  change(@Param('id', uuidPipe) id: string, @Body() body: ChangeUserDto) { return this.users.change(id, body); }

  @Post(':id/deactivate')
  deactivate(@Param('id', uuidPipe) id: string, @CurrentUser() { user }: Current) { return this.users.deactivate(user.id, id); }

  @Post(':id/password')
  resetPassword(@Param('id', uuidPipe) id: string, @Body() body: ResetPasswordDto) { return this.users.resetPassword(id, body.password); }
}
