import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser as Current } from '../../auth/domain/current-user';
import { AccessGuard, CurrentUser } from '../../auth/presentation/access.guard';
import { Roles } from '../../auth/presentation/roles.decorator';
import { isEmptyPatch, uuidPipe } from '../../shared/validation';
import { ExpensesService } from '../application/expenses.service';
import { CreateExpenseDto, ExpenseRangeDto, UpdateExpenseDto } from './expenses.dto';

@ApiTags('expenses')
@Controller('branches/:branchId/expenses')
@UseGuards(AccessGuard)
@Roles('owner', 'manager')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  list(@Param('branchId', uuidPipe) branchId: string, @Query() { from, to }: ExpenseRangeDto) {
    if (from > to) throw new UnprocessableEntityException('from and to must be business dates, with from <= to');
    return this.expenses.list(branchId, from, to);
  }

  @Post()
  create(@Param('branchId', uuidPipe) branchId: string, @Body() body: CreateExpenseDto, @CurrentUser() { user }: Current) {
    return this.expenses.create(user.id, branchId, { ...body, note: body.note ?? null });
  }

  @Patch(':expenseId')
  update(@Param('branchId', uuidPipe) branchId: string, @Param('expenseId', uuidPipe) id: string, @Body() body: UpdateExpenseDto, @CurrentUser() { user }: Current) {
    if (isEmptyPatch(body)) throw new UnprocessableEntityException('Set valid categoryId, businessDate, positive amount in centavos, or an optional note of at most 1000 characters');
    return this.expenses.update(user.id, branchId, id, body);
  }

  @Delete(':expenseId')
  remove(@Param('branchId', uuidPipe) branchId: string, @Param('expenseId', uuidPipe) id: string, @CurrentUser() { user }: Current) { return this.expenses.remove(user.id, branchId, id); }
}
