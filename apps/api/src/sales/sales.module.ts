import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SalesRepository } from './application/sales.repository';
import { SalesService } from './application/sales.service';
import { DrizzleSalesRepository } from './infrastructure/drizzle-sales.repository';
import { SalesController } from './presentation/sales.controller';

@Module({
  imports: [AuthModule],
  controllers: [SalesController],
  providers: [SalesService, { provide: SalesRepository, useClass: DrizzleSalesRepository }],
})
export class SalesModule {}
