import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class MasterDataListQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search = '';
  @IsOptional() @IsIn(['all', 'active', 'inactive']) status:
    'all' | 'active' | 'inactive' = 'all';
  @IsOptional() @IsIn(['name', 'code', 'updatedAt']) sortBy:
    'name' | 'code' | 'updatedAt' = 'name';
  @IsOptional() @IsIn(['asc', 'desc']) sortDirection: 'asc' | 'desc' = 'asc';
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(10)
  @Max(100)
  pageSize = 25;

  @IsOptional()
  @IsUUID()
  countryId?: string;
  @IsOptional()
  @IsUUID()
  regionId?: string;
  @IsOptional()
  @IsUUID()
  cityId?: string;
  @IsOptional()
  @IsUUID()
  airportId?: string;
  @IsOptional()
  @IsUUID()
  bankId?: string;
  @IsOptional()
  @IsIn(['DOMESTIC', 'INTERNATIONAL', 'VIP'])
  terminalType?: 'DOMESTIC' | 'INTERNATIONAL' | 'VIP';
  @IsOptional()
  @IsIn([
    'CASH',
    'POS',
    'BANK_TRANSFER',
    'ONLINE_GATEWAY',
    'CREDIT',
    'WALLET',
    'OTHER',
  ])
  paymentChannel?: string;
  @IsOptional()
  @IsIn(['RECEIPT', 'PAYMENT', 'BOTH'])
  paymentDirection?: string;
  @IsOptional()
  @IsUUID()
  organizationId?: string;
  @IsOptional()
  @IsUUID()
  serviceId?: string;
  @IsOptional()
  @IsIn(['ACTIVE', 'UNDER_REVIEW', 'PURCHASE_SUSPENDED', 'ENDED'])
  collaborationStatus?: string;
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  providerConnected?: boolean;
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasWhatsapp?: boolean;
  @IsOptional()
  @IsIn(['all', 'complete', 'incomplete'])
  contactCompleteness?: 'all' | 'complete' | 'incomplete';
  @IsOptional()
  @IsUUID()
  chainId?: string;
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(5)
  starRating?: number;
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(20)
  referenceCapacity?: number;
  @IsOptional()
  @IsIn(['MEAL_PLAN', 'SERVICE'])
  mealServiceCategory?: 'MEAL_PLAN' | 'SERVICE';
  @IsOptional()
  @IsString()
  @MaxLength(80)
  facilityCategory?: string;
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  saleableOnly?: boolean;
  @IsOptional()
  @IsUUID()
  insurerId?: string;
  @IsOptional()
  @IsUUID()
  currencyId?: string;
  @IsOptional()
  @IsString()
  @MaxLength(160)
  destinationRegion?: string;
  @IsOptional()
  @IsUUID()
  supplierId?: string;
  @IsOptional()
  @IsIn(['DOMESTIC', 'INTERNATIONAL', 'BOTH'])
  tourScope?: 'DOMESTIC' | 'INTERNATIONAL' | 'BOTH';
  @IsOptional()
  @IsIn(['PRIVATE', 'SHARED'])
  transferServiceMode?: 'PRIVATE' | 'SHARED';
  @IsOptional()
  @IsIn(['ADT', 'CHD', 'INF', 'ALL'])
  passengerScope?: 'ADT' | 'CHD' | 'INF' | 'ALL';
  @IsOptional()
  @IsIn(['STANDARD', 'VIP', 'LUXURY', 'OTHER'])
  busServiceClass?: 'STANDARD' | 'VIP' | 'LUXURY' | 'OTHER';
}

export class MasterDataMutationDto {
  @IsObject()
  values!: Record<string, string | number | readonly string[] | null>;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class MasterDataDeleteDto {
  @IsInt()
  @Min(1)
  @Max(2147483646)
  version!: number;
}

export class MasterDataStatusDto {
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';

  @IsInt()
  @Min(1)
  version!: number;
}

export class MasterDataExportDto {
  @IsIn([
    'countries',
    'regions',
    'cities',
    'airports',
    'terminals',
    'currencies',
    'exchange-rates',
    'banks',
    'bank-branches',
    'payment-methods',
    'insurers',
    'insurance-plans',
    'insurance-coverages',
    'airlines',
    'aircraft-types',
    'cabin-classes',
    'baggage-rules',
    'manifest-templates',
    'rail-companies',
    'train-types',
    'bus-companies',
    'bus-types',
    'hotels',
    'hotel-chains',
    'room-types',
    'meal-services',
    'facilities',
    'composite-hotels',
    'organizations',
    'suppliers',
    'brokers',
    'travel-services',
    'organization-contacts',
    'leaders',
    'tour-types',
    'transfer-types',
    'cip-services',
    'visa-services',
    'acquaintance-methods',
    'lead-sources',
    'sales-channels',
    'lost-reasons',
    'customer-types',
    'tags',
    'campaign-types',
  ])
  resource!: string;

  @IsIn(['xlsx', 'pdf'])
  format!: 'xlsx' | 'pdf';

  @IsObject()
  filters!: Record<string, unknown>;

  @IsArray()
  @IsString({ each: true })
  columns!: string[];

  @IsIn(['fa-IR'])
  locale!: 'fa-IR';

  @IsString()
  @MaxLength(80)
  timezone!: string;
}
