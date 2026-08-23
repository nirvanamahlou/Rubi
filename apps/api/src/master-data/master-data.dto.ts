import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class MasterDataListQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search = '';
  @IsOptional() @IsIn(['all', 'active', 'inactive']) status:
    | 'all'
    | 'active'
    | 'inactive' = 'all';
  @IsOptional() @IsIn(['name', 'code', 'updatedAt']) sortBy:
    | 'name'
    | 'code'
    | 'updatedAt' = 'name';
  @IsOptional() @IsIn(['asc', 'desc']) sortDirection: 'asc' | 'desc' = 'asc';
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1)
  page = 1;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(10) @Max(100)
  pageSize = 25;
}

export class MasterDataMutationDto {
  @IsObject()
  values!: Record<string, string | number | readonly string[] | null>;

  @IsOptional() @IsInt() @Min(1)
  version?: number;
}

export class MasterDataStatusDto {
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';

  @IsInt() @Min(1)
  version!: number;
}

export class MasterDataExportDto {
  @IsIn([
    'countries', 'cities', 'currencies', 'exchange-rates', 'banks', 'insurers',
    'airlines', 'hotels', 'organizations', 'brokers', 'leaders',
    'acquaintance-methods',
  ])
  resource!: string;

  @IsIn(['xlsx', 'pdf'])
  format!: 'xlsx' | 'pdf';

  @IsObject()
  filters!: Record<string, unknown>;

  @IsArray() @IsString({ each: true })
  columns!: string[];

  @IsIn(['fa-IR'])
  locale!: 'fa-IR';

  @IsString() @MaxLength(80)
  timezone!: string;
}
