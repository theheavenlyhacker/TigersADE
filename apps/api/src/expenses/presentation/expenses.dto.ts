import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsBusinessDate, IsCentavos } from '../../shared/validation';

export class CreateExpenseDto {
  @ApiProperty() @IsUUID() categoryId!: string;
  @ApiProperty() @IsBusinessDate() businessDate!: string;
  @ApiProperty({ description: 'Positive centavos' }) @IsCentavos({ positive: true }) amount!: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(1000) note?: string | null;
}

export class UpdateExpenseDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBusinessDate() businessDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsCentavos({ positive: true }) amount?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(1000) note?: string | null;
}

export class ExpenseRangeDto {
  @ApiProperty() @IsBusinessDate() from!: string;
  @ApiProperty() @IsBusinessDate() to!: string;
}
