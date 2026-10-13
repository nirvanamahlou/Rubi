import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ramtin' })
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+$/)
  @MinLength(3)
  @MaxLength(80)
  username!: string;

  @ApiProperty({ format: 'password' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}
