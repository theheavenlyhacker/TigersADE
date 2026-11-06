import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InventoryRepository } from './application/inventory.repository';
import { InventoryService } from './application/inventory.service';
import { ReordersRepository } from './application/reorders.repository';
import { ReordersService } from './application/reorders.service';
import { DrizzleInventoryRepository } from './infrastructure/drizzle-inventory.repository';
import { DrizzleReordersRepository } from './infrastructure/drizzle-reorders.repository';
import { InventoryController } from './presentation/inventory.controller';

@Module({
  imports: [AuthModule],
  controllers: [InventoryController],
  providers: [
    InventoryService, ReordersService,
    { provide: InventoryRepository, useClass: DrizzleInventoryRepository },
    { provide: ReordersRepository, useClass: DrizzleReordersRepository },
  ],
})
export class InventoryModule {}
