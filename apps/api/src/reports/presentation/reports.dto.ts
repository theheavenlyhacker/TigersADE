import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { IsBusinessDate } from '../../shared/validation';

export class BranchQuery {
  @ApiProperty({ description: 'A branch id, or "all" (owner only)' }) @IsString() @IsNotEmpty() branch!: string;
}
export class SummaryQuery extends BranchQuery {
  @ApiPropertyOptional() @IsOptional() @IsBusinessDate() date?: string;
}
export class TrendQuery extends BranchQuery {
  @ApiPropertyOptional({ enum: ['daily', 'weekly', 'monthly'] }) @IsIn(['daily', 'weekly', 'monthly']) granularity: 'daily' | 'weekly' | 'monthly' = 'daily';
  @ApiPropertyOptional() @IsOptional() @IsBusinessDate() date?: string;
}
export class SalesRangeQuery extends BranchQuery {
  @ApiProperty() @IsBusinessDate() from!: string;
  @ApiProperty() @IsBusinessDate() to!: string;
}
export class ExpenseReportQuery extends BranchQuery {
  @ApiProperty({ example: '2026-11' }) @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' }) month!: string;
}
