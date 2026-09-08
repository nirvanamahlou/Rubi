import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsObject,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { B2B_SERVICE_CODES } from '@rubi/contracts';
import type {
  B2bAgreementTermsV1,
  B2bCreditDraftV1,
  B2bGuaranteeDraftV1,
} from '@rubi/contracts';

const nullable = (_: unknown, value: unknown) => value !== null;
const optional = (_: unknown, value: unknown) => value !== undefined;
const day = /^\d{4}-\d{2}-\d{2}$/;
const amount = /^\d{1,18}(?:\.\d{1,2})?$/;
export class B2bCreditDraftDto implements B2bCreditDraftV1 {
  @Matches(/^[A-Z]{3}$/) currencyCode!: string;
  @Matches(amount) creditLimit!: string;
  @IsIn(['HARD', 'SOFT']) limitType!: 'HARD' | 'SOFT';
  @IsInt() @Min(0) @Max(365) dueDays!: number;
  @IsIn(['BLOCK', 'WARN']) overdueAction!: 'BLOCK' | 'WARN';
  @Matches(day) effectiveFrom!: string;
  @ValidateIf(nullable) @Matches(day) expiresAt!: string | null;
}
export class B2bGuaranteeDraftDto implements B2bGuaranteeDraftV1 {
  @IsIn(['BANK_GUARANTEE', 'CHEQUE', 'DEPOSIT_REQUIREMENT', 'OTHER'])
  kind!: B2bGuaranteeDraftV1['kind'];
  @IsString() @MinLength(1) @MaxLength(120) reference!: string;
  @Matches(amount) amount!: string;
  @Matches(/^[A-Z]{3}$/) currencyCode!: string;
  @IsString() @MinLength(2) @MaxLength(160) issuer!: string;
  @Matches(day) receivedAt!: string;
  @ValidateIf(nullable) @Matches(day) expiresAt!: string | null;
  @IsIn(['REQUIRED', 'RECEIVED']) status!: B2bGuaranteeDraftV1['status'];
  @ValidateIf(nullable) @IsUUID() documentId!: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsUUID()
  documentVersionId?: string | null;
}
export class B2bAgreementTermsDto implements B2bAgreementTermsV1 {
  @IsString() @MinLength(2) @MaxLength(160) title!: string;
  @IsIn(['FRAMEWORK', 'AGENCY', 'CORPORATE'])
  agreementType!: B2bAgreementTermsV1['agreementType'];
  @Matches(day) startsAt!: string;
  @ValidateIf(nullable) @Matches(day) endsAt!: string | null;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ArrayUnique()
  @Matches(/^[A-Z]{3}$/, { each: true })
  currencyCodes!: string[];
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsIn(B2B_SERVICE_CODES, { each: true })
  services!: B2bAgreementTermsV1['services'];
  @IsIn(['PREPAID', 'CREDIT', 'MIXED'])
  paymentMethod!: B2bAgreementTermsV1['paymentMethod'];
  @IsIn(['PER_ORDER', 'WEEKLY', 'MONTHLY', 'CUSTOM'])
  settlementCycle!: B2bAgreementTermsV1['settlementCycle'];
  @IsInt() @Min(0) @Max(365) settlementDays!: number;
  @ValidateIf(nullable) @IsInt() @Min(1) @Max(28) cutoffDay!: number | null;
  @ValidateIf(nullable) @IsInt() @Min(1) @Max(720) slaHours!: number | null;
  @IsString() @MaxLength(2000) cancellationTerms!: string;
  @IsString() @MaxLength(2000) refundTerms!: string;
  @IsString() @MaxLength(2000) notes!: string;
  @IsString() @MinLength(3) @MaxLength(500) changeReason!: string;
  @ValidateIf(nullable) @IsUUID() documentId!: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsUUID()
  documentVersionId?: string | null;
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => B2bCreditDraftDto)
  creditPolicies!: B2bCreditDraftDto[];
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => B2bGuaranteeDraftDto)
  guarantees!: B2bGuaranteeDraftDto[];
}
export class SaveB2bAgreementDto {
  @IsUUID() branchId!: string;
  @IsIn(['AGENCY', 'CORPORATE_CUSTOMER']) role:
    'AGENCY' | 'CORPORATE_CUSTOMER' = 'AGENCY';
  @IsUUID() requestId!: string;
  @ValidateIf(optional) @IsInt() @Min(1) version?: number;
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => B2bAgreementTermsDto)
  terms!: B2bAgreementTermsDto;
}
export class B2bAgreementActionDto {
  @IsUUID() branchId!: string;
  @IsIn(['AGENCY', 'CORPORATE_CUSTOMER']) role:
    'AGENCY' | 'CORPORATE_CUSTOMER' = 'AGENCY';
  @IsUUID() requestId!: string;
  @IsInt() @Min(1) version!: number;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
  @ValidateIf(optional) @IsIn(['APPROVE', 'REJECT']) decision?:
    'APPROVE' | 'REJECT';
}
