import { SetMetadata } from '@nestjs/common';
import { Role } from '../domain/current-user';

export const ROLES = 'ade:roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
