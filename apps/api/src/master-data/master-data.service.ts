import { createHash } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MASTER_DATA_RESOURCES,
  type AuthenticatedActor,
  type MasterDataListQuery,
  type MasterDataResource,
  type MasterDataDeleteResponse,
} from '@rubi/contracts';

import { assertGenericCurrencyRateMutationAllowed } from './currency-rate.policy';
import { buildMasterDataXlsx, MASTER_DATA_XLSX_MIME } from './master-data.xlsx';
import { MasterDataContactCrypto } from './master-data-contact.crypto';
import { isMasterDataDependencyError } from './master-data-deletion.policy';
import {
  MasterDataRepository,
  toMasterDataRecord,
} from './master-data.repository';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const codePattern = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;
const organizationRoles = new Set([
  'AGENCY',
  'CORPORATE_CUSTOMER',
  'SUPPLIER',
  'AIRLINE',
  'HOTEL_PROVIDER',
  'INSURANCE_PROVIDER',
  'BUS_PROVIDER',
  'RAIL_OPERATOR',
  'TOUR_OPERATOR',
  'BROKER',
]);

const autoCodeAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const compactCodeRules: Partial<
  Record<MasterDataResource, { alphabet: string; length: number }>
> = {
  currencies: { alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', length: 3 },
};
const resourceCodePrefixes: Record<MasterDataResource, string> = {
  countries: 'CNT',
  regions: 'REGION',
  cities: 'CITY',
  airports: 'AIRPORT',
  terminals: 'TERMINAL',
  currencies: 'CUR',
  'exchange-rates': 'RATE',
  banks: 'BANK',
  'bank-branches': 'BANK_BRANCH',
  'payment-methods': 'PAYMENT_METHOD',
  insurers: 'INS',
  'insurance-plans': 'INS_PLAN',
  'insurance-coverages': 'INS_COVERAGE',
  airlines: 'AIR',
  'aircraft-types': 'AIRCRAFT',
  'cabin-classes': 'CABIN',
  'baggage-rules': 'BAGGAGE',
  'manifest-templates': 'MANIFEST',
  'rail-companies': 'RAIL',
  'train-types': 'TRAIN',
  'bus-companies': 'BUS',
  'bus-types': 'BUS_TYPE',
  hotels: 'HOTEL',
  'hotel-chains': 'HOTEL_CHAIN',
  'room-types': 'ROOM_TYPE',
  'meal-services': 'MEAL_SERVICE',
  facilities: 'FACILITY',
  'composite-hotels': 'COMPOSITE_HOTEL',
  organizations: 'ORG',
  suppliers: 'SUPPLIER',
  brokers: 'BROKER',
  'travel-services': 'SERVICE',
  'organization-contacts': 'CONTACT',
  leaders: 'LEADER',
  'tour-types': 'TOUR',
  'transfer-types': 'TRANSFER',
  'cip-services': 'CIP',
  'visa-services': 'VISA',
  'acquaintance-methods': 'ACQ',
  'lead-sources': 'LEAD_SOURCE',
  'sales-channels': 'SALES_CHANNEL',
  'lost-reasons': 'LOST_REASON',
  'customer-types': 'CUSTOMER_TYPE',
  tags: 'TAG',
  'campaign-types': 'CAMPAIGN_TYPE',
};

function autoCodeSource(
  values: Record<string, string | number | readonly string[] | null>,
): string {
  for (const field of ['displayName', 'name', 'legalName', 'englishName']) {
    const value = values[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  for (const field of ['fullName', 'organizationId']) {
    const value = values[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  throw new BadRequestException('نام رکورد برای تولید کد داخلی الزامی است.');
}

function hashToken(seed: string, alphabet: string, length: number): string {
  const digest = createHash('sha256').update(seed, 'utf8').digest();
  return Array.from(
    { length },
    (_, index) => alphabet[(digest[index] ?? 0) % alphabet.length],
  ).join('');
}

const regionTypes = new Set(['PROVINCE', 'STATE', 'REGION', 'TERRITORY']);
const terminalTypes = new Set(['DOMESTIC', 'INTERNATIONAL', 'VIP']);
const currencyDisplayPolicies = new Set([
  'SYMBOL_BEFORE',
  'SYMBOL_AFTER',
  'CODE_BEFORE',
  'CODE_AFTER',
]);
const paymentChannels = new Set([
  'CASH',
  'POS',
  'BANK_TRANSFER',
  'ONLINE_GATEWAY',
  'CREDIT',
  'WALLET',
  'OTHER',
]);
const paymentDirections = new Set(['RECEIPT', 'PAYMENT', 'BOTH']);
const collaborationStatuses = new Set([
  'ACTIVE',
  'UNDER_REVIEW',
  'PURCHASE_SUSPENDED',
  'ENDED',
]);
const contactChannels = new Set([
  'PHONE',
  'WHATSAPP',
  'EMAIL',
  'TELEGRAM',
  'OTHER',
]);
const mealServiceCategories = new Set(['MEAL_PLAN', 'SERVICE']);
const aircraftBodyTypes = new Set([
  'NARROW_BODY',
  'WIDE_BODY',
  'TURBOPROP',
  'REGIONAL',
  'OTHER',
]);
const cabinTypes = new Set(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST']);
const passengerTypes = new Set(['ADT', 'CHD', 'INF']);
const baggageUnits = new Set(['KG', 'PC']);
const transportRouteScopes = new Set(['ALL', 'DOMESTIC', 'INTERNATIONAL']);
const manifestFileFormats = new Set(['XLSX', 'CSV', 'XML', 'JSON']);
const manifestStatuses = new Set(['DRAFT', 'ACTIVE', 'EXPIRED']);
const trainCategories = new Set([
  'SLEEPER',
  'EXPRESS',
  'SALOON',
  'LUXURY',
  'OTHER',
]);
const busServiceClasses = new Set(['STANDARD', 'VIP', 'LUXURY', 'OTHER']);
const tourScopes = new Set(['DOMESTIC', 'INTERNATIONAL', 'BOTH']);
const transferServiceModes = new Set(['PRIVATE', 'SHARED']);
const cipPassengerScopes = new Set(['ADT', 'CHD', 'INF', 'ALL']);

function isValidIso2(value: string): boolean {
  if (!/^[A-Z]{2}$/.test(value)) return false;
  const label = new Intl.DisplayNames(['en'], { type: 'region' }).of(value);
  return Boolean(label && label !== value && label !== 'Unknown Region');
}

function isValidIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function referenceIds(value: unknown, label: string): string[] {
  const ids = (
    Array.isArray(value) ? value.map(String) : String(value ?? '').split(',')
  )
    .map((item) => item.trim())
    .filter(Boolean);
  const unique = [...new Set(ids)];
  if (
    unique.length > 100 ||
    unique.length !== ids.length ||
    unique.some((id) => !uuidPattern.test(id))
  )
    throw new BadRequestException(
      `${label} باید فهرست UUID یکتا و معتبر باشد.`,
    );
  return unique;
}

function normalizedWebsite(value: unknown): string | null {
  const website = String(value ?? '').trim();
  if (!website) return null;
  if (
    website.length > 320 ||
    !/^(https?:\/\/)?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}(?:[/:?#].*)?$/i.test(
      website,
    )
  )
    throw new BadRequestException('نشانی وب‌سایت معتبر نیست.');
  return website;
}

const allowedFields: Record<MasterDataResource, readonly string[]> = {
  countries: ['iso2Code', 'name', 'englishName'],
  regions: [
    'code',
    'name',
    'englishName',
    'countryId',
    'parentRegionId',
    'type',
  ],
  cities: ['code', 'name', 'englishName', 'countryId', 'regionId'],
  airports: [
    'name',
    'englishName',
    'countryId',
    'cityId',
    'iataCode',
    'icaoCode',
    'ianaTimezone',
    'latitude',
    'longitude',
  ],
  terminals: ['code', 'name', 'englishName', 'airportId', 'terminalType'],
  currencies: [
    'code',
    'name',
    'englishName',
    'symbol',
    'decimalDigits',
    'displayPolicy',
  ],
  'exchange-rates': [
    'fromCurrencyCode',
    'toCurrencyCode',
    'rate',
    'rateType',
    'source',
    'observedAt',
    'validFrom',
    'validTo',
    'correctionReason',
  ],
  banks: ['code', 'name', 'englishName', 'countryId', 'swiftCode'],
  'bank-branches': [
    'code',
    'name',
    'englishName',
    'bankId',
    'cityId',
    'address',
    'phone',
  ],
  'payment-methods': [
    'code',
    'name',
    'englishName',
    'description',
    'channel',
    'direction',
    'requiresManualApproval',
    'displayOrder',
  ],
  insurers: [
    'code',
    'name',
    'englishName',
    'organizationId',
    'countryId',
    'logoFileReference',
  ],
  'insurance-plans': [
    'code',
    'name',
    'englishName',
    'insurerId',
    'destinationRegion',
    'supplierId',
    'tourScope',
    'transferServiceMode',
    'passengerScope',
    'busServiceClass',
    'minimumAge',
    'maximumAge',
    'validFrom',
    'validTo',
    'description',
    'coverageIds',
  ],
  'insurance-coverages': [
    'code',
    'name',
    'englishName',
    'currencyId',
    'coverageLimit',
    'deductibleAmount',
    'description',
  ],
  airlines: [
    'code',
    'name',
    'englishName',
    'icaoCode',
    'organizationId',
    'countryId',
    'logoFileReference',
  ],
  'aircraft-types': [
    'name',
    'englishName',
    'manufacturer',
    'model',
    'bodyType',
  ],
  'cabin-classes': [
    'name',
    'englishName',
    'bookingCode',
    'cabinType',
    'displayOrder',
  ],
  'baggage-rules': [
    'name',
    'airlineId',
    'cabinClassId',
    'passengerType',
    'routeScope',
    'allowance',
    'unit',
    'pieceCount',
    'validFrom',
    'validTo',
    'description',
  ],
  'manifest-templates': [
    'name',
    'airlineId',
    'versionNumber',
    'fileFormat',
    'fileReferenceId',
    'sheetName',
    'headerRow',
    'dateFormat',
    'requiredColumns',
    'columnOrder',
    'validFrom',
    'validTo',
    'publicationStatus',
  ],
  'rail-companies': [
    'name',
    'englishName',
    'organizationId',
    'countryId',
    'logoFileReference',
  ],
  'train-types': [
    'name',
    'englishName',
    'manufacturer',
    'model',
    'category',
    'amenities',
  ],
  'bus-companies': [
    'name',
    'englishName',
    'organizationId',
    'supplierId',
    'countryId',
    'logoFileReference',
  ],
  'bus-types': [
    'name',
    'englishName',
    'manufacturer',
    'model',
    'serviceClass',
    'amenities',
    'facilityIds',
  ],
  hotels: [
    'name',
    'englishName',
    'cityId',
    'chainId',
    'starRating',
    'address',
    'description',
    'hotelRules',
    'website',
    'checkInTime',
    'checkOutTime',
    'latitude',
    'longitude',
    'isSaleableReference',
    'mealServiceIds',
    'roomTypeIds',
    'facilityIds',
  ],
  'hotel-chains': ['name', 'englishName', 'countryId', 'website'],
  'room-types': [
    'name',
    'englishName',
    'referenceCapacity',
    'usageDescription',
  ],
  'meal-services': ['name', 'englishName', 'category', 'includedMeals'],
  facilities: ['name', 'englishName', 'category', 'displayOrder'],
  'composite-hotels': [
    'name',
    'englishName',
    'cityId',
    'usageCondition',
    'isSaleableReference',
    'memberHotelIds',
    'backupMemberIds',
  ],
  organizations: ['code', 'legalName', 'displayName', 'roleCodes', 'personType'],
  suppliers: [
    'englishName',
    'primaryContactId',
    'organizationId',
    'countryId',
    'cityId',
    'externalProviderReference',
    'collaborationStatus',
    'serviceCodes',
  ],
  brokers: [
    'englishName',
    'primaryContactId',
    'code',
    'name',
    'organizationId',
    'countryId',
    'cityId',
    'collaborationStatus',
    'serviceCodes',
  ],
  'travel-services': ['code', 'name', 'englishName'],
  'organization-contacts': [
    'organizationId',
    'fullName',
    'jobTitle',
    'preferredChannel',
    'phone',
    'email',
    'hasWhatsapp',
    'isPrimary',
  ],
  leaders: [
    'code',
    'name',
    'englishName',
    'cityId',
    'languages',
    'expertise',
    'destinations',
    'primaryPhone',
    'roamingPhone',
    'welcomeSignCode',
    'operationalNotes',
  ],
  'tour-types': [
    'code',
    'name',
    'englishName',
    'scope',
    'description',
    'displayOrder',
  ],
  'transfer-types': [
    'code',
    'name',
    'englishName',
    'vehicleType',
    'serviceMode',
    'suggestedCapacity',
    'description',
    'displayOrder',
  ],
  'cip-services': [
    'code',
    'name',
    'englishName',
    'airportId',
    'supplierId',
    'passengerScope',
    'includedItems',
    'description',
    'displayOrder',
  ],
  'visa-services': [
    'code',
    'name',
    'englishName',
    'countryId',
    'supplierId',
    'visaType',
    'referenceValidityDays',
    'guidanceFileReference',
    'description',
    'displayOrder',
  ],
  'acquaintance-methods': [
    'name',
    'englishName',
    'description',
    'displayOrder',
  ],
  'lead-sources': ['name', 'englishName', 'description', 'displayOrder'],
  'sales-channels': ['name', 'englishName', 'description', 'displayOrder'],
  'lost-reasons': ['name', 'englishName', 'description', 'displayOrder'],
  'customer-types': ['name', 'englishName', 'description', 'displayOrder'],
  tags: ['name', 'englishName', 'description', 'colorHex', 'displayOrder'],
  'campaign-types': ['name', 'englishName', 'description', 'displayOrder'],
};

const requiredFields: Record<MasterDataResource, readonly string[]> = {
  countries: ['iso2Code', 'name', 'englishName'],
  regions: ['name', 'englishName', 'countryId', 'type'],
  cities: ['name', 'englishName', 'countryId'],
  airports: [
    'name',
    'englishName',
    'countryId',
    'cityId',
    'iataCode',
    'icaoCode',
    'ianaTimezone',
    'latitude',
    'longitude',
  ],
  terminals: ['name', 'airportId', 'terminalType'],
  currencies: ['code', 'name', 'englishName'],
  'exchange-rates': [
    'fromCurrencyCode',
    'toCurrencyCode',
    'rate',
    'source',
    'observedAt',
  ],
  banks: ['code', 'name', 'englishName', 'countryId'],
  'bank-branches': ['code', 'name', 'bankId', 'cityId'],
  'payment-methods': ['name', 'channel', 'direction'],
  insurers: ['name', 'englishName', 'organizationId', 'countryId'],
  'insurance-plans': [
    'name',
    'insurerId',
    'destinationRegion',
    'minimumAge',
    'validFrom',
    'coverageIds',
  ],
  'insurance-coverages': ['name', 'currencyId', 'coverageLimit'],
  airlines: ['code', 'name', 'organizationId'],
  'aircraft-types': ['name', 'manufacturer', 'model', 'bodyType'],
  'cabin-classes': ['name', 'bookingCode', 'cabinType'],
  'baggage-rules': [
    'name',
    'airlineId',
    'passengerType',
    'allowance',
    'unit',
    'validFrom',
  ],
  'manifest-templates': [
    'name',
    'airlineId',
    'versionNumber',
    'fileFormat',
    'validFrom',
    'publicationStatus',
  ],
  'rail-companies': ['name', 'organizationId', 'countryId'],
  'train-types': ['name', 'manufacturer', 'model', 'category'],
  'bus-companies': ['name', 'countryId'],
  'bus-types': ['name', 'manufacturer', 'model', 'serviceClass'],
  hotels: ['name', 'cityId'],
  'hotel-chains': ['name', 'countryId'],
  'room-types': ['name'],
  'meal-services': ['name', 'category'],
  facilities: ['name'],
  'composite-hotels': ['name', 'cityId', 'usageCondition', 'memberHotelIds'],
  organizations: ['legalName', 'displayName', 'roleCodes'],
  suppliers: ['organizationId'],
  brokers: ['name', 'organizationId'],
  'travel-services': ['code', 'name'],
  'organization-contacts': ['organizationId', 'fullName', 'preferredChannel'],
  leaders: ['name', 'cityId', 'languages', 'destinations'],
  'tour-types': ['name', 'scope'],
  'transfer-types': ['name', 'vehicleType', 'serviceMode'],
  'cip-services': ['name', 'airportId', 'passengerScope', 'includedItems'],
  'visa-services': ['name', 'countryId', 'visaType'],
  'acquaintance-methods': ['name'],
  'lead-sources': ['name'],
  'sales-channels': ['name'],
  'lost-reasons': ['name'],
  'customer-types': ['name'],
  tags: ['name'],
  'campaign-types': ['name'],
};

function resourceOf(value: string): MasterDataResource {
  if (!(MASTER_DATA_RESOURCES as readonly string[]).includes(value))
    throw new NotFoundException('منبع اطلاعات پایه معتبر نیست.');
  return value as MasterDataResource;
}

function branchOf(actor: AuthenticatedActor, requested?: string): string {
  const branchId = requested ?? actor.branchIds[0];
  if (!branchId || !actor.branchIds.includes(branchId))
    throw new ForbiddenException('شعبه مجاز برای این عملیات مشخص نشده است.');
  return branchId;
}

type ExportInput = {
  resource: string;
  format: 'xlsx' | 'pdf';
  filters: Record<string, unknown>;
  columns: string[];
  locale: 'fa-IR';
  timezone: string;
};

const MAX_DIRECT_EXPORT_ROWS = 10_000;

function validateExportInput(input: ExportInput): MasterDataResource {
  const resource = resourceOf(input.resource);
  const allowedFilterKeys = [
    'search',
    'status',
    'sortBy',
    'sortDirection',
    'countryId',
    'regionId',
    'cityId',
    'airportId',
    'bankId',
    'chainId',
    'terminalType',
    'paymentChannel',
    'paymentDirection',
    'organizationId',
    'serviceId',
    'insurerId',
    'currencyId',
    'supplierId',
    'collaborationStatus',
    'providerConnected',
    'hasWhatsapp',
    'contactCompleteness',
    'starRating',
    'referenceCapacity',
    'mealServiceCategory',
    'facilityCategory',
    'saleableOnly',
    'insurerId',
    'currencyId',
    'destinationRegion',
  ];
  if (
    Object.keys(input.filters).some((key) => !allowedFilterKeys.includes(key))
  )
    throw new BadRequestException('فیلتر خروجی خارج از allowlist است.');
  if (
    input.filters.search !== undefined &&
    (typeof input.filters.search !== 'string' ||
      input.filters.search.length > 100)
  )
    throw new BadRequestException('جست‌وجوی خروجی معتبر نیست.');
  if (
    input.filters.status !== undefined &&
    !['all', 'active', 'inactive'].includes(String(input.filters.status))
  )
    throw new BadRequestException('وضعیت فیلتر خروجی معتبر نیست.');
  if (
    input.filters.sortBy !== undefined &&
    !['name', 'code', 'updatedAt'].includes(String(input.filters.sortBy))
  )
    throw new BadRequestException('مرتب‌سازی خروجی معتبر نیست.');
  for (const field of [
    'countryId',
    'regionId',
    'cityId',
    'airportId',
    'bankId',
    'chainId',
    'organizationId',
    'serviceId',
  ]) {
    const value = input.filters[field];
    if (
      value !== undefined &&
      (typeof value !== 'string' || !uuidPattern.test(value))
    )
      throw new BadRequestException(`${field} خروجی باید UUID معتبر باشد.`);
  }
  if (
    input.filters.sortDirection !== undefined &&
    !['asc', 'desc'].includes(String(input.filters.sortDirection))
  )
    throw new BadRequestException('جهت مرتب‌سازی خروجی معتبر نیست.');
  if (
    input.filters.terminalType !== undefined &&
    !['DOMESTIC', 'INTERNATIONAL', 'VIP'].includes(
      String(input.filters.terminalType),
    )
  )
    throw new BadRequestException('نوع ترمینال خروجی معتبر نیست.');
  if (
    input.filters.paymentChannel !== undefined &&
    !paymentChannels.has(String(input.filters.paymentChannel))
  )
    throw new BadRequestException('کانال روش پرداخت معتبر نیست.');
  if (
    input.filters.paymentDirection !== undefined &&
    !paymentDirections.has(String(input.filters.paymentDirection))
  )
    throw new BadRequestException('جهت روش پرداخت معتبر نیست.');
  if (
    input.filters.mealServiceCategory !== undefined &&
    !mealServiceCategories.has(String(input.filters.mealServiceCategory))
  )
    throw new BadRequestException('دسته Meal/Service خروجی معتبر نیست.');
  if (
    input.filters.tourScope !== undefined &&
    !tourScopes.has(String(input.filters.tourScope))
  )
    throw new BadRequestException('دامنه نوع تور خروجی معتبر نیست.');
  if (
    input.filters.transferServiceMode !== undefined &&
    !transferServiceModes.has(String(input.filters.transferServiceMode))
  )
    throw new BadRequestException('شیوه ترانسفر خروجی معتبر نیست.');
  if (
    input.filters.passengerScope !== undefined &&
    !cipPassengerScopes.has(String(input.filters.passengerScope))
  )
    throw new BadRequestException('دامنه مسافر خروجی معتبر نیست.');
  if (
    input.filters.busServiceClass !== undefined &&
    !busServiceClasses.has(String(input.filters.busServiceClass))
  )
    throw new BadRequestException('رده اتوبوس خروجی معتبر نیست.');
  if (
    input.filters.starRating !== undefined &&
    (!Number.isInteger(Number(input.filters.starRating)) ||
      Number(input.filters.starRating) < 1 ||
      Number(input.filters.starRating) > 5)
  )
    throw new BadRequestException('درجه هتل خروجی معتبر نیست.');
  if (
    input.filters.referenceCapacity !== undefined &&
    (!Number.isInteger(Number(input.filters.referenceCapacity)) ||
      Number(input.filters.referenceCapacity) < 1 ||
      Number(input.filters.referenceCapacity) > 20)
  )
    throw new BadRequestException('ظرفیت استاندارد خروجی معتبر نیست.');
  const allowedColumns = new Set([
    ...allowedFields[resource],
    'code',
    'name',
    'status',
    'updatedAt',
  ]);
  if (input.columns.some((column) => !allowedColumns.has(column)))
    throw new BadRequestException('ستون خروجی خارج از allowlist است.');
  if (
    input.columns.length < 1 ||
    input.columns.length > 30 ||
    new Set(input.columns).size !== input.columns.length
  )
    throw new BadRequestException('بین ۱ تا ۳۰ ستون یکتای خروجی لازم است.');
  try {
    new Intl.DateTimeFormat(input.locale, {
      timeZone: input.timezone,
    }).format();
  } catch {
    throw new BadRequestException('منطقه زمانی خروجی معتبر نیست.');
  }
  return resource;
}

function exportQuery(input: ExportInput): MasterDataListQuery {
  return {
    search:
      typeof input.filters.search === 'string' ? input.filters.search : '',
    status: (input.filters.status ?? 'all') as MasterDataListQuery['status'],
    sortBy: (input.filters.sortBy ?? 'name') as MasterDataListQuery['sortBy'],
    sortDirection: (input.filters.sortDirection ??
      'asc') as MasterDataListQuery['sortDirection'],
    ...(typeof input.filters.countryId === 'string'
      ? { countryId: input.filters.countryId }
      : {}),
    ...(typeof input.filters.regionId === 'string'
      ? { regionId: input.filters.regionId }
      : {}),
    ...(typeof input.filters.cityId === 'string'
      ? { cityId: input.filters.cityId }
      : {}),
    ...(typeof input.filters.airportId === 'string'
      ? { airportId: input.filters.airportId }
      : {}),
    ...(typeof input.filters.bankId === 'string'
      ? { bankId: input.filters.bankId }
      : {}),
    ...(typeof input.filters.terminalType === 'string'
      ? {
          terminalType: input.filters.terminalType as Exclude<
            MasterDataListQuery['terminalType'],
            undefined
          >,
        }
      : {}),
    ...(typeof input.filters.paymentChannel === 'string'
      ? {
          paymentChannel: input.filters.paymentChannel as Exclude<
            MasterDataListQuery['paymentChannel'],
            undefined
          >,
        }
      : {}),
    ...(typeof input.filters.paymentDirection === 'string'
      ? {
          paymentDirection: input.filters.paymentDirection as Exclude<
            MasterDataListQuery['paymentDirection'],
            undefined
          >,
        }
      : {}),
    ...(typeof input.filters.organizationId === 'string'
      ? { organizationId: input.filters.organizationId }
      : {}),
    ...(typeof input.filters.serviceId === 'string'
      ? { serviceId: input.filters.serviceId }
      : {}),
    ...(typeof input.filters.collaborationStatus === 'string'
      ? {
          collaborationStatus: input.filters.collaborationStatus as Exclude<
            MasterDataListQuery['collaborationStatus'],
            undefined
          >,
        }
      : {}),
    ...(typeof input.filters.providerConnected === 'boolean'
      ? { providerConnected: input.filters.providerConnected }
      : {}),
    ...(typeof input.filters.hasWhatsapp === 'boolean'
      ? { hasWhatsapp: input.filters.hasWhatsapp }
      : {}),
    ...(typeof input.filters.contactCompleteness === 'string'
      ? {
          contactCompleteness: input.filters.contactCompleteness as Exclude<
            MasterDataListQuery['contactCompleteness'],
            undefined
          >,
        }
      : {}),
    ...(typeof input.filters.chainId === 'string'
      ? { chainId: input.filters.chainId }
      : {}),
    ...(typeof input.filters.starRating === 'number'
      ? { starRating: input.filters.starRating }
      : {}),
    ...(typeof input.filters.referenceCapacity === 'number'
      ? { referenceCapacity: input.filters.referenceCapacity }
      : {}),
    ...(typeof input.filters.mealServiceCategory === 'string'
      ? {
          mealServiceCategory: input.filters.mealServiceCategory as Exclude<
            MasterDataListQuery['mealServiceCategory'],
            undefined
          >,
        }
      : {}),
    ...(typeof input.filters.facilityCategory === 'string'
      ? { facilityCategory: input.filters.facilityCategory }
      : {}),
    ...(typeof input.filters.saleableOnly === 'boolean'
      ? { saleableOnly: input.filters.saleableOnly }
      : {}),
    ...(typeof input.filters.insurerId === 'string'
      ? { insurerId: input.filters.insurerId }
      : {}),
    ...(typeof input.filters.currencyId === 'string'
      ? { currencyId: input.filters.currencyId }
      : {}),
    ...(typeof input.filters.destinationRegion === 'string'
      ? { destinationRegion: input.filters.destinationRegion }
      : {}),
    ...(typeof input.filters.supplierId === 'string'
      ? { supplierId: input.filters.supplierId }
      : {}),
    ...(typeof input.filters.tourScope === 'string'
      ? {
          tourScope: input.filters.tourScope as Exclude<
            MasterDataListQuery['tourScope'],
            undefined
          >,
        }
      : {}),
    ...(typeof input.filters.transferServiceMode === 'string'
      ? {
          transferServiceMode: input.filters.transferServiceMode as Exclude<
            MasterDataListQuery['transferServiceMode'],
            undefined
          >,
        }
      : {}),
    ...(typeof input.filters.passengerScope === 'string'
      ? {
          passengerScope: input.filters.passengerScope as Exclude<
            MasterDataListQuery['passengerScope'],
            undefined
          >,
        }
      : {}),
    ...(typeof input.filters.busServiceClass === 'string'
      ? {
          busServiceClass: input.filters.busServiceClass as Exclude<
            MasterDataListQuery['busServiceClass'],
            undefined
          >,
        }
      : {}),
    page: 1,
    pageSize: 100,
  };
}

@Injectable()
export class MasterDataService {
  constructor(
    @Inject(MasterDataRepository)
    private readonly repository: MasterDataRepository,
    @Inject(MasterDataContactCrypto)
    private readonly contactCrypto: MasterDataContactCrypto = undefined as never,
  ) {}

  resource(value: string) {
    return resourceOf(value);
  }

  async list(resourceValue: string, query: MasterDataListQuery) {
    const resource = resourceOf(resourceValue);
    const { rows, total } = await this.repository.list(resource, query);
    return {
      data: rows.map((row) => toMasterDataRecord(resource, row)),
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async detail(resourceValue: string, id: string) {
    const resource = resourceOf(resourceValue);
    const row = await this.repository.find(resource, id);
    if (!row) throw new NotFoundException('رکورد اطلاعات پایه یافت نشد.');
    return { data: toMasterDataRecord(resource, row) };
  }

  async unmaskOrganizationContact(
    id: string,
    actor: AuthenticatedActor,
    requestedBranch?: string,
  ) {
    const row = await this.repository.find('organization-contacts', id);
    if (!row || !row.isActive)
      throw new NotFoundException('مخاطب فعال یافت نشد.');
    const phone = this.contactCrypto.decrypt('phone', {
      encrypted:
        typeof row.phoneEncrypted === 'string' ? row.phoneEncrypted : null,
      encryptionIv:
        typeof row.phoneEncryptionIv === 'string'
          ? row.phoneEncryptionIv
          : null,
      encryptionAuthTag:
        typeof row.phoneEncryptionAuthTag === 'string'
          ? row.phoneEncryptionAuthTag
          : null,
      encryptionKeyVersion:
        typeof row.phoneEncryptionKeyVersion === 'number'
          ? row.phoneEncryptionKeyVersion
          : null,
    });
    const email = this.contactCrypto.decrypt('email', {
      encrypted:
        typeof row.emailEncrypted === 'string' ? row.emailEncrypted : null,
      encryptionIv:
        typeof row.emailEncryptionIv === 'string'
          ? row.emailEncryptionIv
          : null,
      encryptionAuthTag:
        typeof row.emailEncryptionAuthTag === 'string'
          ? row.emailEncryptionAuthTag
          : null,
      encryptionKeyVersion:
        typeof row.emailEncryptionKeyVersion === 'number'
          ? row.emailEncryptionKeyVersion
          : null,
    });
    await this.repository.recordSensitiveContactRead({
      contactId: id,
      actorUserId: actor.userId,
      actorBranchId: branchOf(actor, requestedBranch),
    });
    return { data: { id, phone, email } };
  }

  async organizationSupplierSummary() {
    return { data: await this.repository.organizationSupplierSummary() };
  }

  async accommodationSummary() {
    return { data: await this.repository.accommodationSummary() };
  }

  async insuranceSummary() {
    return { data: await this.repository.insuranceSummary() };
  }

  async travelServicesSummary() {
    return { data: await this.repository.travelServicesSummary() };
  }

  async create(
    resourceValue: string,
    values: Record<string, string | number | readonly string[] | null>,
    actor: AuthenticatedActor,
    requestedBranch?: string,
  ) {
    const resource = resourceOf(resourceValue);
    if (
      resource === 'exchange-rates' &&
      !actor.permissions.includes('master_data.currency_rate.create')
    )
      throw new ForbiddenException('مجوز ثبت نرخ ارز وجود ندارد.');
    const data = await this.prepare(resource, values, actor.userId, false);
    const row = await this.repository.create(
      resource,
      data,
      actor.userId,
      branchOf(actor, requestedBranch),
    );
    return { data: toMasterDataRecord(resource, row) };
  }

  async update(
    resourceValue: string,
    id: string,
    values: Record<string, string | number | readonly string[] | null>,
    version: number | undefined,
    actor: AuthenticatedActor,
    requestedBranch?: string,
  ) {
    const resource = resourceOf(resourceValue);
    assertGenericCurrencyRateMutationAllowed(resource);
    if (!version)
      throw new BadRequestException('version برای ویرایش الزامی است.');
    if (resource === 'exchange-rates') {
      if (!actor.permissions.includes('master_data.currency_rate.create'))
        throw new ForbiddenException('مجوز ثبت نرخ ارز وجود ندارد.');
      const existing = await this.repository.find(resource, id);
      if (String(existing?.status) !== 'DRAFT')
        throw new ConflictException({
          code: 'CURRENCY_RATE_IMMUTABLE',
          message: 'نرخ تأیید یا ردشده قابل ویرایش نیست؛ نسخه جدید ثبت کنید.',
        });
    }
    const data = await this.prepare(resource, values, actor.userId, true, id);
    const row = await this.repository.update(
      resource,
      id,
      data,
      version,
      actor.userId,
      branchOf(actor, requestedBranch),
    );
    if (!row)
      throw new ConflictException({
        code: 'CONCURRENT_MODIFICATION',
        message: 'رکورد هم‌زمان تغییر کرده است.',
      });
    return { data: toMasterDataRecord(resource, row) };
  }

  async remove(
    resourceValue: string,
    id: string,
    version: number,
    actor: AuthenticatedActor,
    requestedBranch?: string,
  ): Promise<MasterDataDeleteResponse> {
    if (!actor.permissions.includes('master_data.delete'))
      throw new ForbiddenException('مجوز حذف اطلاعات پایه وجود ندارد.');
    const resource = resourceOf(resourceValue);
    if (!uuidPattern.test(id))
      throw new BadRequestException('شناسه رکورد معتبر نیست.');
    if (!Number.isSafeInteger(version) || version < 1 || version > 2147483646)
      throw new BadRequestException('نسخه معتبر رکورد برای حذف الزامی است.');
    const actorBranchId = branchOf(actor, requestedBranch);
    try {
      await this.repository.remove(
        resource,
        id,
        version,
        actor.userId,
        actorBranchId,
      );
    } catch (error) {
      if (isMasterDataDependencyError(error))
        throw new ConflictException({
          code: 'MASTER_DATA_IN_USE',
          message:
            'این رکورد در اطلاعات دیگری استفاده شده و حذف نمی‌شود؛ می‌توانید آن را غیرفعال کنید.',
        });
      throw error;
    }
    return { data: { id, resource, deleted: true } };
  }

  async status(
    resourceValue: string,
    id: string,
    status: 'active' | 'inactive',
    version: number,
    actor: AuthenticatedActor,
    requestedBranch?: string,
  ) {
    const resource = resourceOf(resourceValue);
    assertGenericCurrencyRateMutationAllowed(resource);
    const row = await this.repository.setStatus(
      resource,
      id,
      status === 'active',
      version,
      actor.userId,
      branchOf(actor, requestedBranch),
    );
    if (!row)
      throw new ConflictException({
        code: 'CONCURRENT_MODIFICATION',
        message: 'رکورد یافت نشد یا هم‌زمان تغییر کرده است.',
      });
    return { data: toMasterDataRecord(resource, row) };
  }

  async requestExport(
    input: {
      resource: string;
      format: 'xlsx' | 'pdf';
      filters: Record<string, unknown>;
      columns: string[];
      locale: 'fa-IR';
      timezone: string;
    },
    actor: AuthenticatedActor,
    requestedBranch?: string,
  ) {
    const resource = validateExportInput(input);
    const request = await this.repository.createExport({
      resource,
      format: input.format.toUpperCase() as 'XLSX' | 'PDF',
      filterSnapshot: input.filters,
      columns: input.columns,
      permissionSnapshot: actor.permissions.filter((code) =>
        code.startsWith('master_data.'),
      ),
      actorUserId: actor.userId,
      actorBranchId: branchOf(actor, requestedBranch),
      locale: input.locale,
      timezone: input.timezone,
    });
    return {
      data: {
        id: request.id,
        status: request.status,
        artifactId: request.artifactId,
        createdAt: request.createdAt.toISOString(),
      },
    };
  }

  async downloadXlsx(
    input: ExportInput,
    actor: AuthenticatedActor,
    requestedBranch?: string,
  ) {
    if (input.format !== 'xlsx')
      throw new BadRequestException('این مسیر فقط خروجی Excel را می‌پذیرد.');
    const resource = validateExportInput(input);
    const actorBranchId = branchOf(actor, requestedBranch);
    const query = exportQuery(input);
    const firstPage = await this.repository.list(resource, query);
    if (firstPage.total > MAX_DIRECT_EXPORT_ROWS)
      throw new BadRequestException(
        `حداکثر ${MAX_DIRECT_EXPORT_ROWS.toLocaleString('fa-IR')} ردیف در هر خروجی Excel مجاز است؛ فیلتر را محدودتر کنید.`,
      );
    const rows = [...firstPage.rows];
    for (let page = 2; rows.length < firstPage.total; page += 1) {
      const nextPage = await this.repository.list(resource, { ...query, page });
      rows.push(...nextPage.rows);
    }
    const workbook = buildMasterDataXlsx({
      resource,
      columns: input.columns,
      records: rows.map((row) => toMasterDataRecord(resource, row)),
      locale: input.locale,
      timezone: input.timezone,
    });
    const request = await this.repository.createExport({
      resource,
      format: 'XLSX',
      filterSnapshot: input.filters,
      columns: input.columns,
      permissionSnapshot: actor.permissions.filter((code) =>
        code.startsWith('master_data.'),
      ),
      actorUserId: actor.userId,
      actorBranchId,
      locale: input.locale,
      timezone: input.timezone,
      status: 'COMPLETED',
    });
    const date = new Date().toISOString().slice(0, 10);
    return {
      buffer: Buffer.from(workbook),
      fileName: `master-data-${resource}-${date}.xlsx`,
      mimeType: MASTER_DATA_XLSX_MIME,
      requestId: request.id,
    };
  }

  async exportStatus(id: string, actor: AuthenticatedActor) {
    const request = await this.repository.findExport(id, actor.userId);
    if (!request) throw new NotFoundException('درخواست خروجی یافت نشد.');
    return {
      data: {
        id: request.id,
        status: request.status,
        artifactId: request.artifactId,
        createdAt: request.createdAt.toISOString(),
      },
    };
  }

  private async generateAutoCode(
    resource: Exclude<MasterDataResource, 'exchange-rates'>,
    values: Record<string, string | number | readonly string[] | null>,
  ): Promise<string> {
    const source = autoCodeSource(values).normalize('NFKC');
    const compactRule = compactCodeRules[resource];
    for (let attempt = 0; attempt < 2_048; attempt += 1) {
      const seed = `${resource}:${source}:${attempt}`;
      const candidate = compactRule
        ? hashToken(seed, compactRule.alphabet, compactRule.length)
        : `${resourceCodePrefixes[resource]}_${hashToken(
            seed,
            autoCodeAlphabet,
            12,
          )}`;
      if (!(await this.repository.codeExists(resource, candidate)))
        return candidate;
    }
    throw new ConflictException({
      code: 'MASTER_DATA_CODE_EXHAUSTED',
      message: 'تولید کد داخلی یکتا برای این رکورد ممکن نشد.',
    });
  }

  private async prepare(
    resource: MasterDataResource,
    values: Record<string, string | number | readonly string[] | null>,
    actorUserId: string,
    partial: boolean,
    entityId?: string,
  ): Promise<Record<string, unknown>> {
    const unknown = Object.keys(values).filter(
      (key) => !allowedFields[resource].includes(key),
    );
    if (unknown.length)
      throw new BadRequestException(`فیلد غیرمجاز: ${unknown.join(', ')}`);
    if (!partial) {
      const missing = requiredFields[resource].filter(
        (key) =>
          values[key] === undefined ||
          values[key] === null ||
          values[key] === '',
      );
      if (missing.length)
        throw new BadRequestException(`فیلد الزامی: ${missing.join(', ')}`);
    }
    const data: Record<string, unknown> = { ...values };
    if (resource === 'organizations' && Object.hasOwn(data, 'personType')) {
      const personType = String(data.personType ?? '').trim().toUpperCase();
      if (personType && !['NATURAL', 'LEGAL'].includes(personType))
        throw new BadRequestException('نوع شخصیت باید حقیقی یا حقوقی باشد.');
      data.personType = personType || null;
    }
    if (resource === 'suppliers' || resource === 'brokers') {
      if (Object.hasOwn(data, 'englishName')) {
        if (data.englishName !== null && typeof data.englishName !== 'string')
          throw new BadRequestException('نام انگلیسی باید متن باشد.');
        const englishName = String(data.englishName ?? '').trim();
        if (englishName.length > 160)
          throw new BadRequestException('نام انگلیسی حداکثر ۱۶۰ نویسه است.');
        data.englishName = englishName || null;
      }
      if (data.primaryContactId === '') data.primaryContactId = null;
    }
    if (
      [
        'hotels',
        'hotel-chains',
        'room-types',
        'meal-services',
        'facilities',
        'composite-hotels',
        'airlines',
        'aircraft-types',
        'cabin-classes',
        'baggage-rules',
        'manifest-templates',
        'rail-companies',
        'train-types',
        'bus-companies',
        'bus-types',
        'insurers',
        'insurance-plans',
        'insurance-coverages',
        'acquaintance-methods',
        'lead-sources',
        'sales-channels',
        'lost-reasons',
        'customer-types',
        'tags',
        'campaign-types',
      ].includes(resource)
    ) {
      for (const field of [
        'englishName',
        'address',
        'description',
        'hotelRules',
        'usageDescription',
        'category',
        'destinationRegion',
      ]) {
        if (!Object.hasOwn(data, field)) continue;
        const value = String(data[field] ?? '').trim();
        data[field] = value || null;
      }
      for (const field of [
        'organizationId',
        'supplierId',
        'mealServiceId',
        'defaultRoomTypeId',
        'chainId',
        'logoFileReference',
        'iconFileReference',
        'fileReferenceId',
        'cabinClassId',
        'countryId',
      ]) {
        if (data[field] === '') data[field] = null;
      }
    }
    if (
      resource === 'payment-methods' &&
      !partial &&
      !Object.hasOwn(values, 'code')
    ) {
      data.code = await this.generateAutoCode(resource, values);
    }
    if (resource === 'countries' && typeof data.iso2Code === 'string') {
      const iso2Code = data.iso2Code.trim().toUpperCase();
      if (!isValidIso2(iso2Code))
        throw new BadRequestException('کد ISO-2 کشور معتبر نیست.');
      if (
        await this.repository.fieldExists(
          'countries',
          'code',
          iso2Code,
          entityId,
        )
      )
        throw new ConflictException({
          code: 'MASTER_DATA_DUPLICATE_CODE',
          message: 'کد ISO-2 کشور قبلاً ثبت شده است.',
        });
      delete data.iso2Code;
      data.code = iso2Code;
    }
    const usesGeneratedCode =
      resource !== 'exchange-rates' &&
      resource !== 'countries' &&
      resource !== 'airports' &&
      resource !== 'currencies' &&
      resource !== 'banks' &&
      resource !== 'bank-branches' &&
      resource !== 'payment-methods' &&
      resource !== 'travel-services';
    // IATA is the public business identifier of an airline and is never generated.
    const generatesInternalCode = usesGeneratedCode && resource !== 'airlines';
    if (generatesInternalCode) {
      if (partial && Object.hasOwn(values, 'code'))
        throw new BadRequestException(
          'کد داخلی به‌صورت خودکار تولید می‌شود و قابل ویرایش نیست.',
        );
      if (!partial) data.code = await this.generateAutoCode(resource, values);
    }
    if (
      generatesInternalCode &&
      typeof data.code === 'string' &&
      !codePattern.test(data.code)
    )
      throw new BadRequestException('کد داخلی تولیدشده معتبر نیست.');
    if (
      [
        'currencies',
        'banks',
        'bank-branches',
        'payment-methods',
        'travel-services',
      ].includes(resource) &&
      data.code !== undefined
    ) {
      const code = String(data.code).trim().toUpperCase();
      const expectedPattern =
        resource === 'currencies' ? /^[A-Z]{3}$/ : codePattern;
      if (!expectedPattern.test(code))
        throw new BadRequestException(
          resource === 'currencies'
            ? 'کد ISO-4217 ارز باید سه حرف بزرگ باشد.'
            : 'کد باید با حروف بزرگ یا عدد و حداکثر ۳۲ نویسه باشد.',
        );
      if (
        resource !== 'bank-branches' &&
        (await this.repository.fieldExists(resource, 'code', code, entityId))
      )
        throw new ConflictException({
          code: 'MASTER_DATA_DUPLICATE_CODE',
          message: 'کد قبلاً ثبت شده است.',
        });
      data.code = code;
    }
    if (resource === 'airlines') {
      for (const [field, length, label] of [
        ['code', 2, 'IATA'],
        ['icaoCode', 3, 'ICAO'],
      ] as const) {
        if (data[field] === undefined || data[field] === null) continue;
        const code = String(data[field]).trim().toUpperCase();
        if (field === 'icaoCode' && !code) {
          data[field] = null;
          continue;
        }
        if (!new RegExp(`^[A-Z0-9]{${length}}$`).test(code))
          throw new BadRequestException(
            `کد ${label} باید ${length} حرف یا عدد بزرگ باشد.`,
          );
        if (
          await this.repository.fieldExists('airlines', field, code, entityId)
        )
          throw new ConflictException({
            code: 'MASTER_DATA_DUPLICATE_CODE',
            message: `کد ${label} قبلاً ثبت شده است.`,
          });
        data[field] = code;
      }
    }
    for (const optionalReference of ['regionId', 'parentRegionId']) {
      if (data[optionalReference] === '') data[optionalReference] = null;
    }
    if (data.chainId === '') data.chainId = null;
    if (resource === 'insurance-plans' && data.validTo === '')
      data.validTo = null;
    if (resource === 'insurance-plans' && data.maximumAge === '')
      data.maximumAge = null;
    if (resource === 'leaders' && data.cityId === '') data.cityId = null;
    if (
      (resource === 'cip-services' || resource === 'visa-services') &&
      data.supplierId === ''
    )
      data.supplierId = null;
    if (resource === 'bus-companies') {
      if (data.organizationId === '') data.organizationId = null;
      if (data.supplierId === '') data.supplierId = null;
      const existing =
        partial && entityId
          ? await this.repository.find('bus-companies', entityId)
          : null;
      const organizationId = Object.hasOwn(data, 'organizationId')
        ? data.organizationId
        : existing?.organizationId;
      const supplierId = Object.hasOwn(data, 'supplierId')
        ? data.supplierId
        : existing?.supplierId;
      if (
        (typeof organizationId === 'string') ===
        (typeof supplierId === 'string')
      )
        throw new BadRequestException(
          'شرکت اتوبوس باید دقیقاً به یک Organization یا Provider متصل باشد.',
        );
    }
    if (
      resource === 'visa-services' &&
      data.guidanceFileReference === ''
    )
      data.guidanceFileReference = null;
    if (resource === 'suppliers' || resource === 'brokers') {
      for (const optionalReference of ['countryId', 'cityId']) {
        if (data[optionalReference] === '') data[optionalReference] = null;
      }
    }

    for (const field of [
      'primaryContactId',
      'countryId',
      'organizationId',
      'cityId',
      'regionId',
      'parentRegionId',
      'airportId',
      'bankId',
      'chainId',
      'logoFileReference',
      'iconFileReference',
      'airlineId',
      'cabinClassId',
      'fileReferenceId',
      'insurerId',
      'currencyId',
      'supplierId',
      'guidanceFileReference',
    ]) {
      if (
        typeof data[field] === 'string' &&
        !uuidPattern.test(data[field] as string)
      )
        throw new BadRequestException(`${field} باید UUID معتبر باشد.`);
    }
    if (resource === 'regions' && data.type !== undefined) {
      const type = String(data.type).trim().toUpperCase();
      if (!regionTypes.has(type))
        throw new BadRequestException('نوع استان/ناحیه معتبر نیست.');
      data.type = type;
    }
    if (resource === 'terminals' && data.terminalType !== undefined) {
      const terminalType = String(data.terminalType).trim().toUpperCase();
      if (!terminalTypes.has(terminalType))
        throw new BadRequestException('نوع ترمینال معتبر نیست.');
      data.terminalType = terminalType;
    }
    if (resource === 'aircraft-types' && data.bodyType !== undefined) {
      const bodyType = String(data.bodyType).trim().toUpperCase();
      if (!aircraftBodyTypes.has(bodyType))
        throw new BadRequestException('نوع بدنه هواپیما معتبر نیست.');
      data.bodyType = bodyType;
    }
    if (resource === 'cabin-classes') {
      if (data.bookingCode !== undefined) {
        const bookingCode = String(data.bookingCode).trim().toUpperCase();
        if (!/^[A-Z0-9]{1,8}$/.test(bookingCode))
          throw new BadRequestException('کد رزرو کلاس پروازی معتبر نیست.');
        if (
          await this.repository.fieldExists(
            'cabin-classes',
            'bookingCode',
            bookingCode,
            entityId,
          )
        )
          throw new ConflictException({
            code: 'MASTER_DATA_DUPLICATE_CODE',
            message: 'کد رزرو کلاس پروازی قبلاً ثبت شده است.',
          });
        data.bookingCode = bookingCode;
      }
      if (data.cabinType !== undefined) {
        const cabinType = String(data.cabinType).trim().toUpperCase();
        if (!cabinTypes.has(cabinType))
          throw new BadRequestException('نوع Cabin معتبر نیست.');
        data.cabinType = cabinType;
      }
      if (data.displayOrder !== undefined) {
        const displayOrder = Number(data.displayOrder || 0);
        if (!Number.isInteger(displayOrder) || displayOrder < 0)
          throw new BadRequestException(
            'ترتیب نمایش باید عدد صحیح نامنفی باشد.',
          );
        data.displayOrder = displayOrder;
      }
    }
    if (resource === 'baggage-rules') {
      if (data.cabinClassId === '') data.cabinClassId = null;
      for (const [field, options, label] of [
        ['passengerType', passengerTypes, 'نوع مسافر'],
        ['routeScope', transportRouteScopes, 'دامنه مسیر'],
        ['unit', baggageUnits, 'واحد بار'],
      ] as const) {
        if (data[field] === undefined) continue;
        const value = String(data[field]).trim().toUpperCase();
        if (!options.has(value))
          throw new BadRequestException(`${label} معتبر نیست.`);
        data[field] = value;
      }
      if (data.allowance !== undefined) {
        const allowance = String(data.allowance).trim();
        if (!/^\d+(\.\d{1,2})?$/.test(allowance) || Number(allowance) <= 0)
          throw new BadRequestException('مقدار بار باید Decimal مثبت باشد.');
        data.allowance = allowance;
      }
      if (Object.hasOwn(data, 'pieceCount')) {
        const pieceCount = String(data.pieceCount ?? '').trim();
        if (!pieceCount) data.pieceCount = null;
        else if (
          !Number.isInteger(Number(pieceCount)) ||
          Number(pieceCount) < 1
        )
          throw new BadRequestException(
            'تعداد قطعه بار باید عدد صحیح مثبت باشد.',
          );
        else data.pieceCount = Number(pieceCount);
      }
    }
    if (resource === 'manifest-templates') {
      for (const [field, options, label] of [
        ['fileFormat', manifestFileFormats, 'فرمت فایل'],
        ['publicationStatus', manifestStatuses, 'وضعیت انتشار'],
      ] as const) {
        if (data[field] === undefined) continue;
        const value = String(data[field]).trim().toUpperCase();
        if (!options.has(value))
          throw new BadRequestException(`${label} معتبر نیست.`);
        data[field] = value;
      }
      for (const field of ['versionNumber', 'headerRow'] as const) {
        if (data[field] === undefined) continue;
        const value = Number(data[field]);
        if (!Number.isInteger(value) || value < 1)
          throw new BadRequestException(`${field} باید عدد صحیح مثبت باشد.`);
        data[field] = value;
      }
      for (const field of ['requiredColumns', 'columnOrder'] as const) {
        if (!Object.hasOwn(data, field)) continue;
        const values = (
          Array.isArray(data[field])
            ? data[field].map(String)
            : String(data[field] ?? '').split(',')
        )
          .map((value) => value.trim())
          .filter(Boolean);
        if (!values.length || values.length > 100)
          throw new BadRequestException(
            `${field} باید فهرست معتبر ستون‌ها باشد.`,
          );
        data[field] = [...new Set(values)];
      }
      if (data.fileReferenceId === '') data.fileReferenceId = null;
      if (
        data.publicationStatus === 'ACTIVE' &&
        typeof data.fileReferenceId !== 'string'
      )
        throw new BadRequestException(
          'انتشار قالب فعال فقط با Reference واقعی Documents مجاز است.',
        );
    }
    if (resource === 'train-types' && data.category !== undefined) {
      const category = String(data.category).trim().toUpperCase();
      if (!trainCategories.has(category))
        throw new BadRequestException('دسته قطار معتبر نیست.');
      data.category = category;
    }
    if (resource === 'bus-types' && data.serviceClass !== undefined) {
      const serviceClass = String(data.serviceClass).trim().toUpperCase();
      if (!busServiceClasses.has(serviceClass))
        throw new BadRequestException('کلاس خدمات اتوبوس معتبر نیست.');
      data.serviceClass = serviceClass;
    }
    if (resource === 'train-types' || resource === 'bus-types') {
      if (Object.hasOwn(data, 'amenities')) {
        const amenities = (
          Array.isArray(data.amenities)
            ? data.amenities.map(String)
            : String(data.amenities ?? '').split(',')
        )
          .map((value) => value.trim())
          .filter(Boolean);
        if (
          amenities.length > 40 ||
          amenities.some((value) => value.length > 80)
        )
          throw new BadRequestException('فهرست امکانات معتبر نیست.');
        data.amenities = [...new Set(amenities)];
      }
    }
    if (resource === 'bus-types' && Object.hasOwn(data, 'facilityIds')) {
      const facilityIds = referenceIds(data.facilityIds, 'امکانات اتوبوس');
      const facilities = await Promise.all(
        facilityIds.map((id) => this.repository.find('facilities', id)),
      );
      if (facilities.some((facility) => !facility?.isActive))
        throw new BadRequestException(
          'یک یا چند امکان فعال اتوبوس یافت نشد.',
        );
      delete data.facilityIds;
      data.facilities = partial
        ? {
            deleteMany: {},
            create: facilityIds.map((facilityId) => ({
              facilityId,
              assignedByUserId: actorUserId,
            })),
          }
        : {
            create: facilityIds.map((facilityId) => ({
              facilityId,
              assignedByUserId: actorUserId,
            })),
          };
    }
    if (resource === 'insurers') {
      if (data.countryId === null)
        throw new BadRequestException('کشور شرکت بیمه الزامی است.');
      if (data.englishName === null)
        throw new BadRequestException('نام انگلیسی شرکت بیمه الزامی است.');
    }
    if (resource === 'insurance-plans') {
      if (data.destinationRegion === null)
        throw new BadRequestException('مقصد یا منطقه طرح الزامی است.');
      const existing =
        partial && entityId
          ? await this.repository.find('insurance-plans', entityId)
          : null;
      const minimumAge = Number(data.minimumAge ?? existing?.minimumAge ?? 0);
      const maximumAgeValue = data.maximumAge ?? existing?.maximumAge ?? null;
      const maximumAge =
        maximumAgeValue === null || maximumAgeValue === ''
          ? null
          : Number(maximumAgeValue);
      if (!Number.isInteger(minimumAge) || minimumAge < 0 || minimumAge > 130)
        throw new BadRequestException(
          'حداقل سن باید عدد صحیح بین صفر تا ۱۳۰ باشد.',
        );
      if (
        maximumAge !== null &&
        (!Number.isInteger(maximumAge) ||
          maximumAge < minimumAge ||
          maximumAge > 130)
      )
        throw new BadRequestException(
          'حداکثر سن باید عدد صحیح بین حداقل سن و ۱۳۰ باشد.',
        );
      if (Object.hasOwn(data, 'minimumAge')) data.minimumAge = minimumAge;
      if (Object.hasOwn(data, 'maximumAge')) data.maximumAge = maximumAge;

      const validFromValue = data.validFrom ?? existing?.validFrom;
      const validToValue = data.validTo ?? existing?.validTo ?? null;
      const validFrom = validFromValue
        ? new Date(String(validFromValue))
        : null;
      const validTo = validToValue ? new Date(String(validToValue)) : null;
      if (!validFrom || Number.isNaN(validFrom.getTime()))
        throw new BadRequestException('شروع اعتبار طرح معتبر نیست.');
      if (validTo && (Number.isNaN(validTo.getTime()) || validTo < validFrom))
        throw new BadRequestException(
          'پایان اعتبار طرح باید بعد از شروع اعتبار باشد.',
        );
      if (Object.hasOwn(data, 'validFrom')) data.validFrom = validFrom;
      if (Object.hasOwn(data, 'validTo')) data.validTo = validTo;

      if (Object.hasOwn(data, 'coverageIds')) {
        const coverageIds = referenceIds(data.coverageIds, 'پوشش‌های طرح');
        if (!coverageIds.length)
          throw new BadRequestException('حداقل یک پوشش فعال الزامی است.');
        const coverages = await Promise.all(
          coverageIds.map((id) =>
            this.repository.find('insurance-coverages', id),
          ),
        );
        if (coverages.some((coverage) => !coverage?.isActive))
          throw new BadRequestException('یک یا چند پوشش بیمه فعال یافت نشد.');
        delete data.coverageIds;
        data.coverages = partial
          ? {
              deleteMany: {},
              create: coverageIds.map((coverageId) => ({
                coverageId,
                assignedByUserId: actorUserId,
              })),
            }
          : {
              create: coverageIds.map((coverageId) => ({
                coverageId,
                assignedByUserId: actorUserId,
              })),
            };
      }
    }
    if (resource === 'insurance-coverages') {
      const normalizedAmounts: Record<string, string> = {};
      for (const [field, positive, label] of [
        ['coverageLimit', true, 'سقف تعهد'],
        ['deductibleAmount', false, 'فرانشیز'],
      ] as const) {
        if (!Object.hasOwn(data, field)) continue;
        const value = String(data[field] ?? '').trim();
        if (
          !/^\d{1,14}(?:\.\d{1,10})?$/.test(value) ||
          (positive ? Number(value) <= 0 : Number(value) < 0)
        )
          throw new BadRequestException(
            `${label} باید Decimal ${positive ? 'مثبت' : 'نامنفی'} با حداکثر ۱۰ رقم اعشار باشد.`,
          );
        normalizedAmounts[field] = value;
        data[field] = value;
      }
      const existing =
        partial && entityId
          ? await this.repository.find('insurance-coverages', entityId)
          : null;
      const coverageLimit = Number(
        normalizedAmounts.coverageLimit ?? existing?.coverageLimit,
      );
      const deductibleAmount = Number(
        normalizedAmounts.deductibleAmount ?? existing?.deductibleAmount ?? 0,
      );
      if (deductibleAmount > coverageLimit)
        throw new BadRequestException(
          'فرانشیز نمی‌تواند بیشتر از سقف تعهد باشد.',
        );
    }
    if (
      [
        'acquaintance-methods',
        'lead-sources',
        'sales-channels',
        'lost-reasons',
        'customer-types',
        'tags',
        'campaign-types',
      ].includes(resource)
    ) {
      if (data.displayOrder !== undefined) {
        const displayOrder = Number(data.displayOrder || 0);
        if (!Number.isInteger(displayOrder) || displayOrder < 0)
          throw new BadRequestException(
            'ترتیب نمایش باید عدد صحیح نامنفی باشد.',
          );
        data.displayOrder = displayOrder;
      }
      if (resource === 'tags' && Object.hasOwn(data, 'colorHex')) {
        const colorHex = String(data.colorHex ?? '')
          .trim()
          .toUpperCase();
        if (colorHex && !/^#[0-9A-F]{6}$/.test(colorHex))
          throw new BadRequestException('رنگ Tag باید کد Hex معتبر باشد.');
        data.colorHex = colorHex || null;
      }
    }
    if (resource === 'baggage-rules' || resource === 'manifest-templates') {
      const validFrom = data.validFrom
        ? new Date(String(data.validFrom))
        : null;
      const validTo = data.validTo ? new Date(String(data.validTo)) : null;
      if (!validFrom || Number.isNaN(validFrom.getTime()))
        throw new BadRequestException('شروع اعتبار معتبر نیست.');
      if (validTo && (Number.isNaN(validTo.getTime()) || validTo < validFrom))
        throw new BadRequestException(
          'پایان اعتبار باید بعد از شروع اعتبار باشد.',
        );
      data.validFrom = validFrom;
      data.validTo = validTo;
    }
    if (resource === 'airports') {
      for (const [field, length, label] of [
        ['iataCode', 3, 'IATA'],
        ['icaoCode', 4, 'ICAO'],
      ] as const) {
        if (data[field] === undefined) continue;
        const code = String(data[field]).trim().toUpperCase();
        if (!new RegExp(`^[A-Z]{${length}}$`).test(code))
          throw new BadRequestException(
            `کد ${label} باید ${length} حرف بزرگ باشد.`,
          );
        if (
          await this.repository.fieldExists('airports', field, code, entityId)
        )
          throw new ConflictException({
            code: 'MASTER_DATA_DUPLICATE_CODE',
            message: `کد ${label} قبلاً ثبت شده است.`,
          });
        data[field] = code;
      }
      if (data.ianaTimezone !== undefined) {
        const timezone = String(data.ianaTimezone).trim();
        if (!isValidIanaTimezone(timezone))
          throw new BadRequestException('Timezone باید شناسه معتبر IANA باشد.');
        data.ianaTimezone = timezone;
      }
      for (const [field, minimum, maximum] of [
        ['latitude', -90, 90],
        ['longitude', -180, 180],
      ] as const) {
        if (data[field] === undefined) continue;
        const coordinate = Number(data[field]);
        if (
          !Number.isFinite(coordinate) ||
          coordinate < minimum ||
          coordinate > maximum
        )
          throw new BadRequestException(`${field} خارج از بازه مجاز است.`);
        data[field] = String(data[field]).trim();
      }
    }
    if (resource === 'currencies' && data.decimalDigits !== undefined) {
      const digits = Number(data.decimalDigits);
      if (!Number.isInteger(digits) || digits < 0 || digits > 6)
        throw new BadRequestException(
          'دقت ارز باید عدد صحیح بین صفر تا شش باشد.',
        );
      data.decimalDigits = digits;
    }
    if (resource === 'currencies' && data.displayPolicy !== undefined) {
      const displayPolicy = String(data.displayPolicy).trim().toUpperCase();
      if (!currencyDisplayPolicies.has(displayPolicy))
        throw new BadRequestException('سیاست نمایش ارز معتبر نیست.');
      data.displayPolicy = displayPolicy;
    }
    if (resource === 'banks' && data.swiftCode !== undefined) {
      const swiftCode = String(data.swiftCode).trim().toUpperCase();
      if (swiftCode && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(swiftCode))
        throw new BadRequestException('کد SWIFT باید ۸ یا ۱۱ نویسه بزرگ باشد.');
      if (
        swiftCode &&
        (await this.repository.fieldExists(
          'banks',
          'swiftCode',
          swiftCode,
          entityId,
        ))
      )
        throw new ConflictException({
          code: 'MASTER_DATA_DUPLICATE_CODE',
          message: 'کد SWIFT قبلاً ثبت شده است.',
        });
      data.swiftCode = swiftCode || null;
    }
    if (resource === 'payment-methods') {
      if (data.channel !== undefined) {
        const channel = String(data.channel).trim().toUpperCase();
        if (!paymentChannels.has(channel))
          throw new BadRequestException('کانال روش پرداخت معتبر نیست.');
        data.channel = channel;
      }
      if (data.direction !== undefined) {
        const direction = String(data.direction).trim().toUpperCase();
        if (!paymentDirections.has(direction))
          throw new BadRequestException('جهت روش پرداخت معتبر نیست.');
        data.direction = direction;
      }
      if (data.requiresManualApproval !== undefined)
        data.requiresManualApproval =
          data.requiresManualApproval === true ||
          String(data.requiresManualApproval).toLowerCase() === 'true';
      if (data.displayOrder !== undefined) {
        const displayOrder = Number(data.displayOrder);
        if (!Number.isInteger(displayOrder) || displayOrder < 0)
          throw new BadRequestException(
            'ترتیب نمایش باید عدد صحیح نامنفی باشد.',
          );
        data.displayOrder = displayOrder;
      }
    }
    if (resource === 'suppliers' || resource === 'brokers') {
      if (data.collaborationStatus !== undefined) {
        const collaborationStatus = String(data.collaborationStatus)
          .trim()
          .toUpperCase();
        if (!collaborationStatuses.has(collaborationStatus))
          throw new BadRequestException('وضعیت همکاری معتبر نیست.');
        data.collaborationStatus = collaborationStatus;
      }
      if (data.externalProviderReference !== undefined) {
        const reference = String(data.externalProviderReference ?? '').trim();
        data.externalProviderReference = reference || null;
      }
      if (Object.hasOwn(data, 'serviceCodes')) {
        const serviceCodes = (
          Array.isArray(data.serviceCodes)
            ? data.serviceCodes.map(String)
            : String(data.serviceCodes ?? '').split(',')
        )
          .map((value) => value.trim().toUpperCase())
          .filter(Boolean);
        if (
          serviceCodes.length > 50 ||
          serviceCodes.some((code) => !codePattern.test(code))
        )
          throw new BadRequestException('کدهای خدمت معتبر نیستند.');
        const uniqueCodes = [...new Set(serviceCodes)];
        const serviceRows = await Promise.all(
          uniqueCodes.map(async (code) => {
            const result = await this.repository.list('travel-services', {
              search: code,
              status: 'active',
              sortBy: 'code',
              sortDirection: 'asc',
              page: 1,
              pageSize: 10,
            });
            return result.rows.find((row) => row.code === code);
          }),
        );
        if (serviceRows.some((row) => !row))
          throw new BadRequestException('یک یا چند خدمت مرجع فعال یافت نشد.');
        delete data.serviceCodes;
        data.services = partial
          ? {
              deleteMany: {},
              create: serviceRows.map((row) => ({
                serviceId: row!.id,
                assignedByUserId: actorUserId,
              })),
            }
          : {
              create: serviceRows.map((row) => ({
                serviceId: row!.id,
                assignedByUserId: actorUserId,
              })),
            };
      }
    }
    if (resource === 'organization-contacts') {
      if (data.preferredChannel !== undefined) {
        const channel = String(data.preferredChannel).trim().toUpperCase();
        if (!contactChannels.has(channel))
          throw new BadRequestException('کانال ترجیحی مخاطب معتبر نیست.');
        data.preferredChannel = channel;
      }
      for (const field of ['hasWhatsapp', 'isPrimary'] as const) {
        if (data[field] !== undefined)
          data[field] =
            data[field] === true ||
            String(data[field]).trim().toLowerCase() === 'true';
      }
      const hasPhone = Object.hasOwn(data, 'phone');
      const hasEmail = Object.hasOwn(data, 'email');
      if (
        !partial &&
        !String(data.phone ?? '').trim() &&
        !String(data.email ?? '').trim()
      )
        throw new BadRequestException('حداقل تلفن یا ایمیل مخاطب الزامی است.');
      if (hasPhone) {
        const phone = String(data.phone ?? '').trim();
        delete data.phone;
        if (!phone && !partial) {
          Object.assign(data, {
            phoneEncrypted: null,
            phoneEncryptionIv: null,
            phoneEncryptionAuthTag: null,
            phoneEncryptionKeyVersion: null,
            phoneMasked: null,
            phoneFingerprint: null,
          });
        } else if (phone) {
          const protectedPhone = this.contactCrypto.protect('phone', phone);
          Object.assign(data, {
            phoneEncrypted: protectedPhone.encrypted,
            phoneEncryptionIv: protectedPhone.encryptionIv,
            phoneEncryptionAuthTag: protectedPhone.encryptionAuthTag,
            phoneEncryptionKeyVersion: protectedPhone.encryptionKeyVersion,
            phoneMasked: protectedPhone.masked,
            phoneFingerprint: protectedPhone.fingerprint,
          });
        }
      }
      if (hasEmail) {
        const email = String(data.email ?? '').trim();
        delete data.email;
        if (!email && !partial) {
          Object.assign(data, {
            emailEncrypted: null,
            emailEncryptionIv: null,
            emailEncryptionAuthTag: null,
            emailEncryptionKeyVersion: null,
            emailMasked: null,
            emailFingerprint: null,
          });
        } else if (email) {
          const protectedEmail = this.contactCrypto.protect('email', email);
          Object.assign(data, {
            emailEncrypted: protectedEmail.encrypted,
            emailEncryptionIv: protectedEmail.encryptionIv,
            emailEncryptionAuthTag: protectedEmail.encryptionAuthTag,
            emailEncryptionKeyVersion: protectedEmail.encryptionKeyVersion,
            emailMasked: protectedEmail.masked,
            emailFingerprint: protectedEmail.fingerprint,
          });
        }
      }
    }
    if (resource === 'hotel-chains' || resource === 'hotels') {
      if (Object.hasOwn(data, 'website'))
        data.website = normalizedWebsite(data.website);
    }
    if (
      resource === 'room-types' &&
      data.referenceCapacity !== undefined &&
      data.referenceCapacity !== null &&
      data.referenceCapacity !== ''
    ) {
      const capacity = Number(data.referenceCapacity);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20)
        throw new BadRequestException(
          'ظرفیت استاندارد اتاق باید عدد صحیح بین ۱ تا ۲۰ باشد.',
        );
      data.referenceCapacity = capacity;
    } else if (
      resource === 'room-types' &&
      Object.hasOwn(data, 'referenceCapacity')
    ) {
      data.referenceCapacity = null;
    }
    if (resource === 'meal-services') {
      if (data.category !== undefined) {
        const category = String(data.category).trim().toUpperCase();
        if (!mealServiceCategories.has(category))
          throw new BadRequestException('دسته Meal/Service معتبر نیست.');
        data.category = category;
      }
      if (Object.hasOwn(data, 'includedMeals')) {
        const includedMeals = (
          Array.isArray(data.includedMeals)
            ? data.includedMeals.map(String)
            : String(data.includedMeals ?? '').split(',')
        )
          .map((value) => value.trim())
          .filter(Boolean);
        if (
          includedMeals.length > 20 ||
          includedMeals.some((value) => value.length > 80)
        )
          throw new BadRequestException('فهرست وعده‌های شامل‌شده معتبر نیست.');
        data.includedMeals = [...new Set(includedMeals)];
      }
    }
    if (resource === 'facilities' && data.displayOrder !== undefined) {
      const displayOrder =
        data.displayOrder === '' || data.displayOrder === null
          ? 0
          : Number(data.displayOrder);
      if (!Number.isInteger(displayOrder) || displayOrder < 0)
        throw new BadRequestException(
          'ترتیب نمایش امکان باید عدد صحیح نامنفی باشد.',
        );
      data.displayOrder = displayOrder;
    }
    if (resource === 'hotels') {
      if (data.isSaleableReference === '') delete data.isSaleableReference;
      else if (data.isSaleableReference !== undefined)
        data.isSaleableReference =
          data.isSaleableReference === true ||
          String(data.isSaleableReference).toLowerCase() === 'true';
      for (const field of ['checkInTime', 'checkOutTime'] as const) {
        if (data[field] === undefined) continue;
        const time = String(data[field] ?? '').trim();
        if (time && !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time))
          throw new BadRequestException(`${field} باید با قالب HH:mm باشد.`);
        data[field] = time || null;
      }
      const hasLatitude = Object.hasOwn(data, 'latitude');
      const hasLongitude = Object.hasOwn(data, 'longitude');
      if (hasLatitude !== hasLongitude)
        throw new BadRequestException(
          'عرض و طول جغرافیایی باید با هم ثبت شوند.',
        );
      for (const [field, minimum, maximum] of [
        ['latitude', -90, 90],
        ['longitude', -180, 180],
      ] as const) {
        if (!Object.hasOwn(data, field)) continue;
        const raw = String(data[field] ?? '').trim();
        if (!raw) {
          data[field] = null;
          continue;
        }
        const coordinate = Number(raw);
        if (
          !Number.isFinite(coordinate) ||
          coordinate < minimum ||
          coordinate > maximum
        )
          throw new BadRequestException(`${field} خارج از بازه مجاز است.`);
        data[field] = raw;
      }

      const relationInputs = [
        {
          input: 'mealServiceIds',
          relation: 'mealServices',
          foreignKey: 'mealServiceId',
          target: 'meal-services' as const,
          legacy: 'mealServiceId',
          label: 'سرویس‌های غذایی',
        },
        {
          input: 'roomTypeIds',
          relation: 'roomTypes',
          foreignKey: 'roomTypeId',
          target: 'room-types' as const,
          legacy: 'defaultRoomTypeId',
          label: 'نوع‌های اتاق',
        },
        {
          input: 'facilityIds',
          relation: 'facilities',
          foreignKey: 'facilityId',
          target: 'facilities' as const,
          label: 'امکانات',
        },
      ];
      for (const relationInput of relationInputs) {
        if (!Object.hasOwn(data, relationInput.input)) continue;
        const ids = referenceIds(
          data[relationInput.input],
          relationInput.label,
        );
        const rows = await Promise.all(
          ids.map((id) => this.repository.find(relationInput.target, id)),
        );
        if (rows.some((row) => !row?.isActive))
          throw new BadRequestException(
            `یک یا چند مرجع فعال ${relationInput.label} یافت نشد.`,
          );
        delete data[relationInput.input];
        data[relationInput.relation] = partial
          ? {
              deleteMany: {},
              create: ids.map((id) => ({
                [relationInput.foreignKey]: id,
                assignedByUserId: actorUserId,
              })),
            }
          : {
              create: ids.map((id) => ({
                [relationInput.foreignKey]: id,
                assignedByUserId: actorUserId,
              })),
            };
        if (relationInput.legacy) data[relationInput.legacy] = ids[0] ?? null;
      }
    }
    if (resource === 'composite-hotels') {
      if (data.isSaleableReference === '') delete data.isSaleableReference;
      else if (data.isSaleableReference !== undefined)
        data.isSaleableReference =
          data.isSaleableReference === true ||
          String(data.isSaleableReference).toLowerCase() === 'true';
      if (Object.hasOwn(data, 'memberHotelIds')) {
        const memberIds = referenceIds(
          data.memberHotelIds,
          'هتل‌های عضو ترکیب',
        );
        if (!memberIds.length)
          throw new BadRequestException('حداقل یک هتل عضو الزامی است.');
        const backupIds = Object.hasOwn(data, 'backupMemberIds')
          ? referenceIds(data.backupMemberIds, 'اعضای پشتیبان')
          : [];
        if (backupIds.some((id) => !memberIds.includes(id)))
          throw new BadRequestException(
            'هتل پشتیبان باید در فهرست اعضای ترکیب باشد.',
          );
        const existing =
          partial && entityId
            ? await this.repository.find('composite-hotels', entityId)
            : null;
        const cityId = String(data.cityId ?? existing?.cityId ?? '');
        const hotels = await Promise.all(
          memberIds.map((id) => this.repository.find('hotels', id)),
        );
        if (
          hotels.some(
            (hotel) =>
              !hotel?.isActive ||
              !hotel.isSaleableReference ||
              hotel.cityId !== cityId,
          )
        )
          throw new BadRequestException(
            'هتل‌های عضو باید فعال، فروش‌پذیر و در شهر ترکیب باشند.',
          );
        delete data.memberHotelIds;
        delete data.backupMemberIds;
        data.members = partial
          ? {
              deleteMany: {},
              create: memberIds.map((hotelId, index) => ({
                hotelId,
                priority: index + 1,
                isBackup: backupIds.includes(hotelId),
                assignedByUserId: actorUserId,
              })),
            }
          : {
              create: memberIds.map((hotelId, index) => ({
                hotelId,
                priority: index + 1,
                isBackup: backupIds.includes(hotelId),
                assignedByUserId: actorUserId,
              })),
            };
      } else if (Object.hasOwn(data, 'backupMemberIds')) {
        throw new BadRequestException(
          'برای ویرایش اعضای پشتیبان، فهرست کامل هتل‌های عضو لازم است.',
        );
      }
    }
    if (
      resource === 'hotels' &&
      data.starRating !== undefined &&
      data.starRating !== null &&
      data.starRating !== ''
    ) {
      const rating = Number(data.starRating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5)
        throw new BadRequestException(
          'درجه هتل باید عدد صحیح بین ۱ تا ۵ باشد.',
        );
      data.starRating = rating;
    } else if (resource === 'hotels' && Object.hasOwn(data, 'starRating')) {
      data.starRating = null;
    }
    if (resource === 'leaders') {
      if (data.cityId === null)
        throw new BadRequestException('شهر فعالیت لیدر الزامی است.');
      for (const [field, label] of [
        ['languages', 'زبان‌های لیدر'],
        ['destinations', 'مقصدهای لیدر'],
      ] as const) {
        if (!Object.hasOwn(data, field)) continue;
        const values = (
          Array.isArray(data[field])
            ? data[field].map(String)
            : String(data[field] ?? '').split(',')
        )
          .map((value) => value.trim())
          .filter(Boolean);
        if (
          !values.length ||
          values.length > 30 ||
          values.some((value) => value.length > 80)
        )
          throw new BadRequestException(`${label} معتبر نیست.`);
        data[field] = [...new Set(values)];
      }
      for (const [input, prefix] of [
        ['primaryPhone', 'primaryPhone'],
        ['roamingPhone', 'roamingPhone'],
      ] as const) {
        if (!Object.hasOwn(data, input)) continue;
        const phone = String(data[input] ?? '').trim();
        delete data[input];
        if (!phone) {
          Object.assign(data, {
            [`${prefix}Encrypted`]: null,
            [`${prefix}EncryptionIv`]: null,
            [`${prefix}EncryptionAuthTag`]: null,
            [`${prefix}EncryptionKeyVersion`]: null,
            [`${prefix}Masked`]: null,
            [`${prefix}Fingerprint`]: null,
          });
          continue;
        }
        const protectedPhone = this.contactCrypto.protect('phone', phone);
        Object.assign(data, {
          [`${prefix}Encrypted`]: protectedPhone.encrypted,
          [`${prefix}EncryptionIv`]: protectedPhone.encryptionIv,
          [`${prefix}EncryptionAuthTag`]:
            protectedPhone.encryptionAuthTag,
          [`${prefix}EncryptionKeyVersion`]:
            protectedPhone.encryptionKeyVersion,
          [`${prefix}Masked`]: protectedPhone.masked,
          [`${prefix}Fingerprint`]: protectedPhone.fingerprint,
        });
      }
    }
    if (resource === 'tour-types' && data.scope !== undefined) {
      const scope = String(data.scope).trim().toUpperCase();
      if (!tourScopes.has(scope))
        throw new BadRequestException('دامنه نوع تور معتبر نیست.');
      data.scope = scope;
    }
    if (
      resource === 'transfer-types' &&
      data.serviceMode !== undefined
    ) {
      const mode = String(data.serviceMode).trim().toUpperCase();
      if (!transferServiceModes.has(mode))
        throw new BadRequestException('شیوه سرویس ترانسفر معتبر نیست.');
      data.serviceMode = mode;
    }
    if (
      resource === 'cip-services' &&
      data.passengerScope !== undefined
    ) {
      const scope = String(data.passengerScope).trim().toUpperCase();
      if (!cipPassengerScopes.has(scope))
        throw new BadRequestException('دامنه مسافر خدمت CIP معتبر نیست.');
      data.passengerScope = scope;
    }
    for (const catalogResource of [
      'tour-types',
      'transfer-types',
      'cip-services',
      'visa-services',
    ] as const) {
      if (resource !== catalogResource || data.displayOrder === undefined)
        continue;
      const displayOrder = Number(data.displayOrder || 0);
      if (!Number.isInteger(displayOrder) || displayOrder < 0)
        throw new BadRequestException(
          'ترتیب نمایش باید عدد صحیح نامنفی باشد.',
        );
      data.displayOrder = displayOrder;
    }
    if (
      resource === 'transfer-types' &&
      Object.hasOwn(data, 'suggestedCapacity')
    ) {
      const raw = String(data.suggestedCapacity ?? '').trim();
      if (!raw) data.suggestedCapacity = null;
      else {
        const capacity = Number(raw);
        if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100)
          throw new BadRequestException(
            'ظرفیت پیشنهادی باید عدد صحیح بین ۱ تا ۱۰۰ باشد.',
          );
        data.suggestedCapacity = capacity;
      }
    }
    if (resource === 'cip-services' && Object.hasOwn(data, 'includedItems')) {
      const includedItems = (
        Array.isArray(data.includedItems)
          ? data.includedItems.map(String)
          : String(data.includedItems ?? '').split(',')
      )
        .map((value) => value.trim())
        .filter(Boolean);
      if (
        !includedItems.length ||
        includedItems.length > 50 ||
        includedItems.some((value) => value.length > 120)
      )
        throw new BadRequestException('اقلام خدمت CIP معتبر نیستند.');
      data.includedItems = [...new Set(includedItems)];
    }
    if (
      resource === 'visa-services' &&
      Object.hasOwn(data, 'referenceValidityDays')
    ) {
      const raw = String(data.referenceValidityDays ?? '').trim();
      if (!raw) data.referenceValidityDays = null;
      else {
        const days = Number(raw);
        if (!Number.isInteger(days) || days < 1 || days > 3650)
          throw new BadRequestException(
            'مدت اعتبار مرجع باید عدد صحیح بین ۱ تا ۳۶۵۰ روز باشد.',
          );
        data.referenceValidityDays = days;
      }
    }
    if (resource === 'organizations' && Object.hasOwn(data, 'roleCodes')) {
      const roleCodes = Array.isArray(data.roleCodes)
        ? data.roleCodes.map(String).map((value) => value.trim().toUpperCase())
        : String(data.roleCodes ?? '')
            .split(',')
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean);
      if (
        !roleCodes.length ||
        roleCodes.some((code) => !organizationRoles.has(code))
      )
        throw new BadRequestException('Role سازمان معتبر نیست.');
      delete data.roleCodes;
      data.roles = partial
        ? {
            deleteMany: {},
            create: roleCodes.map((roleCode) => ({
              roleCode,
              assignedByUserId: actorUserId,
            })),
          }
        : {
            create: roleCodes.map((roleCode) => ({
              roleCode,
              assignedByUserId: actorUserId,
            })),
          };
    }
    const relationChecks: Partial<
      Record<
        MasterDataResource,
        { field: string; target: MasterDataResource; role?: string }
      >
    > = {
      cities: { field: 'countryId', target: 'countries' },
      regions: { field: 'countryId', target: 'countries' },
      terminals: { field: 'airportId', target: 'airports' },
      banks: { field: 'countryId', target: 'countries' },
      'bank-branches': { field: 'bankId', target: 'banks' },
      hotels: { field: 'cityId', target: 'cities' },
      'hotel-chains': { field: 'countryId', target: 'countries' },
      'composite-hotels': { field: 'cityId', target: 'cities' },
      insurers: {
        field: 'organizationId',
        target: 'organizations',
        role: 'INSURANCE_PROVIDER',
      },
      'insurance-plans': {
        field: 'insurerId',
        target: 'insurers',
      },
      'insurance-coverages': {
        field: 'currencyId',
        target: 'currencies',
      },
      airlines: {
        field: 'organizationId',
        target: 'organizations',
        role: 'AIRLINE',
      },
      'baggage-rules': { field: 'airlineId', target: 'airlines' },
      'manifest-templates': { field: 'airlineId', target: 'airlines' },
      'rail-companies': {
        field: 'organizationId',
        target: 'organizations',
        role: 'RAIL_OPERATOR',
      },
      'bus-companies': {
        field: 'organizationId',
        target: 'organizations',
        role: 'BUS_PROVIDER',
      },
      brokers: {
        field: 'organizationId',
        target: 'organizations',
        role: 'BROKER',
      },
      suppliers: {
        field: 'organizationId',
        target: 'organizations',
        role: 'SUPPLIER',
      },
      'organization-contacts': {
        field: 'organizationId',
        target: 'organizations',
      },
      leaders: { field: 'cityId', target: 'cities' },
      'cip-services': { field: 'airportId', target: 'airports' },
      'visa-services': { field: 'countryId', target: 'countries' },
    };
    const check = relationChecks[resource];
    if (check && typeof data[check.field] === 'string') {
      const related = await this.repository.find(
        check.target,
        data[check.field] as string,
      );
      const roles = related?.roles as { roleCode: string }[] | undefined;
      if (
        !related ||
        !related.isActive ||
        (check.role && !roles?.some(({ roleCode }) => roleCode === check.role))
      )
        throw new BadRequestException('مرجع فعال با Role موردنیاز یافت نشد.');
    }
    if (resource === 'hotels' && typeof data.chainId === 'string') {
      const chain = await this.repository.find('hotel-chains', data.chainId);
      if (!chain?.isActive)
        throw new BadRequestException('زنجیره هتل فعال یافت نشد.');
    }
    if (
      (resource === 'airlines' ||
        resource === 'rail-companies' ||
        resource === 'bus-companies') &&
      typeof data.countryId === 'string'
    ) {
      const country = await this.repository.find('countries', data.countryId);
      if (!country?.isActive)
        throw new BadRequestException('کشور فعال برای شرکت حمل‌ونقل یافت نشد.');
    }
    if (resource === 'insurers' && typeof data.countryId === 'string') {
      const country = await this.repository.find('countries', data.countryId);
      if (!country?.isActive)
        throw new BadRequestException('کشور فعال برای شرکت بیمه یافت نشد.');
    }
    if (
      (resource === 'cip-services' ||
        resource === 'visa-services' ||
        resource === 'bus-companies') &&
      typeof data.supplierId === 'string'
    ) {
      const supplier = await this.repository.find(
        'suppliers',
        data.supplierId,
      );
      if (!supplier?.isActive)
        throw new BadRequestException('Provider فعال یافت نشد.');
    }
    if (resource === 'baggage-rules' && typeof data.cabinClassId === 'string') {
      const cabinClass = await this.repository.find(
        'cabin-classes',
        data.cabinClassId,
      );
      if (!cabinClass?.isActive)
        throw new BadRequestException('کلاس پروازی فعال یافت نشد.');
    }
    if (resource === 'bank-branches') {
      if (typeof data.cityId === 'string') {
        const city = await this.repository.find('cities', data.cityId);
        if (!city?.isActive)
          throw new BadRequestException('شهر فعال برای شعبه بانک یافت نشد.');
      }
      if (data.code !== undefined) {
        const existing = entityId
          ? await this.repository.find('bank-branches', entityId)
          : null;
        const bankId = String(data.bankId ?? existing?.bankId ?? '');
        if (
          !uuidPattern.test(bankId) ||
          (await this.repository.bankBranchCodeExists(
            bankId,
            String(data.code),
            entityId,
          ))
        )
          throw new ConflictException({
            code: 'MASTER_DATA_DUPLICATE_CODE',
            message: 'کد شعبه در بانک انتخاب‌شده قبلاً ثبت شده است.',
          });
      }
    }
    if (resource === 'suppliers' || resource === 'brokers') {
      const existing = entityId ? await this.repository.find(resource, entityId) : null;
      const organizationId = Object.hasOwn(data, 'organizationId')
        ? data.organizationId : existing?.organizationId;
      const primaryContactId = Object.hasOwn(data, 'primaryContactId')
        ? data.primaryContactId : existing?.primaryContactId;
      if (primaryContactId !== null && primaryContactId !== undefined) {
        if (typeof primaryContactId !== 'string' || !uuidPattern.test(primaryContactId))
          throw new BadRequestException('تماس اصلی باید شناسه معتبر باشد.');
        const contact = await this.repository.find('organization-contacts', primaryContactId);
        if (!contact?.isActive || contact.organizationId !== organizationId)
          throw new BadRequestException('تماس اصلی باید مخاطب فعال همان سازمان باشد.');
      }
      if (typeof data.countryId === 'string') {
        const country = await this.repository.find('countries', data.countryId);
        if (!country?.isActive)
          throw new BadRequestException('کشور فعال برای پروفایل یافت نشد.');
      }
      const cityId = Object.hasOwn(data, 'cityId') ? data.cityId : existing?.cityId;
      const countryId = Object.hasOwn(data, 'countryId') ? data.countryId : existing?.countryId;
      if (typeof cityId === 'string') {
        const city = await this.repository.find('cities', cityId);
        if (
          !city?.isActive ||
          (typeof countryId === 'string' && city.countryId !== countryId)
        )
          throw new BadRequestException(
            'شهر فعال باید در کشور انتخاب‌شده باشد.',
          );
      }
    }
    if (resource === 'regions' && typeof data.parentRegionId === 'string') {
      if (data.parentRegionId === entityId)
        throw new BadRequestException('ناحیه والد نمی‌تواند خود رکورد باشد.');
      const parentRegion = await this.repository.find(
        'regions',
        data.parentRegionId,
      );
      if (
        !parentRegion?.isActive ||
        (typeof data.countryId === 'string' &&
          parentRegion.countryId !== data.countryId)
      )
        throw new BadRequestException(
          'ناحیه والد فعال باید در همان کشور باشد.',
        );
    }
    if (resource === 'cities' && typeof data.regionId === 'string') {
      const region = await this.repository.find('regions', data.regionId);
      if (
        !region?.isActive ||
        (typeof data.countryId === 'string' &&
          region.countryId !== data.countryId)
      )
        throw new BadRequestException(
          'استان/ناحیه فعال باید در همان کشور باشد.',
        );
    }
    if (resource === 'airports') {
      if (typeof data.cityId === 'string') {
        const city = await this.repository.find('cities', data.cityId);
        if (
          !city?.isActive ||
          (typeof data.countryId === 'string' &&
            city.countryId !== data.countryId)
        )
          throw new BadRequestException(
            'شهر فعال باید در کشور انتخاب‌شده باشد.',
          );
      }
      delete data.countryId;
    }

    if (resource === 'hotels' && typeof data.organizationId === 'string') {
      const organization = await this.repository.find(
        'organizations',
        data.organizationId,
      );
      const roles = organization?.roles as { roleCode: string }[] | undefined;
      if (
        !organization?.isActive ||
        !roles?.some(({ roleCode }) => roleCode === 'HOTEL_PROVIDER')
      )
        throw new BadRequestException(
          'Organization فعال هتل با Role مناسب یافت نشد.',
        );
    }
    if (resource === 'exchange-rates') {
      const fromCode = String(data.fromCurrencyCode ?? '').toUpperCase();
      const toCode = String(data.toCurrencyCode ?? '').toUpperCase();
      if (
        !/^[A-Z]{3}$/.test(fromCode) ||
        !/^[A-Z]{3}$/.test(toCode) ||
        fromCode === toCode
      )
        throw new BadRequestException('جفت ارز معتبر نیست.');
      const rate = String(data.rate ?? '');
      if (!/^\d+(\.\d{1,10})?$/.test(rate) || Number(rate) <= 0)
        throw new BadRequestException(
          'نرخ Decimal مثبت با حداکثر ۱۰ رقم اعشار لازم است.',
        );
      const observedAt = new Date(String(data.observedAt));
      const validFrom = new Date(String(data.validFrom ?? data.observedAt));
      const validTo = data.validTo ? new Date(String(data.validTo)) : null;
      if (
        Number.isNaN(observedAt.getTime()) ||
        Number.isNaN(validFrom.getTime())
      )
        throw new BadRequestException('زمان مشاهده یا شروع اعتبار معتبر نیست.');
      if (validTo && (Number.isNaN(validTo.getTime()) || validTo <= validFrom))
        throw new BadRequestException(
          'پایان اعتبار باید بعد از شروع اعتبار باشد.',
        );
      const rateType = String(data.rateType ?? 'REFERENCE').toUpperCase();
      if (!['BUY', 'SELL', 'REFERENCE'].includes(rateType))
        throw new BadRequestException('نوع نرخ معتبر نیست.');
      const currencies = await Promise.all([
        this.repository.list('currencies', {
          search: fromCode,
          status: 'active',
          sortBy: 'code',
          sortDirection: 'asc',
          page: 1,
          pageSize: 10,
        }),
        this.repository.list('currencies', {
          search: toCode,
          status: 'active',
          sortBy: 'code',
          sortDirection: 'asc',
          page: 1,
          pageSize: 10,
        }),
      ]);
      const from = currencies[0].rows.find((row) => row.code === fromCode);
      const to = currencies[1].rows.find((row) => row.code === toCode);
      if (!from || !to)
        throw new BadRequestException('ارز فعال مبدأ یا مقصد یافت نشد.');
      return {
        fromCurrencyId: from.id,
        toCurrencyId: to.id,
        rate,
        source: String(data.source).trim(),
        observedAt,
        validFrom,
        validTo,
        rateType,
        correctionReason: data.correctionReason
          ? String(data.correctionReason).trim()
          : null,
        status: 'DRAFT',
        isAuthoritative: false,
      };
    }
    return data;
  }
}
