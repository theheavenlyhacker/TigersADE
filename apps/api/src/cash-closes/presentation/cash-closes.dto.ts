import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsBusinessDate, IsCentavos } from '../../shared/validation';

export class PreviewQuery {
  @ApiPropertyOptional() @IsOptional() @IsBusinessDate() businessDate?: string;
}

export class SubmitCashCloseDto {
  @ApiProperty() @IsBusinessDate() businessDate!: string;
  @ApiProperty({ description: 'Centavos' }) @IsCentavos() openingFloat!: string;
  @ApiProperty({ description: 'Centavos' }) @IsCentavos() countedCash!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
