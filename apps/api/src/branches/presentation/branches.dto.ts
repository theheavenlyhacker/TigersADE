import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { IsCentavos, IsClockTime } from '../../shared/validation';

export class UpdateBranchDto {
  @ApiPropertyOptional({ description: 'Centavos' }) @IsOptional() @IsCentavos() dailyTarget?: string;
  @ApiPropertyOptional({ example: '04:00' }) @IsOptional() @IsClockTime() dayCutoff?: string;
}
