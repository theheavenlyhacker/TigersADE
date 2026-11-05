import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { CurrentUser as Current } from '../../auth/domain/current-user';
import { AccessGuard, CurrentUser } from '../../auth/presentation/access.guard';
import { Roles } from '../../auth/presentation/roles.decorator';
import { ActivityService } from '../application/activity.service';

@ValidatorConstraint({ name: 'fitsInt8' })
class FitsInt8 implements ValidatorConstraintInterface {
  validate(value: string) { return /^\d+$/.test(value) && BigInt(value) <= 9223372036854775807n; }
  defaultMessage() { return 'before is out of range'; }
}

class ActivityQuery {
  @IsOptional() @IsString() branch?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
  @IsOptional() @Matches(/^[1-9]\d{0,18}$/) @Validate(FitsInt8) before?: string;
}

@ApiTags('activity')
@Controller('activity')
@UseGuards(AccessGuard)
@Roles('owner', 'manager')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(@Query() query: ActivityQuery, @CurrentUser() current: Current) { return this.activity.list(current, query); }
}
