import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StaffRepository } from './application/staff.repository';
import { StaffService } from './application/staff.service';
import { DrizzleStaffRepository } from './infrastructure/drizzle-staff.repository';
import { StaffController } from './presentation/staff.controller';

@Module({
  imports: [AuthModule],
  controllers: [StaffController],
  providers: [StaffService, { provide: StaffRepository, useClass: DrizzleStaffRepository }],
})
export class StaffModule {}
