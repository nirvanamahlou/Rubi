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
} from 'class-validator';

export class CurrencyRateListDto {
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
