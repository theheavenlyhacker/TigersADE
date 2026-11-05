import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CashClosesRepository } from './application/cash-closes.repository';
import { CashClosesService } from './application/cash-closes.service';
import { DrizzleCashClosesRepository } from './infrastructure/drizzle-cash-closes.repository';
import { CashClosesController } from './presentation/cash-closes.controller';

@Module({
  imports: [AuthModule],
  controllers: [CashClosesController],
  providers: [CashClosesService, { provide: CashClosesRepository, useClass: DrizzleCashClosesRepository }],
})
export class CashClosesModule {}
