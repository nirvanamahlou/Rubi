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
} from 'class-validator';

export class SwitchLegalEntityDto {
  @IsIn(['NIYAYESH_SEIR_SAHAR', 'JAHAN_BASTAN', 'ALL'])
  selection!: 'NIYAYESH_SEIR_SAHAR' | 'JAHAN_BASTAN' | 'ALL';

  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
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
  @IsString() @MaxLength(80) templateVersion!: string;
  @IsString() @MaxLength(120) documentType!: string;
  @IsString() @MaxLength(120) referenceEntityType!: string;
  @IsString() @MaxLength(160) referenceEntityId!: string;
  @IsOptional() @Matches(/^[0-9a-f]{64}$/) fileHash?: string;
  @IsOptional() @IsBoolean() requiresLetterhead?: boolean;
}

export class ReissueDocumentDto {
  @IsUUID() originalIssueId!: string;
  @IsString() @MaxLength(500) reason!: string;
  @IsString() @MaxLength(80) templateVersion!: string;
  @IsOptional() @Matches(/^[0-9a-f]{64}$/) fileHash?: string;
}
