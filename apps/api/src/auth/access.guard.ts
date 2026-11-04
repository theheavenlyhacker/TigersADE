import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService, COOKIE } from './auth.service';

export const ROLES = 'ade:roles';
export const Roles = (...roles: Array<'owner' | 'manager' | 'cashier'>) => SetMetadata(ROLES, roles);

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const token = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    let current;
    try { current = await this.auth.current(token); } catch { throw new UnauthorizedException(); }
    const roles = this.reflector.getAllAndOverride<Array<'owner' | 'manager' | 'cashier'>>(ROLES, [context.getHandler(), context.getClass()]);
    if (roles && !roles.includes(current.user.role)) throw new ForbiddenException();
    const branchId = req.params.branchId;
    if (branchId && current.user.role !== 'owner' && !current.branches.some(branch => branch.id === branchId)) throw new ForbiddenException();
    return true;
  }
}
