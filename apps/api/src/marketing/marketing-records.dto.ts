import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const AMOUNT = /^\d{1,20}(?:\.\d{1,4})?$/;
const CURRENCY = /^[A-Z]{3}$/;
const ASSET_KINDS = [
  'SEGMENT',
  'MESSAGE',
  'SCHEDULE',
  'FORM',
  'LANDING_PAGE',
  'SHORT_LINK',
  'AUTOMATION',
  'COUPON',
  'OFFER',
] as const;

export class MarketingSpendLineDto {
  @IsString() @Length(1, 160) label!: string;
  @Matches(AMOUNT) amount!: string;
  @Matches(CURRENCY) currencyCode!: string;
}

export class MarketingCampaignMutationDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{2,64}$/) internalCode!: string;
  @IsString() @Length(2, 200) name!: string;
  @IsString() @Length(1, 80) campaignType!: string;
  @IsString() @Length(2, 1000) objective!: string;
  @IsString() @Length(1, 80) executionCompany!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsString({ each: true })
  channels!: string[];
  @IsUUID() ownerUserId!: string;
  @IsOptional() @IsUUID() segmentId?: string | null;
  @Matches(AMOUNT) salesTarget!: string;
  @Matches(CURRENCY) targetCurrencyCode!: string;
  @Matches(AMOUNT) budgetAmount!: string;
  @Matches(CURRENCY) budgetCurrencyCode!: string;
  @IsISO8601({ strict: true }) startsAt!: string;
  @IsISO8601({ strict: true }) endsAt!: string;
  @IsOptional() @IsString() @MaxLength(160) utmSource?: string | null;
  @IsOptional() @IsString() @MaxLength(160) utmMedium?: string | null;
  @IsOptional() @IsString() @MaxLength(160) utmCampaign?: string | null;
  @IsOptional() @IsString() @MaxLength(160) utmTerm?: string | null;
  @IsOptional() @IsString() @MaxLength(160) utmContent?: string | null;
  @IsInt() @Min(1) @Max(100000) frequencyCap!: number;
  @IsOptional() @Matches(/^\d{1,3}(?:\.\d{1,4})?$/) progressPercent?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => MarketingSpendLineDto)
  spendLines?: MarketingSpendLineDto[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  links?: string[];
  @IsOptional() @IsInt() @Min(1) expectedVersion?: number;
}

export class MarketingPublicationDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsISO8601({ strict: true }) scheduledFor?: string | null;
}

export class MarketingAssetMutationDto {
  @IsIn(ASSET_KINDS) kind!: (typeof ASSET_KINDS)[number];
  @IsString() @Length(2, 200) name!: string;
  @IsString() @Length(1, 32) status!: string;
  @IsOptional() @IsUUID() campaignId?: string | null;
  @IsOptional() @IsUUID() relatedAssetId?: string | null;
  @IsOptional() @IsUUID() targetCustomerId?: string | null;
  @IsOptional() @IsUUID() targetAgencyId?: string | null;
  @IsOptional() @IsISO8601({ strict: true }) scheduledAt?: string | null;
  @IsOptional() @IsISO8601({ strict: true }) expiresAt?: string | null;
  @IsObject() payload!: Record<string, unknown>;
  @IsOptional() @IsInt() @Min(1) expectedVersion?: number;
}

export class MarketingAssetListQueryDto {
  @IsOptional() @IsIn(ASSET_KINDS) kind?: (typeof ASSET_KINDS)[number];
}

export class MarketingAssetDeleteDto {
  @IsInt() @Min(1) expectedVersion!: number;
}
