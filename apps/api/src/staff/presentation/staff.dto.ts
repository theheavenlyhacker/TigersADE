import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, Equals } from 'class-validator';
import { IsClockTime, trim } from '../../shared/validation';

export class StaffMemberDto {
  @ApiPropertyOptional() @IsOptional() @trim @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @ApiPropertyOptional({ example: 'barista' }) @IsOptional() @trim @IsString() @IsNotEmpty() @MaxLength(60) position?: string;
  @ApiPropertyOptional({ example: '08:00' }) @IsOptional() @IsClockTime() shiftStart?: string;
  @ApiPropertyOptional({ example: '16:00' }) @IsOptional() @IsClockTime() shiftEnd?: string;
  @ApiPropertyOptional({ description: 'Send alone as false to archive' }) @IsOptional() @Equals(false) active?: false;
}
