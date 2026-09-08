import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const rateDecimalPattern = /^\d{1,16}(?:\.\d{1,4})?$/;
const creditDecimalPattern = /^\d{1,18}(?:\.\d{1,2})?$/;
const provided = (_object: unknown, value: unknown) => value !== undefined;

export class UpsertAgencyProfileDto {
  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsUUID()
  accountManagerUserId?: string | null;

  @ValidateIf(provided)
  @IsIn(['ACTIVE', 'UNDER_REVIEW', 'SUSPENDED', 'ENDED'])
  status: 'ACTIVE' | 'UNDER_REVIEW' | 'SUSPENDED' | 'ENDED' = 'ACTIVE';

  @ValidateIf(provided)
  @IsInt()
  @Min(0)
  @Max(2147483646)
  displayOrder = 0;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class CreateAgencyAgreementDto {
  @IsUUID()
  branchId!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsUUID()
  documentReference?: string | null;

  @Matches(datePattern)
  @IsDateString({ strict: true })
  startsAt!: string;

  @IsOptional()
  @Matches(datePattern)
  @IsDateString({ strict: true })
  endsAt?: string | null;

  @ValidateIf(provided)
  @IsIn(['DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED'])
  status: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'TERMINATED' = 'DRAFT';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpsertAgencyCreditPolicyDto {
  @IsUUID()
  branchId!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.replaceAll(',', '').trim() : value,
  )
  @Matches(creditDecimalPattern)
  creditLimit!: string;

  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Matches(/^[A-Z]{3}$/)
  currencyCode!: string;

  @Matches(datePattern)
  @IsDateString({ strict: true })
  effectiveFrom!: string;

  @IsOptional()
  @Matches(datePattern)
  @IsDateString({ strict: true })
  expiresAt?: string | null;

  @ValidateIf(provided)
  @IsBoolean()
  isActive = true;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class CreateAgencyAgreedRateDto {
  @IsUUID()
  branchId!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  serviceReference!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsIn(['FIXED_AMOUNT', 'DISCOUNT_PERCENT', 'COMMISSION_PERCENT'])
  kind!: 'FIXED_AMOUNT' | 'DISCOUNT_PERCENT' | 'COMMISSION_PERCENT';

  @Transform(({ value }) =>
    typeof value === 'string' ? value.replaceAll(',', '').trim() : value,
  )
  @Matches(rateDecimalPattern)
  value!: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === '' ? null : String(value).trim().toUpperCase(),
  )
  @Matches(/^[A-Z]{3}$/)
  currencyCode?: string | null;

  @Matches(datePattern)
  @IsDateString({ strict: true })
  validFrom!: string;

  @IsOptional()
  @Matches(datePattern)
  @IsDateString({ strict: true })
  validTo?: string | null;
}
