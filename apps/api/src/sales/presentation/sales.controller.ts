import { Body, Controller, Get, Param, Post, Query, Res, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser as Current } from '../../auth/domain/current-user';
import { AccessGuard, CurrentUser } from '../../auth/presentation/access.guard';
import { Roles } from '../../auth/presentation/roles.decorator';
import { uuidPipe } from '../../shared/validation';
import { SalesService } from '../application/sales.service';
import { RecordSaleDto, SalesRangeDto, VoidSaleDto } from './sales.dto';

@ApiTags('sales')
@Controller('branches/:branchId/sales')
@UseGuards(AccessGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post()
  async record(@Param('branchId', uuidPipe) branchId: string, @Body() body: RecordSaleDto, @CurrentUser() { user }: Current, @Res({ passthrough: true }) res: Response) {
    const { sale, created } = await this.sales.record(user, branchId, body);
    res.status(created ? 201 : 200);
    return sale;
  }

  @Post(':saleId/void')
  void(@Param('branchId', uuidPipe) branchId: string, @Param('saleId', uuidPipe) saleId: string, @Body() body: VoidSaleDto, @CurrentUser() { user }: Current) {
    return this.sales.void(user, branchId, saleId, body.reason);
  }

  @Get() @Roles('owner', 'manager')
  list(@Param('branchId', uuidPipe) branchId: string, @Query() { from, to }: SalesRangeDto) {
    if (from > to) throw new UnprocessableEntityException('from and to must be business dates, with from <= to');
    return this.sales.list(branchId, from, to);
  }
}
