import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { HOTEL_IMPORT_TEMPLATE_VERSION } from './hotel-import.parser';

export class HotelImportPreviewDto {
  @IsUUID() countryId!: string;
  @IsUUID() cityId!: string;
  @IsIn([HOTEL_IMPORT_TEMPLATE_VERSION]) templateVersion!: string;
}

export class HotelImportCommitDto {
  @IsString() @IsNotEmpty() @MaxLength(500) previewToken!: string;
  @IsString() @IsNotEmpty() @MaxLength(128) idempotencyKey!: string;
  @IsIn(['SKIP', 'UPDATE', 'CREATE_NEW']) duplicateBehavior!:
    'SKIP' | 'UPDATE' | 'CREATE_NEW';
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  createMissingReferences!: boolean;
}
