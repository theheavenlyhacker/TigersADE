import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { trim } from '../../shared/validation';

const ROLES = ['owner', 'manager', 'cashier'] as const;
type RoleName = typeof ROLES[number];

export class CreateUserDto {
  @ApiProperty() @trim @IsEmail() email!: string;
  @ApiProperty() @trim @IsString() @IsNotEmpty() name!: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) password!: string;
  @ApiProperty({ enum: ROLES }) @IsIn(ROLES) role!: RoleName;
  @ApiProperty({ type: [String], description: 'Empty for the owner; at least one for everyone else' }) @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true }) branchIds!: string[];
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID() staffMemberId?: string | null;
}

export class ChangeUserDto {
  @ApiProperty({ enum: ROLES }) @IsIn(ROLES) role!: RoleName;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true }) branchIds!: string[];
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID() staffMemberId?: string | null;
}

export class ResetPasswordDto {
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) password!: string;
}
