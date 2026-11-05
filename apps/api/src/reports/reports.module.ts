import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReportsRepository } from './application/reports.repository';
import { ReportsService } from './application/reports.service';
import { DrizzleReportsRepository } from './infrastructure/drizzle-reports.repository';
import { ReportsController } from './presentation/reports.controller';

@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService, { provide: ReportsRepository, useClass: DrizzleReportsRepository }],
})
export class ReportsModule {}
