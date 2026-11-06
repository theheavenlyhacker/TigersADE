import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '../application/auth.service';
import { CurrentUser as Current, Role } from '../domain/current-user';
import { canAccessBranch } from '../domain/branch-scope';
import { ROLES } from './roles.decorator';
import { sessionToken } from './session-cookie';

type AuthedRequest = Request & { current?: Current };

/** The single place roles and `:branchId` access are enforced (spec §4). */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    let current: Current;
    try { current = await this.auth.current(sessionToken(req)); } catch { throw new UnauthorizedException(); }
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [context.getHandler(), context.getClass()]);
    if (roles && !roles.includes(current.user.role)) throw new ForbiddenException();
    const branchId = req.params.branchId as string | undefined;
    if (branchId && !canAccessBranch(current, branchId)) throw new ForbiddenException();
    req.current = current;
    return true;
  }
}

/** The authenticated user and their branches; only valid behind AccessGuard. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): Current => ctx.switchToHttp().getRequest<AuthedRequest>().current!);
