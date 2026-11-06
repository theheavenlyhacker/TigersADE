import { HttpStatus, Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ActivityModule } from './activity/activity.module';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { CashClosesModule } from './cash-closes/cash-closes.module';
import { CatalogModule } from './catalog/catalog.module';
import { DbModule } from './db/db.module';
import { ExpensesModule } from './expenses/expenses.module';
import { InventoryModule } from './inventory/inventory.module';
import { ReportsModule } from './reports/reports.module';
import { SalesModule } from './sales/sales.module';
import { SharedModule } from './shared/shared.module';
import { StaffModule } from './staff/staff.module';
import { UsersModule } from './users/users.module';

/** Bodies and queries are validated against DTOs at the boundary; anything invalid is a 422. */
const validation = () => new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@Module({
  imports: [
    SharedModule, DbModule, AuthModule, BranchesModule, CatalogModule, SalesModule, CashClosesModule, ExpensesModule,
    InventoryModule, StaffModule, UsersModule, ActivityModule, ReportsModule,
  ],
  providers: [{ provide: APP_PIPE, useFactory: validation }],
})
export class AppModule {}
