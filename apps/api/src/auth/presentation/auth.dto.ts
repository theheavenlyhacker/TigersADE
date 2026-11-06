import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ format: 'email' }) @IsString() email!: string;
  @ApiProperty({ format: 'password' }) @IsString() password!: string;
}
