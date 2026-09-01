import { Transform, Type } from 'class-transformer';
import {
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

  @IsString()
  @Length(2, 80)
  sourceModule!: string;

  @IsString()
  @Length(2, 120)
  sourceEntityType!: string;

  @IsString()
  @Length(2, 160)
  sourceEntityId!: string;

  @IsString()
  @Length(2, 240)
  sourceDisplayLabel!: string;

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
