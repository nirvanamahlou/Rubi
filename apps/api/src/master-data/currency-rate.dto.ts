import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import type { MasterCurrencyRateQuoteRequest } from '@rubi/contracts';

export class CurrencyRateQuoteDto implements MasterCurrencyRateQuoteRequest {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  fromCurrencyCode!: string;
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  toCurrencyCode!: string;
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,14}(\.\d{1,10})?$/)
  buyRate?: string;
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,14}(\.\d{1,10})?$/)
  sellRate?: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  source!: string;
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  observedAt!: string;
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  validFrom?: string;
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  validTo?: string;
  @IsOptional() @IsString() @MaxLength(500) correctionReason?: string;
}

export class CurrencyRateListDto {
  @IsOptional() @IsString() @MaxLength(100) columnFilter1?: string;
  @IsOptional() @IsString() @MaxLength(100) columnFilter2?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsUUID() fromCurrencyId?: string;
  @IsOptional() @IsUUID() toCurrencyId?: string;
  @IsOptional() @IsIn(['BUY', 'SELL', 'REFERENCE']) rateType?:
    'BUY' | 'SELL' | 'REFERENCE';
  @IsOptional() @IsIn(['DRAFT', 'APPROVED', 'REJECTED', 'EXPIRED']) status?:
    'DRAFT' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  @IsOptional() @IsISO8601({ strict: true }) observedFrom?: string;
  @IsOptional() @IsISO8601({ strict: true }) observedTo?: string;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page =
    1;
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(10)
  @Max(100)
  pageSize = 25;
}

export class CurrencyRateDecisionDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @MaxLength(500) reason!: string;
}
