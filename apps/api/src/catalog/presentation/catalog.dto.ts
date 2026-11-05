import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsCentavos, trim } from '../../shared/validation';

export class NameDto {
  @ApiProperty() @trim @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
}

export class UpdateProductCategoryDto {
  @ApiPropertyOptional() @IsOptional() @trim @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @ApiPropertyOptional({ description: 'Send false to archive' }) @IsOptional() @Equals(false) active?: false;
}

export class CreateProductDto {
  @ApiProperty() @trim @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @ApiProperty() @IsUUID() categoryId!: string;
  @ApiProperty({ description: 'Centavos' }) @IsCentavos() price!: string;
  @ApiProperty({ description: 'Centavos' }) @IsCentavos() unitCost!: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional() @IsOptional() @trim @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsCentavos() price?: string;
  @ApiPropertyOptional() @IsOptional() @IsCentavos() unitCost?: string;
  @ApiPropertyOptional({ description: 'Send false to archive' }) @IsOptional() @Equals(false) active?: false;
}
