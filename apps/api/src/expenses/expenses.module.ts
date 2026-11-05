import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExpensesRepository } from './application/expenses.repository';
import { ExpensesService } from './application/expenses.service';
import { DrizzleExpensesRepository } from './infrastructure/drizzle-expenses.repository';
import { ExpensesController } from './presentation/expenses.controller';

@Module({
  imports: [AuthModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, { provide: ExpensesRepository, useClass: DrizzleExpensesRepository }],
})
export class ExpensesModule {}
