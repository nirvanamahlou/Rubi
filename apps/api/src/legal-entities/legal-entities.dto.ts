import { Transform } from 'class-transformer';
import {
  LEGAL_ENTITY_CODES,
  LEGAL_ENTITY_CONTEXT_ALL,
  type LegalEntitySelection,
} from '@rubi/contracts';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const legalEntitySelections = [
  ...LEGAL_ENTITY_CODES,
  LEGAL_ENTITY_CONTEXT_ALL,
] as const;

export class SwitchLegalEntityDto {
  @IsIn(legalEntitySelections)
  selection!: LegalEntitySelection;

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class UpdateLegalEntityDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsString() @MaxLength(200) persianName?: string;
  @IsOptional() @IsString() @MaxLength(200) latinName?: string | null;
  @IsOptional() @IsString() @MaxLength(200) tradeName?: string | null;
  @IsOptional() @IsUUID() logoFileId?: string | null;
  @IsOptional() @IsUUID() letterheadFileId?: string | null;
  @IsOptional() @IsUUID() footerFileId?: string | null;
  @IsOptional() @IsString() @MaxLength(500) address?: string | null;
  @IsOptional() @IsString() @MaxLength(80) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(320) email?: string | null;
  @IsOptional() @IsString() @MaxLength(320) website?: string | null;
  @IsOptional() @IsString() @MaxLength(80) nationalId?: string | null;
  @IsOptional() @IsString() @MaxLength(80) registrationNumber?: string | null;
  @IsOptional() @IsString() @MaxLength(80) economicCode?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) paymentText?: string | null;
  @IsOptional() @IsUUID() sealFileId?: string | null;
  @IsOptional() @IsUUID() authorizedSignatureId?: string | null;
  @IsOptional() @Matches(/^#[0-9a-f]{6}$/i) primaryColor?: string | null;
  @IsOptional() @Matches(/^#[0-9a-f]{6}$/i) secondaryColor?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) legalFooterText?: string | null;
}

export class LegalEntityStatusDto {
  @IsIn(['active', 'inactive']) status!: 'active' | 'inactive';
  @IsInt() @Min(1) expectedVersion!: number;
  @IsBoolean() confirm!: boolean;
}

export class IssueTargetQueryDto {
  @IsOptional() @IsIn(['prompt', 'separate']) strategy: 'prompt' | 'separate' =
    'prompt';
}

export class CreateDocumentIssueDto {
  @IsUUID() issuerLegalEntityId!: string;
  @IsString() @MinLength(1) @MaxLength(120) templateId!: string;
  @IsString() @MinLength(1) @MaxLength(80) templateVersion!: string;
  @IsString() @MinLength(1) @MaxLength(120) documentType!: string;
  @IsString() @MinLength(1) @MaxLength(120) referenceEntityType!: string;
  @IsString() @MinLength(1) @MaxLength(160) referenceEntityId!: string;
  @IsOptional() @Matches(/^[0-9a-f]{64}$/) fileHash?: string;
}

export class ReissueDocumentDto {
  @IsUUID() originalIssueId!: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  @Matches(/\S/)
  reason!: string;
  @IsOptional() @Matches(/^[0-9a-f]{64}$/) fileHash?: string;
}
