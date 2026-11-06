import { Body, Controller, Get, Param, Patch, Post, Put, Query, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser as Current } from '../../auth/domain/current-user';
import { AccessGuard, CurrentUser } from '../../auth/presentation/access.guard';
import { Roles } from '../../auth/presentation/roles.decorator';
import { isEmptyPatch, uuidPipe } from '../../shared/validation';
import { InventoryService } from '../application/inventory.service';
import { ReordersService } from '../application/reorders.service';
import { CreateItemDto, MovementDto, MovementsQuery, ReordersQuery, RequestReorderDto, SetParDto, StockQuery, UpdateItemDto } from './inventory.dto';

@ApiTags('inventory')
@Controller()
@UseGuards(AccessGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService, private readonly reorders: ReordersService) {}

  @Get('inventory-items') @Roles('owner')
  items() { return this.inventory.listItems(); }

  @Post('inventory-items') @Roles('owner')
  createItem(@Body() body: CreateItemDto, @CurrentUser() { user }: Current) { return this.inventory.createItem(user.id, body); }

  @Patch('inventory-items/:itemId') @Roles('owner')
  changeItem(@Param('itemId', uuidPipe) itemId: string, @Body() body: UpdateItemDto, @CurrentUser() { user }: Current) {
    if (isEmptyPatch(body)) throw new UnprocessableEntityException('Set name, unit, unitCost, or active: false');
    return this.inventory.changeItem(user.id, itemId, body);
  }

  @Get('branches/:branchId/inventory') @Roles('owner', 'manager')
  stock(@Param('branchId', uuidPipe) branchId: string, @Query() { low }: StockQuery) { return this.inventory.branchStock(branchId, low === 'true'); }

  @Put('branches/:branchId/inventory/:itemId') @Roles('owner', 'manager')
  setPar(@Param('branchId', uuidPipe) branchId: string, @Param('itemId', uuidPipe) itemId: string, @Body() body: SetParDto, @CurrentUser() { user }: Current) {
    return this.inventory.setPar(user.id, branchId, itemId, body.par);
  }

  @Get('branches/:branchId/stock-movements') @Roles('owner', 'manager')
  movements(@Param('branchId', uuidPipe) branchId: string, @Query() { itemId }: MovementsQuery) { return this.inventory.listMovements(branchId, itemId ?? null); }

  @Post('branches/:branchId/stock-movements') @Roles('owner', 'manager')
  move(@Param('branchId', uuidPipe) branchId: string, @Body() body: MovementDto, @CurrentUser() { user }: Current) { return this.inventory.recordMovement(user.id, branchId, body); }

  @Get('branches/:branchId/reorder-requests') @Roles('owner', 'manager')
  reorderRequests(@Param('branchId', uuidPipe) branchId: string, @Query() { status }: ReordersQuery) { return this.reorders.list(branchId, status ?? null); }

  @Post('branches/:branchId/reorder-requests') @Roles('owner', 'manager')
  requestReorder(@Param('branchId', uuidPipe) branchId: string, @Body() body: RequestReorderDto, @CurrentUser() { user }: Current) {
    return this.reorders.request(user.id, branchId, body);
  }

  @Post('branches/:branchId/reorder-requests/:requestId/receive') @Roles('owner', 'manager')
  receive(@Param('branchId', uuidPipe) branchId: string, @Param('requestId', uuidPipe) requestId: string, @CurrentUser() { user }: Current) {
    return this.reorders.resolve(user.id, branchId, requestId, 'received');
  }

  @Post('branches/:branchId/reorder-requests/:requestId/cancel') @Roles('owner', 'manager')
  cancel(@Param('branchId', uuidPipe) branchId: string, @Param('requestId', uuidPipe) requestId: string, @CurrentUser() { user }: Current) {
    return this.reorders.resolve(user.id, branchId, requestId, 'cancelled');
  }
}
