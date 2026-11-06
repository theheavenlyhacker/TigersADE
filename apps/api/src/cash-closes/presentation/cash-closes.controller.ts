import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser as Current } from '../../auth/domain/current-user';
import { AccessGuard, CurrentUser } from '../../auth/presentation/access.guard';
import { Roles } from '../../auth/presentation/roles.decorator';
import { uuidPipe } from '../../shared/validation';
import { CashClosesService } from '../application/cash-closes.service';
import { PreviewQuery, SubmitCashCloseDto } from './cash-closes.dto';

@ApiTags('cash closes')
@Controller('branches/:branchId/cash-closes')
@UseGuards(AccessGuard)
@Roles('manager')
export class CashClosesController {
  constructor(private readonly closes: CashClosesService) {}

  @Get('preview')
  preview(@Param('branchId', uuidPipe) branchId: string, @Query() { businessDate }: PreviewQuery) { return this.closes.preview(branchId, businessDate); }

  @Post()
  submit(@Param('branchId', uuidPipe) branchId: string, @Body() body: SubmitCashCloseDto, @CurrentUser() { user }: Current) { return this.closes.submit(user.id, branchId, body); }
}
