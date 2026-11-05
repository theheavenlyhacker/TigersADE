import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ format: 'email' }) @IsString() @MaxLength(254) email!: string;
  @ApiProperty({ format: 'password' }) @IsString() @MaxLength(128) password!: string;
}
