import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser as Current } from '../../auth/domain/current-user';
import { AccessGuard, CurrentUser } from '../../auth/presentation/access.guard';
import { Roles } from '../../auth/presentation/roles.decorator';
import { uuidPipe } from '../../shared/validation';
import { BranchesService } from '../application/branches.service';
import { UpdateBranchDto } from './branches.dto';

@ApiTags('branches')
@Controller('branches')
@UseGuards(AccessGuard)
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get(':branchId')
  get(@Param('branchId', uuidPipe) id: string) { return this.branches.get(id); }

  @Patch(':branchId') @Roles('owner')
  update(@Param('branchId', uuidPipe) id: string, @Body() body: UpdateBranchDto, @CurrentUser() { user }: Current) {
    return this.branches.changeSetting(user.id, id, body);
  }
}
