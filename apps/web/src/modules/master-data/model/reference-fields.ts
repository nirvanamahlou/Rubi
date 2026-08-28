import type { MasterDataRecord, MasterDataResource } from '@rubi/contracts';

import type { MasterDataResourceKey } from './catalog';

export interface ReferenceFieldConfig {
  target: MasterDataResource;
  payload: 'id' | 'code';
  requiredRole?: string;
  optional?: boolean;
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
  },
  airlines: {
    organizationId: {
      target: 'organizations',
      payload: 'id',
      requiredRole: 'AIRLINE',
    },
  },
  brokers: {
    organizationId: {
      target: 'organizations',
      payload: 'id',
      requiredRole: 'BROKER',
    },
  },
  hotels: {
    cityId: { target: 'cities', payload: 'id' },
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
