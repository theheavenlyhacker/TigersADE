import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Req, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Pool } from 'pg';
import { Request } from 'express';
import { DB_POOL } from '../db/db.module';
import { logActivity } from '../db/activity';
import { AccessGuard } from './access.guard';
import { Roles } from './access.guard';
import { AuthService, sessionToken } from './auth.service';

@ApiTags('branches')
@Controller('branches')
@UseGuards(AccessGuard)
export class BranchesController {
  constructor(@Inject(DB_POOL) private readonly pool: Pool, private readonly auth: AuthService) {}

  @Get(':branchId')
  async get(@Param('branchId') id: string) {
    const result = await this.pool.query('select id, code, name, daily_target as "dailyTarget", day_cutoff as "dayCutoff" from branches where id = $1', [id]);
    if (!result.rowCount) throw new NotFoundException();
    return result.rows[0];
  }

  @Patch(':branchId')
  @Roles('owner')
  async update(@Param('branchId') id: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('Invalid branch');
    const keys = Object.keys(body ?? {});
    if (keys.length !== 1 || !['dailyTarget', 'dayCutoff'].includes(keys[0])) throw new UnprocessableEntityException('Set dailyTarget or dayCutoff');
    const field = keys[0];
    if (field === 'dailyTarget' && !(typeof body.dailyTarget === 'string' && /^\d+$/.test(body.dailyTarget) && BigInt(body.dailyTarget) <= 9223372036854775807n) && !(typeof body.dailyTarget === 'number' && Number.isSafeInteger(body.dailyTarget) && body.dailyTarget >= 0)) throw new UnprocessableEntityException('dailyTarget must be non-negative integer centavos');
    if (field === 'dayCutoff' && (typeof body.dayCutoff !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.dayCutoff))) throw new UnprocessableEntityException('dayCutoff must be HH:MM');
    const actor = await this.auth.current(sessionToken(req));
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const current = await client.query('select id, daily_target, to_char(day_cutoff, \'HH24:MI\') as day_cutoff from branches where id = $1 for update', [id]);
      if (!current.rowCount) throw new NotFoundException();
      const before = field === 'dailyTarget' ? current.rows[0].daily_target?.toString() ?? null : current.rows[0].day_cutoff;
      const after = field === 'dailyTarget' ? BigInt(String(body.dailyTarget)).toString() : body.dayCutoff as string;
      if (before !== after) {
        const column = field === 'dailyTarget' ? 'daily_target' : 'day_cutoff';
        await client.query(`update branches set ${column} = $1, updated_at = now() where id = $2`, [after, id]);
        await logActivity(client, { branchId: id, actorId: actor.user.id, action: field === 'dailyTarget' ? 'branch.target_changed' : 'branch.cutoff_changed', payload: { [field]: { before, after } } });
      }
      await client.query('commit');
      return { id, [field]: after };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally { client.release(); }
  }
}
