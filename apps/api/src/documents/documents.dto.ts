import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import type {
  DocumentArchiveStatusCode,
  DocumentConfidentialityCode,
  DocumentDomainCode,
  DocumentSortCode,
  DocumentValidityFilter,
} from '@rubi/contracts';
import {
  DOCUMENT_ARCHIVE_STATUS_CODES,
  DOCUMENT_CONFIDENTIALITY_CODES,
  DOCUMENT_DOMAIN_CODES,
  DOCUMENT_PERSONAL_VIEW_CODES,
  DOCUMENT_SCAN_STATUS_CODES,
} from '@rubi/contracts';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class DocumentListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  typeCode?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsEnum(DOCUMENT_DOMAIN_CODES)
  domain?: DocumentDomainCode;

  @IsOptional()
  @IsEnum(DOCUMENT_ARCHIVE_STATUS_CODES)
  archiveStatus?: DocumentArchiveStatusCode;

  @IsOptional()
  @IsEnum(DOCUMENT_SCAN_STATUS_CODES)
  scanStatus?: (typeof DOCUMENT_SCAN_STATUS_CODES)[number];

  @IsOptional()
  @IsIn(['ALL', 'VALID', 'EXPIRING', 'EXPIRED', 'WITHOUT_EXPIRY'])
  validity?: DocumentValidityFilter;

  @IsOptional()
  @IsIn(['COMPLETE', 'INCOMPLETE'])
  completion?: 'COMPLETE' | 'INCOMPLETE';

  @IsOptional()
  @IsIn(['INCOMPLETE_OR_EXPIRED'])
  attention?: 'INCOMPLETE_OR_EXPIRED';

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsEnum(DOCUMENT_CONFIDENTIALITY_CODES)
  confidentiality?: DocumentConfidentialityCode;

  @IsOptional()
  @IsDateString({ strict: true })
  createdFrom?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  createdTo?: string;

  @IsOptional()
  @IsEnum(DOCUMENT_PERSONAL_VIEW_CODES)
  personalView?: (typeof DOCUMENT_PERSONAL_VIEW_CODES)[number];

  @IsOptional()
  @IsIn([
    'createdAt',
    'updatedAt',
    'title',
    'archiveCode',
    'validUntil',
    'sizeBytes',
  ])
  sortBy?: DocumentSortCode;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(100)
  pageSize?: number;
}

export class DocumentCaseOptionsQueryDto {
  @IsUUID()
  branchId!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(50)
  limit?: number;
}

export class DocumentUploadDto {
  @IsString()
  @Length(2, 240)
  title!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsUUID()
  documentTypeId!: string;

  @IsUUID()
  categoryId!: string;

  @IsUUID()
  branchId!: string;

  @IsUUID()
  ownerUserId!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  sourceRelationId?: string;

  @ValidateIf((input: DocumentUploadDto) => !input.sourceRelationId)
  @IsString()
  @Length(2, 80)
  sourceModule?: string;

  @ValidateIf((input: DocumentUploadDto) => !input.sourceRelationId)
  @IsString()
  @Length(2, 120)
  sourceEntityType?: string;

  @ValidateIf((input: DocumentUploadDto) => !input.sourceRelationId)
  @IsString()
  @Length(2, 160)
  sourceEntityId?: string;

  @ValidateIf((input: DocumentUploadDto) => !input.sourceRelationId)
  @IsString()
  @Length(2, 240)
  sourceDisplayLabel?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(DOCUMENT_CONFIDENTIALITY_CODES)
  confidentiality?: DocumentConfidentialityCode;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString({ strict: true })
  validUntil?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  versionNote?: string;
}

export class DocumentUpdateDto {
  @IsString()
  @Length(2, 240)
  title!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsUUID()
  categoryId!: string;

  @IsUUID()
  ownerUserId!: string;

  @IsEnum(DOCUMENT_CONFIDENTIALITY_CODES)
  confidentiality!: DocumentConfidentialityCode;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString({ strict: true })
  validUntil?: string;

  @IsBoolean()
  isIncomplete!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class DocumentArchiveActionDto {
  @IsString()
  @Length(5, 500)
  reason!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class DocumentDeleteDto extends DocumentArchiveActionDto {}

export class DocumentBulkActionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsIn(['MARK_INCOMPLETE', 'MARK_COMPLETE', 'ARCHIVE', 'RESTORE'])
  action!: 'MARK_INCOMPLETE' | 'MARK_COMPLETE' | 'ARCHIVE' | 'RESTORE';

  @IsString()
  @Length(5, 500)
  reason!: string;
}
