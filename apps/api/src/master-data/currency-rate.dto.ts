import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CurrencyRateListDto {
  @IsOptional() @IsUUID() fromCurrencyId?: string;
  @IsOptional() @IsUUID() toCurrencyId?: string;
  @IsOptional() @IsIn(['BUY', 'SELL', 'REFERENCE']) rateType?:
    'BUY' | 'SELL' | 'REFERENCE';
  @IsOptional() @IsIn(['DRAFT', 'APPROVED', 'REJECTED', 'EXPIRED']) status?:
    'DRAFT' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page =
    1;
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(10)
  pageSize = 25;
}

export class CurrencyRateDecisionDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @MaxLength(500) reason!: string;
}
