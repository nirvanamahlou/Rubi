import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class ManualUserAccessDto {
  @IsString()
  @Length(64, 64)
  revision!: string;

  @IsString()
  @MaxLength(80)
  title!: string;

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(3000)
  @IsString({ each: true })
  permissionCodes!: string[];

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(3000)
  @IsString({ each: true })
  screenIds!: string[];

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(3000)
  @IsString({ each: true })
  allowedControlIds!: string[];
}
