import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsCentavos, IsQuantity, trim } from '../../shared/validation';

export const MOVEMENT_TYPES = ['received', 'wastage', 'adjustment', 'count'] as const;
export const REORDER_STATUSES = ['requested', 'received', 'cancelled'] as const;

export class CreateItemDto {
  @ApiProperty() @trim @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @ApiProperty({ example: 'kg' }) @trim @IsString() @IsNotEmpty() @MaxLength(20) unit!: string;
  @ApiProperty({ description: 'Centavos per unit' }) @IsCentavos() unitCost!: string;
}

export class UpdateItemDto {
  @ApiPropertyOptional() @IsOptional() @trim @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @trim @IsString() @IsNotEmpty() @MaxLength(20) unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsCentavos() unitCost?: string;
  @ApiPropertyOptional({ description: 'Send false to archive' }) @IsOptional() @Equals(false) active?: false;
}

export class StockQuery {
  @ApiPropertyOptional({ enum: ['true', 'false'] }) @IsOptional() @IsIn(['true', 'false']) low?: string;
}

export class SetParDto {
  @ApiProperty() @IsQuantity({ nonNegative: true }) par!: string;
}

export class MovementDto {
  @ApiProperty() @IsUUID() itemId!: string;
  @ApiProperty({ enum: MOVEMENT_TYPES }) @IsIn(MOVEMENT_TYPES) type!: typeof MOVEMENT_TYPES[number];
  @ApiProperty({ description: 'Up to three decimals; for a count, the quantity counted' }) @IsQuantity() quantity!: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(1000) note?: string | null;
}

export class MovementsQuery {
  @ApiPropertyOptional() @IsOptional() @IsUUID() itemId?: string;
}

export class RequestReorderDto {
  @ApiProperty() @IsUUID() itemId!: string;
  @ApiProperty({ description: 'Positive, up to three decimals' }) @IsQuantity({ nonNegative: true }) quantity!: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(1000) note?: string | null;
}

export class ReordersQuery {
  @ApiPropertyOptional({ enum: REORDER_STATUSES }) @IsOptional() @IsIn(REORDER_STATUSES) status?: typeof REORDER_STATUSES[number];
}
