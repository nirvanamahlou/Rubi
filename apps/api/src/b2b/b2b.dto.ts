import { Transform } from 'class-transformer';
import {
  IsBoolean,
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
} from 'class-validator';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const decimalPattern = /^\d{1,18}(?:\.\d{1,4})?$/;

export class UpsertAgencyProfileDto {
  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsUUID()
  accountManagerUserId?: string | null;

  @IsOptional()
  @IsIn(['ACTIVE', 'UNDER_REVIEW', 'SUSPENDED', 'ENDED'])
  status: 'ACTIVE' | 'UNDER_REVIEW' | 'SUSPENDED' | 'ENDED' = 'ACTIVE';

  @IsOptional()
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

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsUUID()
  documentReference?: string | null;

  @Matches(datePattern)
  startsAt!: string;

  @IsOptional()
  @Matches(datePattern)
  endsAt?: string | null;

  @IsOptional()
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

  @Transform(({ value }) => String(value).replaceAll(',', '').trim())
  @Matches(decimalPattern)
  creditLimit!: string;

  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Matches(/^[A-Z]{3}$/)
  currencyCode!: string;

  @Matches(datePattern)
  effectiveFrom!: string;

  @IsOptional()
  @Matches(datePattern)
  expiresAt?: string | null;

  @IsOptional()
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

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  serviceReference!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsIn(['FIXED_AMOUNT', 'DISCOUNT_PERCENT', 'COMMISSION_PERCENT'])
  kind!: 'FIXED_AMOUNT' | 'DISCOUNT_PERCENT' | 'COMMISSION_PERCENT';

  @Transform(({ value }) => String(value).replaceAll(',', '').trim())
  @Matches(decimalPattern)
  value!: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === '' ? null : String(value).trim().toUpperCase(),
  )
  @Matches(/^[A-Z]{3}$/)
  currencyCode?: string | null;

  @Matches(datePattern)
  validFrom!: string;

  @IsOptional()
  @Matches(datePattern)
  validTo?: string | null;
}
