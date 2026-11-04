import { BadRequestException, Controller, ForbiddenException, Get, Query, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Pool } from 'pg';
import { DB_POOL } from '../db/db.module';
import { AccessGuard, Roles } from './access.guard';
import { AuthService, sessionToken } from './auth.service';
import { Request } from 'express';
import { Req } from '@nestjs/common';

@ApiTags('activity')
@Controller('activity')
@UseGuards(AccessGuard)
@Roles('owner', 'manager')
export class ActivityController {
  constructor(@Inject(DB_POOL) private readonly pool: Pool, private readonly auth: AuthService) {}

  @Get()
  async list(@Req() req: Request, @Query('branch') branch?: string, @Query('limit') limit = '50', @Query('before') before?: string) {
    const pageSize = Number(limit);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || (before !== undefined && (!/^[1-9]\d{0,18}$/.test(before) || BigInt(before) > 9223372036854775807n))) throw new UnprocessableEntityException('Invalid activity paging');
    const current = await this.auth.current(sessionToken(req));
    let branchIds: string[];
    if (current.user.role === 'owner') {
      if (branch && branch !== 'all') {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branch)) throw new BadRequestException('Invalid branch');
        const exists = await this.pool.query('select 1 from branches where id = $1', [branch]);
        if (!exists.rowCount) throw new BadRequestException('Unknown branch');
        branchIds = [branch];
      } else branchIds = current.branches.map((b: { id: string }) => b.id);
    } else {
      branchIds = current.branches.map((b: { id: string }) => b.id);
      if (branch && branch !== branchIds[0]) throw new ForbiddenException();
    }
    const result = await this.pool.query(`select a.id::text, a.branch_id as "branchId", b.name as "branchName",
      a.actor_id as "actorId", u.name as "actorName", a.action, a.payload, a.created_at as "createdAt"
      from activity_log a join users u on u.id = a.actor_id left join branches b on b.id = a.branch_id
      where a.branch_id = any($1::uuid[]) and ($2::bigint is null or (a.created_at, a.id) < (select created_at, id from activity_log where id = $2::bigint))
      order by a.created_at desc, a.id desc limit $3`, [branchIds, before ?? null, pageSize]);
    return { items: result.rows, nextBefore: result.rows.length === pageSize ? result.rows.at(-1).id : null };
  }
}
