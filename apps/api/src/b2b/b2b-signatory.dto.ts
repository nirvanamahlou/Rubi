import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  B2B_SIGNATORY_DOCUMENT_TYPES,
  type B2bSignatoryDocumentType,
  type B2bSignatoryInputV1,
} from '@rubi/contracts';
export class SaveB2bSignatoryDto implements B2bSignatoryInputV1 {
  @IsUUID() branchId!: string;
  @IsUUID() contactId!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsIn(B2B_SIGNATORY_DOCUMENT_TYPES, { each: true })
  documentTypes!: B2bSignatoryDocumentType[];
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}(?:\.\d{1,4})?$/)
  authorityLimit: string | null = null;
  @IsOptional() @Matches(/^[A-Z]{3}$/) currencyCode: string | null = null;
  @IsDateString() @Matches(/^\d{4}-\d{2}-\d{2}$/) validFrom!: string;
  @IsOptional() @IsDateString() @Matches(/^\d{4}-\d{2}-\d{2}$/) validTo:
    string | null = null;
  @IsOptional() @IsUUID() documentId: string | null = null;
  @IsOptional() @IsUUID() documentVersionId: string | null = null;
  @IsBoolean() isActive = false;
  @IsString() @MaxLength(1000) notes = '';
  @IsOptional() @IsInt() @Min(1) version?: number;
}
