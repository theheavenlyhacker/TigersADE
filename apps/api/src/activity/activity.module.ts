import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ActivityRepository } from './application/activity.repository';
import { ActivityService } from './application/activity.service';
import { DrizzleActivityRepository } from './infrastructure/drizzle-activity.repository';
import { ActivityController } from './presentation/activity.controller';

@Module({
  imports: [AuthModule],
  controllers: [ActivityController],
  providers: [ActivityService, { provide: ActivityRepository, useClass: DrizzleActivityRepository }],
})
export class ActivityModule {}
