import { Body, ConflictException, Controller, Get, Inject, NotFoundException, Param, Patch, Post, Req, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { DB_POOL } from '../db/db.module';
import { logActivity } from '../db/activity';
import { AccessGuard, Roles } from './access.guard';
import { AuthService, sessionToken } from './auth.service';
import { Request } from 'express';

const validShift = (value: unknown) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
@ApiTags('staff and users')
@Controller()
@UseGuards(AccessGuard)
export class StaffController {
  constructor(@Inject(DB_POOL) private readonly pool: Pool, private readonly auth: AuthService) {}

  @Get('branches/:branchId/staff-members')
  @Roles('owner', 'manager')
  listStaff(@Param('branchId') branchId: string) {
    return this.pool.query(`select id, branch_id as "branchId", name, position, to_char(shift_start,'HH24:MI') as "shiftStart", to_char(shift_end,'HH24:MI') as "shiftEnd" from staff_members where branch_id=$1 and active order by name`, [branchId]).then(r => r.rows);
  }

  @Post('branches/:branchId/staff-members')
  @Roles('owner', 'manager')
  async createStaff(@Param('branchId') branchId: string, @Body() body: any) {
    this.validateStaff(body);
    const r = await this.pool.query(`insert into staff_members(branch_id,name,position,shift_start,shift_end) values($1,$2,$3,$4,$5) returning id, branch_id as "branchId", name, position, to_char(shift_start,'HH24:MI') as "shiftStart", to_char(shift_end,'HH24:MI') as "shiftEnd"`, [branchId, body.name.trim(), body.position.trim(), body.shiftStart, body.shiftEnd]);
    return r.rows[0];
  }

  @Patch('branches/:branchId/staff-members/:id')
  @Roles('owner', 'manager')
  async updateStaff(@Param('branchId') branchId: string, @Param('id') id: string, @Body() body: any) {
    if (body?.active === false && Object.keys(body).length === 1) {
      const r = await this.pool.query('update staff_members set active=false where id=$1 and branch_id=$2 and active returning id', [id, branchId]);
      if (!r.rowCount) throw new NotFoundException();
      return { id, active: false };
    }
    this.validateStaff(body);
    const r = await this.pool.query(`update staff_members set name=$3, position=$4, shift_start=$5, shift_end=$6 where id=$1 and branch_id=$2 and active returning id, branch_id as "branchId", name, position, to_char(shift_start,'HH24:MI') as "shiftStart", to_char(shift_end,'HH24:MI') as "shiftEnd"`, [id, branchId, body.name.trim(), body.position.trim(), body.shiftStart, body.shiftEnd]);
    if (!r.rowCount) throw new NotFoundException();
    return r.rows[0];
  }

  private validateStaff(b: any) {
    if (!b || typeof b.name !== 'string' || !b.name.trim() || typeof b.position !== 'string' || !b.position.trim() || !validShift(b.shiftStart) || !validShift(b.shiftEnd) || Object.keys(b).some(k => !['name','position','shiftStart','shiftEnd'].includes(k))) throw new UnprocessableEntityException('Provide name, position and shift times in HH:MM format');
  }

  @Get('users')
  @Roles('owner')
  async listUsers() {
    const r = await this.pool.query(`select u.id,u.email,u.name,u.role,u.active,u.staff_member_id as "staffMemberId",coalesce(json_agg(ub.branch_id) filter(where ub.branch_id is not null),'[]') as "branchIds" from users u left join user_branches ub on ub.user_id=u.id group by u.id order by u.name`);
    return r.rows;
  }

  @Post('users')
  @Roles('owner')
  async createUser(@Body() b: any, @Req() req: Request) {
    if (!b || typeof b.email !== 'string' || !/^\S+@\S+\.\S+$/.test(b.email) || typeof b.name !== 'string' || !b.name.trim() || typeof b.password !== 'string' || b.password.length < 8 || !['owner','manager','cashier'].includes(b.role) || !Array.isArray(b.branchIds) || (b.role === 'owner' && b.branchIds.length) || (b.role !== 'owner' && !b.branchIds.length)) throw new UnprocessableEntityException('Invalid user details');
    const actor = await this.auth.current(sessionToken(req));
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      if (b.staffMemberId) {
        const linked = await client.query('select branch_id from staff_members where id=$1 and active', [b.staffMemberId]);
        if (!linked.rowCount || (b.role !== 'owner' && !b.branchIds.includes(linked.rows[0].branch_id))) throw new UnprocessableEntityException('Linked staff member must be active and assigned to one of the user branches');
      }
      const result = await client.query('insert into users(email,password_hash,name,role,staff_member_id) values($1,$2,$3,$4,$5) returning id,email,name,role,active,staff_member_id as "staffMemberId"', [b.email.trim(), await argon2.hash(b.password, { type: argon2.argon2id }), b.name.trim(), b.role, b.staffMemberId || null]);
      for (const branchId of new Set(b.branchIds)) await client.query('insert into user_branches(user_id,branch_id) values($1,$2)', [result.rows[0].id, branchId]);
      await logActivity(client, { branchId: null, actorId: actor.user.id, action: 'user.created', payload: { userId: result.rows[0].id, email: b.email, role: b.role } });
      await client.query('commit');
      return result.rows[0];
    } catch (e: any) { await client.query('rollback'); if (e.code === '23505') throw new ConflictException('Email already exists'); throw e; } finally { client.release(); }
  }

  @Patch('users/:id')
  @Roles('owner')
  async updateUser(@Param('id') id: string, @Body() b: any) {
    if (!b || !['owner','manager','cashier'].includes(b.role) || !Array.isArray(b.branchIds) || (b.role === 'owner' ? b.branchIds.length !== 0 : b.branchIds.length === 0)) throw new UnprocessableEntityException('Provide a role and valid branches');
    const c = await this.pool.connect();
    try { await c.query('begin'); if (b.staffMemberId) { const linked = await c.query('select branch_id from staff_members where id=$1 and active',[b.staffMemberId]); if (!linked.rowCount || (b.role !== 'owner' && !b.branchIds.includes(linked.rows[0].branch_id))) throw new UnprocessableEntityException('Linked staff member must be active and assigned to one of the user branches'); } const u = await c.query('update users set role=$2,staff_member_id=$3 where id=$1 returning id', [id,b.role,b.staffMemberId || null]); if (!u.rowCount) throw new NotFoundException(); await c.query('delete from user_branches where user_id=$1',[id]); for (const branchId of new Set(b.branchIds)) await c.query('insert into user_branches(user_id,branch_id) values($1,$2)',[id,branchId]); await c.query('commit'); return {id,role:b.role,branchIds:b.branchIds}; } catch(e) { await c.query('rollback'); throw e; } finally { c.release(); }
  }

  @Post('users/:id/deactivate')
  @Roles('owner')
  async deactivate(@Param('id') id: string, @Req() req: Request) {
    const actor = await this.auth.current(sessionToken(req)); const c = await this.pool.connect();
    try { await c.query('begin'); const u = await c.query('update users set active=false where id=$1 and active returning id,email',[id]); if (!u.rowCount) throw new NotFoundException(); await c.query('delete from sessions where user_id=$1',[id]); await logActivity(c,{branchId:null,actorId:actor.user.id,action:'user.deactivated',payload:{userId:id,email:u.rows[0].email}}); await c.query('commit'); return {id,active:false}; } catch(e) { await c.query('rollback'); throw e; } finally { c.release(); }
  }

  @Post('users/:id/password')
  @Roles('owner')
  async resetPassword(@Param('id') id: string, @Body() b: any) {
    if (!b || typeof b.password !== 'string' || b.password.length < 8) throw new UnprocessableEntityException('Password must be at least 8 characters');
    const r = await this.pool.query('update users set password_hash=$2 where id=$1 and active returning id',[id,await argon2.hash(b.password,{type:argon2.argon2id})]);
    if (!r.rowCount) throw new NotFoundException(); return {id};
  }
}
