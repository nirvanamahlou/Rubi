import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  Length,
  MaxLength,
  MinLength,
  IsOptional,
  IsUUID,
} from 'class-validator';
export class UpdateUserDetailsDto {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUUID('4')
  organizationUnitId?: string | null;
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
