import { Controller, Get, Query, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser as Current } from '../../auth/domain/current-user';
import { AccessGuard, CurrentUser } from '../../auth/presentation/access.guard';
import { Roles } from '../../auth/presentation/roles.decorator';
import { ReportsService } from '../application/reports.service';
import { BranchQuery, ExpenseReportQuery, SalesRangeQuery, SummaryQuery, TrendQuery } from './reports.dto';

const assertRange = ({ from, to }: { from: string; to: string }) => { if (from > to) throw new UnprocessableEntityException('from must be on or before to'); };

@ApiTags('reports')
@Controller('reports')
@UseGuards(AccessGuard)
@Roles('owner', 'manager')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary') summary(@Query() q: SummaryQuery, @CurrentUser() current: Current) { return this.reports.summary(current, q); }
  @Get('trend') trend(@Query() q: TrendQuery, @CurrentUser() current: Current) { return this.reports.trend(current, q); }
  @Get('comparison') @Roles('owner') comparison(@CurrentUser() current: Current) { return this.reports.comparison(current); }
  @Get('best-sellers') best(@Query() q: SalesRangeQuery, @CurrentUser() current: Current) { assertRange(q); return this.reports.bestSellers(current, q); }
  @Get('peak-hours') peak(@Query() q: SalesRangeQuery, @CurrentUser() current: Current) { assertRange(q); return this.reports.peakHours(current, q); }
  @Get('product-sales') productSales(@Query() q: BranchQuery, @CurrentUser() current: Current) { return this.reports.productSales(current, q.branch); }
  @Get('expenses') expenses(@Query() q: ExpenseReportQuery, @CurrentUser() current: Current) { return this.reports.expenses(current, q); }
}
