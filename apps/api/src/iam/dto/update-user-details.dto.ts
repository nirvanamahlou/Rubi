import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MaxLength, MinLength } from 'class-validator';
export class UpdateUserDetailsDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  displayName!: string;

  @ApiProperty()
  @IsString()
  @Length(64, 64)
  revision!: string;
}
