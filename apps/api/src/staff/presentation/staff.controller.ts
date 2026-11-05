import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AccessGuard } from '../../auth/presentation/access.guard';
import { Roles } from '../../auth/presentation/roles.decorator';
import { uuidPipe } from '../../shared/validation';
import { StaffService } from '../application/staff.service';
import { StaffMemberDto } from './staff.dto';

@ApiTags('staff members')
@Controller('branches/:branchId/staff-members')
@UseGuards(AccessGuard)
@Roles('owner', 'manager')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list(@Param('branchId', uuidPipe) branchId: string) { return this.staff.list(branchId); }

  @Post()
  create(@Param('branchId', uuidPipe) branchId: string, @Body() body: StaffMemberDto) { return this.staff.create(branchId, body); }

  @Patch(':id')
  update(@Param('branchId', uuidPipe) branchId: string, @Param('id', uuidPipe) id: string, @Body() body: StaffMemberDto) { return this.staff.update(branchId, id, body); }
}
