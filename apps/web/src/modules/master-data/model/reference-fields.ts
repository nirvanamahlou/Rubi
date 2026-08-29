import type { MasterDataRecord, MasterDataResource } from '@rubi/contracts';

import type { MasterDataResourceKey } from './catalog';

export interface ReferenceFieldConfig {
  target: MasterDataResource;
  payload: 'id' | 'code';
  requiredRole?: string;
  optional?: boolean;
  multiple?: boolean;
}
export type ReferenceSelectorState =
  'loading' | 'ready' | 'empty' | 'error' | 'forbidden';

export function resolveReferenceSelectorState(input: {
  loading?: boolean;
  optionCount?: number;
  errorStatus?: number;
}): ReferenceSelectorState {
  if (input.loading) return 'loading';
  if (input.errorStatus === 403) return 'forbidden';
  if (input.errorStatus !== undefined) return 'error';
  return (input.optionCount ?? 0) > 0 ? 'ready' : 'empty';
}

const configs: Partial<
  Record<MasterDataResourceKey, Record<string, ReferenceFieldConfig>>
> = {
  regions: {
    countryId: { target: 'countries', payload: 'id' },
    parentRegionId: { target: 'regions', payload: 'id', optional: true },
  },
  cities: {
    countryId: { target: 'countries', payload: 'id' },
    regionId: { target: 'regions', payload: 'id', optional: true },
  },
  airports: {
    countryId: { target: 'countries', payload: 'id' },
    cityId: { target: 'cities', payload: 'id' },
  },
  terminals: {
    airportId: { target: 'airports', payload: 'id' },
  },
  banks: {
    countryId: { target: 'countries', payload: 'id' },
  },
  'bank-branches': {
    bankId: { target: 'banks', payload: 'id' },
    cityId: { target: 'cities', payload: 'id' },
  },
  insurers: {
    organizationId: {
      target: 'organizations',
      payload: 'id',
      requiredRole: 'INSURANCE_PROVIDER',
    },
    countryId: { target: 'countries', payload: 'id' },
  },
  'insurance-plans': {
    insurerId: { target: 'insurers', payload: 'id' },
    coverageIds: {
      target: 'insurance-coverages',
      payload: 'id',
      multiple: true,
    },
  },
  'insurance-coverages': {
    currencyId: { target: 'currencies', payload: 'id' },
  },
  airlines: {
    organizationId: {
      target: 'organizations',
      payload: 'id',
      requiredRole: 'AIRLINE',
    },
    countryId: { target: 'countries', payload: 'id', optional: true },
  },
  'baggage-rules': {
    airlineId: { target: 'airlines', payload: 'id' },
    cabinClassId: {
      target: 'cabin-classes',
      payload: 'id',
      optional: true,
    },
  },
  'manifest-templates': {
    airlineId: { target: 'airlines', payload: 'id' },
  },
  'rail-companies': {
    organizationId: {
      target: 'organizations',
      payload: 'id',
      requiredRole: 'RAIL_OPERATOR',
    },
    countryId: { target: 'countries', payload: 'id' },
  },
  'bus-companies': {
    organizationId: {
      target: 'organizations',
      payload: 'id',
      requiredRole: 'BUS_PROVIDER',
    },
    countryId: { target: 'countries', payload: 'id' },
  },
  brokers: {
    organizationId: {
      target: 'organizations',
      payload: 'id',
      requiredRole: 'BROKER',
    },
    countryId: { target: 'countries', payload: 'id', optional: true },
    cityId: { target: 'cities', payload: 'id', optional: true },
  },
  suppliers: {
    organizationId: {
      target: 'organizations',
      payload: 'id',
      requiredRole: 'SUPPLIER',
    },
    countryId: { target: 'countries', payload: 'id', optional: true },
    cityId: { target: 'cities', payload: 'id', optional: true },
  },
  'organization-contacts': {
    organizationId: { target: 'organizations', payload: 'id' },
  },
  hotels: {
    cityId: { target: 'cities', payload: 'id' },
    chainId: {
      target: 'hotel-chains',
      payload: 'id',
      optional: true,
    },
    mealServiceIds: {
      target: 'meal-services',
      payload: 'id',
      optional: true,
      multiple: true,
    },
    roomTypeIds: {
      target: 'room-types',
      payload: 'id',
      optional: true,
      multiple: true,
    },
    facilityIds: {
      target: 'facilities',
      payload: 'id',
      optional: true,
      multiple: true,
    },
  },
  'hotel-chains': {
    countryId: { target: 'countries', payload: 'id' },
  },
  'composite-hotels': {
    cityId: { target: 'cities', payload: 'id' },
    memberHotelIds: {
      target: 'hotels',
      payload: 'id',
      multiple: true,
    },
    backupMemberIds: {
      target: 'hotels',
      payload: 'id',
      optional: true,
      multiple: true,
    },
  },
  'exchange-rates': {
    fromCurrencyCode: { target: 'currencies', payload: 'code' },
    toCurrencyCode: { target: 'currencies', payload: 'code' },
  },
};

export const ORGANIZATION_ROLE_OPTIONS = [
  ['AGENCY', 'آژانس'],
  ['CORPORATE_CUSTOMER', 'مشتری سازمانی'],
  ['SUPPLIER', 'تأمین‌کننده'],
  ['AIRLINE', 'ایرلاین'],
  ['HOTEL_PROVIDER', 'تأمین‌کننده هتل'],
  ['INSURANCE_PROVIDER', 'بیمه‌گر'],
  ['BUS_PROVIDER', 'تأمین‌کننده اتوبوس'],
  ['RAIL_OPERATOR', 'شرکت ریلی'],
  ['TOUR_OPERATOR', 'مجری تور'],
  ['BROKER', 'کارگزار'],
] as const;

export function getReferenceFieldConfig(
  resource: MasterDataResourceKey,
  field: string,
): ReferenceFieldConfig | undefined {
  return configs[resource]?.[field];
}

export function mapReferenceOption(
  config: ReferenceFieldConfig,
  record: MasterDataRecord,
): string {
  return config.payload === 'code' ? record.code : record.id;
}

export function hasOrganizationRole(
  record: MasterDataRecord,
  requiredRole?: string,
): boolean {
  if (!requiredRole) return true;
  return String(record.attributes.roleCodes ?? '')
    .split(',')
    .includes(requiredRole);
}

export function toggleOrganizationRole(
  current: string,
  role: string,
  checked: boolean,
): string {
  const selected = new Set(current.split(',').filter(Boolean));
  if (checked) selected.add(role);
  else selected.delete(role);
  return ORGANIZATION_ROLE_OPTIONS.map(([code]) => code)
    .filter((code) => selected.has(code))
    .join(',');
}
