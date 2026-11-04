import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Pool } from 'pg';
import { DB_POOL } from '../db/db.module';
import { AccessGuard } from './access.guard';

@ApiTags('branches')
@Controller('branches')
@UseGuards(AccessGuard)
export class BranchesController {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  @Get(':branchId')
  async get(@Param('branchId') id: string) {
    const result = await this.pool.query('select id, code, name from branches where id = $1', [id]);
    if (!result.rowCount) throw new NotFoundException();
    return result.rows[0];
  }
}
