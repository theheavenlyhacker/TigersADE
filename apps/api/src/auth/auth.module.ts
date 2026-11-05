import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessGuard } from './access.guard';
import { BranchesController } from './branches.controller';
import { ActivityController } from './activity.controller';
import { CatalogController } from '../catalog.controller';
import { SalesController } from '../sales.controller';
import { CashClosesController } from '../cash-closes.controller';
import { ReportsController } from '../reports.controller';
import { ExpensesController, ExpenseReportsController } from '../expenses.controller';
import { StaffController } from './staff.controller';
import { CLOCK, SystemClock } from '../clock';
import { InventoryController } from '../inventory.controller';

@Module({ controllers: [AuthController, BranchesController, ActivityController, CatalogController, SalesController, ReportsController, CashClosesController, StaffController, ExpensesController, ExpenseReportsController, InventoryController], providers: [AuthService, AccessGuard, { provide: CLOCK, useClass: SystemClock }], exports: [AccessGuard] })
export class AuthModule {}
