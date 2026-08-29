import { Inject, Injectable } from '@nestjs/common';
import type {
  MasterDataListQuery,
  MasterDataRecord,
  MasterDataResource,
} from '@rubi/contracts';
import { AuditOutcome } from '@rubi/database';

import { DatabaseService } from '../database/database.service';

type Row = Record<string, unknown> & {
  id: string;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

interface Delegate {
  findFirst(args: object): Promise<Row | null>;
  findMany(args: object): Promise<Row[]>;
  findUnique(args: object): Promise<Row | null>;
  count(args: object): Promise<number>;
  create(args: object): Promise<Row>;
  update(args: object): Promise<Row>;
  updateMany(args: object): Promise<{ count: number }>;
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

function json(value: unknown): Exclude<JsonValue, null> {
  return JSON.parse(JSON.stringify(value)) as Exclude<JsonValue, null>;
}

const protectedContactFields = new Set([
  'phoneEncrypted',
  'phoneEncryptionIv',
  'phoneEncryptionAuthTag',
  'phoneEncryptionKeyVersion',
  'phoneFingerprint',
  'emailEncrypted',
  'emailEncryptionIv',
  'emailEncryptionAuthTag',
  'emailEncryptionKeyVersion',
  'emailFingerprint',
]);

function auditSnapshot(resource: MasterDataResource, value: unknown) {
  const snapshot = json(value);
  if (
    resource !== 'organization-contacts' ||
    typeof snapshot !== 'object' ||
    Array.isArray(snapshot)
  )
    return snapshot;
  return Object.fromEntries(
    Object.entries(snapshot).filter(
      ([key]) => !protectedContactFields.has(key),
    ),
  );
}

const delegateNames: Record<MasterDataResource, string> = {
  countries: 'masterCountry',
  regions: 'masterRegion',
  cities: 'masterCity',
  airports: 'masterAirport',
  terminals: 'masterTerminal',
  currencies: 'masterCurrency',
  'exchange-rates': 'masterDraftExchangeRate',
  banks: 'masterBank',
  'bank-branches': 'masterBankBranch',
  'payment-methods': 'masterPaymentMethod',
  insurers: 'masterInsurer',
  airlines: 'masterAirline',
  'aircraft-types': 'masterAircraftType',
  'cabin-classes': 'masterCabinClass',
  'baggage-rules': 'masterBaggageRule',
  'manifest-templates': 'masterManifestTemplate',
  'rail-companies': 'masterRailCompany',
  'train-types': 'masterTrainType',
  'bus-companies': 'masterBusCompany',
  'bus-types': 'masterBusType',
  hotels: 'masterHotel',
  'hotel-chains': 'masterHotelChain',
  'room-types': 'masterRoomType',
  'meal-services': 'masterMealService',
  facilities: 'masterFacility',
  'composite-hotels': 'masterCompositeHotel',
  organizations: 'masterOrganization',
  suppliers: 'masterSupplier',
  brokers: 'masterBroker',
  'travel-services': 'masterTravelService',
  'organization-contacts': 'masterOrganizationContact',
  leaders: 'masterLeader',
  'acquaintance-methods': 'masterAcquaintanceMethod',
  'lead-sources': 'masterLeadSource',
  'sales-channels': 'masterSalesChannel',
  'lost-reasons': 'masterLostReason',
  'customer-types': 'masterCustomerType',
  tags: 'masterTag',
  'campaign-types': 'masterCampaignType',
};

const nameFields: Record<MasterDataResource, string> = {
  regions: 'name',
  countries: 'name',
  airports: 'name',
  terminals: 'name',
  cities: 'name',
  currencies: 'name',
  'exchange-rates': 'source',
  banks: 'name',
  'bank-branches': 'name',
  'payment-methods': 'name',
  insurers: 'name',
  airlines: 'name',
  'aircraft-types': 'name',
  'cabin-classes': 'name',
  'baggage-rules': 'name',
  'manifest-templates': 'name',
  'rail-companies': 'name',
  'train-types': 'name',
  'bus-companies': 'name',
  'bus-types': 'name',
  hotels: 'name',
  'hotel-chains': 'name',
  'room-types': 'name',
  'meal-services': 'name',
  facilities: 'name',
  'composite-hotels': 'name',
  organizations: 'displayName',
  suppliers: 'code',
  brokers: 'name',
  'travel-services': 'name',
  'organization-contacts': 'fullName',
  leaders: 'name',
  'acquaintance-methods': 'name',
  'lead-sources': 'name',
  'sales-channels': 'name',
  'lost-reasons': 'name',
  'customer-types': 'name',
  tags: 'name',
  'campaign-types': 'name',
};

const codeFields: Record<MasterDataResource, string> = {
  countries: 'code',
  regions: 'code',
  cities: 'code',
  airports: 'iataCode',
  terminals: 'code',
  currencies: 'code',
  'exchange-rates': 'observedAt',
  banks: 'code',
  'bank-branches': 'code',
  'payment-methods': 'code',
  insurers: 'code',
  airlines: 'code',
  'aircraft-types': 'code',
  'cabin-classes': 'code',
  'baggage-rules': 'code',
  'manifest-templates': 'code',
  'rail-companies': 'code',
  'train-types': 'code',
  'bus-companies': 'code',
  'bus-types': 'code',
  hotels: 'code',
  'hotel-chains': 'code',
  'room-types': 'code',
  'meal-services': 'code',
  facilities: 'code',
  'composite-hotels': 'code',
  organizations: 'code',
  suppliers: 'code',
  brokers: 'code',
  'travel-services': 'code',
  'organization-contacts': 'code',
  leaders: 'code',
  'acquaintance-methods': 'code',
  'lead-sources': 'code',
  'sales-channels': 'code',
  'lost-reasons': 'code',
  'customer-types': 'code',
  tags: 'code',
  'campaign-types': 'code',
};

const searchFields: Record<MasterDataResource, readonly string[]> = {
  countries: ['name', 'englishName', 'code'],
  regions: ['name', 'englishName', 'code'],
  cities: ['name', 'englishName', 'code'],
  airports: ['name', 'englishName', 'iataCode', 'icaoCode', 'ianaTimezone'],
  terminals: ['name', 'englishName', 'code'],
  currencies: ['name', 'englishName', 'code'],
  'exchange-rates': ['source'],
  banks: ['name', 'englishName', 'code', 'swiftCode'],
  'bank-branches': ['name', 'englishName', 'code', 'address', 'phone'],
  'payment-methods': ['name', 'englishName', 'code', 'description'],
  insurers: ['name', 'code'],
  airlines: ['name', 'englishName', 'code', 'icaoCode'],
  'aircraft-types': ['name', 'englishName', 'code', 'manufacturer', 'model'],
  'cabin-classes': ['name', 'englishName', 'code', 'bookingCode'],
  'baggage-rules': ['name', 'code', 'description'],
  'manifest-templates': ['name', 'code', 'sheetName'],
  'rail-companies': ['name', 'englishName', 'code'],
  'train-types': ['name', 'englishName', 'code', 'manufacturer', 'model'],
  'bus-companies': ['name', 'englishName', 'code'],
  'bus-types': ['name', 'englishName', 'code', 'manufacturer', 'model'],
  hotels: ['name', 'englishName', 'code'],
  'hotel-chains': ['name', 'englishName', 'code', 'website'],
  'room-types': ['name', 'englishName', 'code', 'usageDescription'],
  'meal-services': ['name', 'englishName', 'code'],
  facilities: ['name', 'englishName', 'code', 'category'],
  'composite-hotels': ['name', 'englishName', 'code', 'usageCondition'],
  organizations: ['displayName', 'legalName', 'code'],
  suppliers: ['code', 'externalProviderReference'],
  brokers: ['name', 'code'],
  'travel-services': ['name', 'englishName', 'code'],
  'organization-contacts': ['fullName', 'jobTitle', 'code'],
  leaders: ['name', 'code'],
  'acquaintance-methods': ['name', 'englishName', 'description', 'code'],
  'lead-sources': ['name', 'englishName', 'description', 'code'],
  'sales-channels': ['name', 'englishName', 'description', 'code'],
  'lost-reasons': ['name', 'englishName', 'description', 'code'],
  'customer-types': ['name', 'englishName', 'description', 'code'],
  tags: ['name', 'englishName', 'description', 'code', 'colorHex'],
  'campaign-types': ['name', 'englishName', 'description', 'code'],
};

function delegate(client: unknown, resource: MasterDataResource): Delegate {
  return (client as Record<string, Delegate>)[
    delegateNames[resource]
  ] as Delegate;
}

function relations(resource: MasterDataResource): object | undefined {
  if (resource === 'exchange-rates')
    return { fromCurrency: true, toCurrency: true };
  if (resource === 'organizations') return { roles: true };
  if (resource === 'airlines') return { organization: true, country: true };
  if (resource === 'baggage-rules') return { airline: true, cabinClass: true };
  if (resource === 'manifest-templates') return { airline: true };
  if (resource === 'rail-companies' || resource === 'bus-companies')
    return { organization: true, country: true };
  if (resource === 'suppliers')
    return {
      organization: true,
      country: true,
      city: true,
      services: { include: { service: true } },
    };
  if (resource === 'brokers')
    return {
      organization: true,
      country: true,
      city: true,
      services: { include: { service: true } },
    };
  if (resource === 'travel-services')
    return { _count: { select: { suppliers: true, brokers: true } } };
  if (resource === 'organization-contacts') return { organization: true };
  if (resource === 'regions') return { country: true, parent: true };
  if (resource === 'cities') return { country: true, region: true };
  if (resource === 'airports')
    return { city: { include: { country: true, region: true } } };
  if (resource === 'terminals') return { airport: true };
  if (resource === 'banks')
    return { country: true, _count: { select: { branches: true } } };
  if (resource === 'bank-branches') return { bank: true, city: true };
  if (resource === 'hotels')
    return {
      city: { include: { country: true, region: true } },
      chain: true,
      organization: true,
      mealService: true,
      defaultRoomType: true,
      facilities: { include: { facility: true } },
      mealServices: { include: { mealService: true } },
      roomTypes: { include: { roomType: true } },
    };
  if (resource === 'hotel-chains')
    return { country: true, _count: { select: { hotels: true } } };
  if (resource === 'room-types')
    return { _count: { select: { hotelLinks: true } } };
  if (resource === 'meal-services')
    return { _count: { select: { hotelLinks: true } } };
  if (resource === 'facilities')
    return { _count: { select: { hotels: true } } };
  if (resource === 'composite-hotels')
    return {
      city: { include: { country: true, region: true } },
      members: { include: { hotel: { include: { city: true } } } },
    };
  return undefined;
}

function scalar(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(String).join(',');
  if (typeof value === 'object' && 'toString' in value) return String(value);
  return null;
}

export function toMasterDataRecord(
  resource: MasterDataResource,
  row: Row,
): MasterDataRecord {
  const from = row.fromCurrency as Record<string, unknown> | undefined;
  const to = row.toCurrency as Record<string, unknown> | undefined;
  const roles = row.roles as { roleCode: string }[] | undefined;
  const country = row.country as Record<string, unknown> | undefined;
  const region = row.region as Record<string, unknown> | undefined;
  const parent = row.parent as Record<string, unknown> | undefined;
  const city = row.city as Record<string, unknown> | undefined;
  const airport = row.airport as Record<string, unknown> | undefined;
  const bank = row.bank as Record<string, unknown> | undefined;
  const organization = row.organization as Record<string, unknown> | undefined;
  const airline = row.airline as Record<string, unknown> | undefined;
  const cabinClass = row.cabinClass as Record<string, unknown> | undefined;
  const services = row.services as
    { service: Record<string, unknown> }[] | undefined;
  const chain = row.chain as Record<string, unknown> | undefined;
  const mealService = row.mealService as Record<string, unknown> | undefined;
  const defaultRoomType = row.defaultRoomType as
    Record<string, unknown> | undefined;
  const facilityLinks = row.facilities as
    { facility: Record<string, unknown> }[] | undefined;
  const mealServiceLinks = row.mealServices as
    { mealService: Record<string, unknown> }[] | undefined;
  const roomTypeLinks = row.roomTypes as
    { roomType: Record<string, unknown> }[] | undefined;
  const compositeMembers = row.members as
    | {
        hotel: Record<string, unknown>;
        priority: number;
        isBackup: boolean;
      }[]
    | undefined;
  const count = row._count as Record<string, unknown> | undefined;
  const code =
    resource === 'exchange-rates'
      ? `${String(from?.code ?? '')}/${String(to?.code ?? '')}`
      : resource === 'airports'
        ? String(row.iataCode ?? '')
        : String(row.code ?? '');
  const name =
    resource === 'organizations'
      ? String(row.displayName ?? '')
      : resource === 'suppliers'
        ? String(organization?.displayName ?? '')
        : resource === 'organization-contacts'
          ? String(row.fullName ?? '')
          : resource === 'exchange-rates'
            ? `${code} · ${String(row.source ?? '')}`
            : String(row.name ?? '');
  const omitted = new Set([
    'id',
    'code',
    'name',
    'displayName',
    'isActive',
    'version',
    'createdAt',
    'updatedAt',
    'createdByUserId',
    'updatedByUserId',
    'deactivatedByUserId',
    'deactivatedAt',
    'fromCurrency',
    'toCurrency',
    'roles',
    'country',
    'region',
    'parent',
    'city',
    'airport',
    'bank',
    'organization',
    'airline',
    'cabinClass',
    'services',
    'chain',
    'mealService',
    'defaultRoomType',
    'facilities',
    'mealServices',
    'roomTypes',
    'members',
    '_count',
    ...protectedContactFields,
  ]);
  const attributes = Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !omitted.has(key))
      .map(([key, value]) => [key, scalar(value)]),
  );
  if (resource === 'exchange-rates') {
    attributes.fromCurrencyCode = String(from?.code ?? '');
    attributes.toCurrencyCode = String(to?.code ?? '');
  }
  if (resource === 'organizations') attributes.displayName = name;
  if (roles)
    attributes.roleCodes = roles.map(({ roleCode }) => roleCode).join(',');
  if (resource === 'countries') attributes.iso2Code = code;
  if (resource === 'regions') {
    attributes.countryCode = String(country?.code ?? '');
    attributes.countryName = String(country?.name ?? '');
    attributes.parentRegionName = String(parent?.name ?? '');
  }
  if (resource === 'cities') {
    attributes.countryCode = String(country?.code ?? '');
    attributes.countryName = String(country?.name ?? '');
    attributes.regionName = String(region?.name ?? '');
  }
  if (resource === 'airports') {
    const airportCountry = city?.country as Record<string, unknown> | undefined;
    const airportRegion = city?.region as Record<string, unknown> | undefined;
    attributes.cityName = String(city?.name ?? '');
    attributes.countryId = String(city?.countryId ?? '');
    attributes.countryName = String(airportCountry?.name ?? '');
    attributes.regionId = city?.regionId ? String(city.regionId) : null;
    attributes.regionName = String(airportRegion?.name ?? '');
  }
  if (resource === 'terminals') {
    attributes.airportName = String(airport?.name ?? '');
    attributes.airportIataCode = String(airport?.iataCode ?? '');
  }
  if (resource === 'banks') {
    attributes.countryName = String(country?.name ?? '');
    attributes.branchCount = Number(count?.branches ?? 0);
  }
  if (resource === 'bank-branches') {
    attributes.bankName = String(bank?.name ?? '');
    attributes.cityName = String(city?.name ?? '');
  }
  if (resource === 'suppliers' || resource === 'brokers') {
    attributes.organizationName = String(organization?.displayName ?? '');
    attributes.organizationCode = String(organization?.code ?? '');
    attributes.countryName = String(country?.name ?? '');
    attributes.cityName = String(city?.name ?? '');
    attributes.serviceCodes =
      services?.map(({ service }) => String(service.code ?? '')).join(',') ??
      '';
    attributes.serviceNames =
      services?.map(({ service }) => String(service.name ?? '')).join(',') ??
      '';
  }
  if (resource === 'travel-services') {
    attributes.supplierCount = Number(count?.suppliers ?? 0);
    attributes.brokerCount = Number(count?.brokers ?? 0);
  }
  if (resource === 'organization-contacts') {
    attributes.organizationName = String(organization?.displayName ?? '');
    attributes.organizationCode = String(organization?.code ?? '');
  }
  if (
    resource === 'airlines' ||
    resource === 'rail-companies' ||
    resource === 'bus-companies'
  ) {
    attributes.organizationName = String(organization?.displayName ?? '');
    attributes.countryName = String(country?.name ?? '');
  }
  if (resource === 'baggage-rules') {
    attributes.airlineName = String(airline?.name ?? '');
    attributes.airlineCode = String(airline?.code ?? '');
    attributes.cabinClassName = String(cabinClass?.name ?? '');
    attributes.bookingCode = String(cabinClass?.bookingCode ?? '');
  }
  if (resource === 'manifest-templates') {
    attributes.airlineName = String(airline?.name ?? '');
    attributes.airlineCode = String(airline?.code ?? '');
  }
  if (resource === 'hotels') {
    const hotelCountry = city?.country as Record<string, unknown> | undefined;
    const hotelRegion = city?.region as Record<string, unknown> | undefined;
    const relatedMeals =
      mealServiceLinks?.map(({ mealService: value }) => value) ??
      (mealService ? [mealService] : []);
    const relatedRooms =
      roomTypeLinks?.map(({ roomType }) => roomType) ??
      (defaultRoomType ? [defaultRoomType] : []);
    attributes.cityName = String(city?.name ?? '');
    attributes.countryId = String(city?.countryId ?? '');
    attributes.countryName = String(hotelCountry?.name ?? '');
    attributes.regionName = String(hotelRegion?.name ?? '');
    attributes.chainName = String(chain?.name ?? '');
    attributes.organizationName = String(organization?.displayName ?? '');
    attributes.facilityIds =
      facilityLinks
        ?.map(({ facility }) => String(facility.id ?? ''))
        .join(',') ?? '';
    attributes.facilityCodes =
      facilityLinks
        ?.map(({ facility }) => String(facility.code ?? ''))
        .join(',') ?? '';
    attributes.facilityNames =
      facilityLinks
        ?.map(({ facility }) => String(facility.name ?? ''))
        .join(',') ?? '';
    attributes.mealServiceIds = relatedMeals
      .map((value) => String(value.id ?? ''))
      .join(',');
    attributes.mealServiceCodes = relatedMeals
      .map((value) => String(value.code ?? ''))
      .join(',');
    attributes.mealServiceNames = relatedMeals
      .map((value) => String(value.name ?? ''))
      .join(',');
    attributes.roomTypeIds = relatedRooms
      .map((value) => String(value.id ?? ''))
      .join(',');
    attributes.roomTypeCodes = relatedRooms
      .map((value) => String(value.code ?? ''))
      .join(',');
    attributes.roomTypeNames = relatedRooms
      .map((value) => String(value.name ?? ''))
      .join(',');
  }
  if (resource === 'hotel-chains') {
    attributes.countryName = String(country?.name ?? '');
    attributes.hotelCount = Number(count?.hotels ?? 0);
  }
  if (resource === 'room-types' || resource === 'meal-services')
    attributes.hotelCount = Number(count?.hotelLinks ?? 0);
  if (resource === 'facilities')
    attributes.hotelCount = Number(count?.hotels ?? 0);
  if (resource === 'composite-hotels') {
    const compositeCountry = city?.country as
      Record<string, unknown> | undefined;
    attributes.cityName = String(city?.name ?? '');
    attributes.countryId = String(city?.countryId ?? '');
    attributes.countryName = String(compositeCountry?.name ?? '');
    attributes.memberHotelIds =
      compositeMembers?.map(({ hotel }) => String(hotel.id ?? '')).join(',') ??
      '';
    attributes.memberHotelNames =
      compositeMembers
        ?.map(({ hotel }) => String(hotel.name ?? ''))
        .join(',') ?? '';
    attributes.memberHotelCodes =
      compositeMembers
        ?.map(({ hotel }) => String(hotel.code ?? ''))
        .join(',') ?? '';
    attributes.memberCityNames =
      compositeMembers
        ?.map(({ hotel }) => {
          const memberCity = hotel.city as Record<string, unknown> | undefined;
          return String(memberCity?.name ?? '');
        })
        .join(',') ?? '';
    attributes.memberPriorities =
      compositeMembers?.map(({ priority }) => priority).join(',') ?? '';
    attributes.backupMemberIds =
      compositeMembers
        ?.filter(({ isBackup }) => isBackup)
        .map(({ hotel }) => String(hotel.id ?? ''))
        .join(',') ?? '';
    attributes.memberCount = compositeMembers?.length ?? 0;
  }
  return {
    id: row.id,
    resource,
    code,
    name,
    status: row.isActive ? 'active' : 'inactive',
    attributes,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class MasterDataRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async list(resource: MasterDataResource, query: MasterDataListQuery) {
    const model = delegate(this.database.client, resource);
    const nameField = nameFields[resource];
    const where: Record<string, unknown> = {};
    if (query.status !== 'all') where.isActive = query.status === 'active';
    const airportCityWhere: Record<string, unknown> = {};
    if (query.countryId) {
      if (resource === 'regions' || resource === 'cities')
        where.countryId = query.countryId;
      if (resource === 'airports') airportCityWhere.countryId = query.countryId;
      if (resource === 'suppliers' || resource === 'brokers')
        where.countryId = query.countryId;
      if (
        resource === 'airlines' ||
        resource === 'rail-companies' ||
        resource === 'bus-companies'
      )
        where.countryId = query.countryId;
      if (resource === 'hotel-chains') where.countryId = query.countryId;
      if (resource === 'hotels' || resource === 'composite-hotels')
        where.city = { is: { countryId: query.countryId } };
    }
    if (query.regionId) {
      if (resource === 'cities') where.regionId = query.regionId;
      if (resource === 'airports') airportCityWhere.regionId = query.regionId;
    }
    if (resource === 'airports') {
      if (query.cityId) where.cityId = query.cityId;
      if (Object.keys(airportCityWhere).length)
        where.city = { is: airportCityWhere };
    }
    if (resource === 'terminals') {
      if (query.airportId) where.airportId = query.airportId;
      if (query.terminalType) where.terminalType = query.terminalType;
    }
    if (resource === 'bank-branches') {
      if (query.bankId) where.bankId = query.bankId;
      if (query.cityId) where.cityId = query.cityId;
    }
    if (resource === 'payment-methods') {
      if (query.paymentChannel) where.channel = query.paymentChannel;
      if (query.paymentDirection) where.direction = query.paymentDirection;
    }
    if (resource === 'hotels') {
      if (query.cityId) where.cityId = query.cityId;
      if (query.chainId) where.chainId = query.chainId;
      if (query.starRating) where.starRating = query.starRating;
      if (query.saleableOnly) where.isSaleableReference = true;
    }
    if (resource === 'composite-hotels') {
      if (query.cityId) where.cityId = query.cityId;
      if (query.saleableOnly) where.isSaleableReference = true;
    }
    if (resource === 'meal-services' && query.mealServiceCategory)
      where.category = query.mealServiceCategory;
    if (resource === 'room-types' && query.referenceCapacity)
      where.referenceCapacity = query.referenceCapacity;
    if (resource === 'facilities' && query.facilityCategory)
      where.category = query.facilityCategory;
    if (resource === 'suppliers' || resource === 'brokers') {
      if (query.cityId) where.cityId = query.cityId;
      if (query.organizationId) where.organizationId = query.organizationId;
      if (query.serviceId)
        where.services = { some: { serviceId: query.serviceId } };
      if (query.collaborationStatus)
        where.collaborationStatus = query.collaborationStatus;
    }
    if (resource === 'suppliers' && query.providerConnected !== undefined)
      where.externalProviderReference = query.providerConnected
        ? { not: null }
        : null;
    if (resource === 'organization-contacts') {
      if (query.organizationId) where.organizationId = query.organizationId;
      if (query.hasWhatsapp !== undefined)
        where.hasWhatsapp = query.hasWhatsapp;
      if (query.contactCompleteness === 'complete')
        where.AND = [
          { phoneMasked: { not: null } },
          { emailMasked: { not: null } },
        ];
      if (query.contactCompleteness === 'incomplete')
        where.AND = [{ OR: [{ phoneMasked: null }, { emailMasked: null }] }];
    }
    if (query.search) {
      const direct = searchFields[resource].map((field) => ({
        [field]: { contains: query.search, mode: 'insensitive' },
      }));
      if (resource === 'suppliers' || resource === 'brokers')
        direct.push({
          organization: {
            is: {
              OR: [
                {
                  displayName: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
                {
                  legalName: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              ],
            },
          },
        } as never);
      if (resource === 'organization-contacts')
        direct.push({
          organization: {
            is: {
              displayName: { contains: query.search, mode: 'insensitive' },
            },
          },
        } as never);
      where.OR = direct;
    }
    const sortField =
      query.sortBy === 'name'
        ? nameField
        : query.sortBy === 'code'
          ? codeFields[resource]
          : query.sortBy;
    const orderBy =
      query.sortBy === 'name' && resource === 'suppliers'
        ? { organization: { displayName: query.sortDirection } }
        : { [sortField]: query.sortDirection };
    const args: Record<string, unknown> = {
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    };
    const include = relations(resource);
    if (include) args.include = include;
    const [rows, total] = await Promise.all([
      model.findMany(args),
      model.count({ where }),
    ]);
    return { rows, total };
  }

  async find(resource: MasterDataResource, id: string) {
    const args: Record<string, unknown> = { where: { id } };
    const include = relations(resource);
    if (include) args.include = include;
    return delegate(this.database.client, resource).findUnique(args);
  }

  async codeExists(resource: MasterDataResource, code: string) {
    if (resource === 'exchange-rates') return false;
    return Boolean(
      await delegate(this.database.client, resource).findFirst({
        where: { [codeFields[resource]]: code },
      }),
    );
  }

  async fieldExists(
    resource: MasterDataResource,
    field: string,
    value: string,
    excludeId?: string,
  ) {
    return Boolean(
      await delegate(this.database.client, resource).findFirst({
        where: {
          [field]: value,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
      }),
    );
  }

  async bankBranchCodeExists(bankId: string, code: string, excludeId?: string) {
    return Boolean(
      await this.database.client.masterBankBranch.findFirst({
        where: {
          bankId,
          code,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
      }),
    );
  }

  async create(
    resource: MasterDataResource,
    data: Record<string, unknown>,
    actorUserId: string,
    actorBranchId: string,
  ) {
    return this.database.client.$transaction(async (transaction) => {
      const row = await delegate(transaction, resource).create({
        data: {
          ...data,
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId,
        },
        ...(relations(resource) ? { include: relations(resource) } : {}),
      });
      await transaction.masterDataAuditEvent.create({
        data: {
          actorUserId,
          actorBranchId,
          action: 'master_data.create',
          resource,
          entityId: row.id,
          outcome: AuditOutcome.SUCCESS,
          afterSnapshot: auditSnapshot(resource, row),
        },
      });
      return row;
    });
  }

  async update(
    resource: MasterDataResource,
    id: string,
    data: Record<string, unknown>,
    expectedVersion: number,
    actorUserId: string,
    actorBranchId: string,
  ) {
    return this.database.client.$transaction(async (transaction) => {
      const model = delegate(transaction, resource);
      const before = await model.findUnique({ where: { id } });
      if (!before || before.version !== expectedVersion) return null;
      const claimed = await model.updateMany({
        where: { id, version: expectedVersion },
        data: { updatedByUserId: actorUserId, version: { increment: 1 } },
      });
      if (claimed.count !== 1) return null;

      const row = await model.update({
        where: { id },
        data: {
          ...data,
        },
        ...(relations(resource) ? { include: relations(resource) } : {}),
      });
      await transaction.masterDataAuditEvent.create({
        data: {
          actorUserId,
          actorBranchId,
          action: 'master_data.update',
          resource,
          entityId: id,
          outcome: AuditOutcome.SUCCESS,
          beforeSnapshot: auditSnapshot(resource, before),
          afterSnapshot: auditSnapshot(resource, row),
        },
      });
      return row;
    });
  }

  async setStatus(
    resource: MasterDataResource,
    id: string,
    isActive: boolean,
    expectedVersion: number,
    actorUserId: string,
    actorBranchId: string,
  ) {
    const now = new Date();
    return this.update(
      resource,
      id,
      {
        isActive,
        deactivatedAt: isActive ? null : now,
        deactivatedByUserId: isActive ? null : actorUserId,
      },
      expectedVersion,
      actorUserId,
      actorBranchId,
    );
  }

  async createExport(data: {
    resource: MasterDataResource;
    format: 'XLSX' | 'PDF';
    filterSnapshot: Record<string, unknown>;
    columns: string[];
    permissionSnapshot: string[];
    actorUserId: string;
    actorBranchId: string;
    locale: string;
    timezone: string;
    status?: 'COMPLETED';
  }) {
    return this.database.client.$transaction(async (transaction) => {
      const { status, ...payload } = data;
      const request = await transaction.masterDataExportRequest.create({
        data: {
          ...payload,
          filterSnapshot: json(data.filterSnapshot),
          ...(status ? { status } : {}),
        },
      });
      await transaction.masterDataAuditEvent.create({
        data: {
          actorUserId: data.actorUserId,
          actorBranchId: data.actorBranchId,
          action:
            request.status === 'COMPLETED'
              ? 'master_data.export.downloaded'
              : 'master_data.export.requested',
          resource: data.resource,
          entityId: request.id,
          outcome: AuditOutcome.SUCCESS,
          afterSnapshot: json({
            format: data.format,
            filters: data.filterSnapshot,
            columns: data.columns,
            status: request.status,
          }),
        },
      });
      return request;
    });
  }

  findExport(id: string, actorUserId: string) {
    return this.database.client.masterDataExportRequest.findFirst({
      where: { id, actorUserId },
    });
  }

  async recordSensitiveContactRead(input: {
    contactId: string;
    actorUserId: string;
    actorBranchId: string;
  }) {
    await this.database.client.masterDataAuditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        actorBranchId: input.actorBranchId,
        action: 'master_data.organization_contact.unmask',
        resource: 'organization-contacts',
        entityId: input.contactId,
        outcome: AuditOutcome.SUCCESS,
        afterSnapshot: { disclosure: 'SENSITIVE_CONTACT_UNMASKED' },
      },
    });
  }

  async organizationSupplierSummary() {
    const client = this.database.client;
    const [
      supplierTotal,
      supplierActive,
      supplierProviderConnected,
      brokerTotal,
      brokerActive,
      brokerCities,
      brokerIncomplete,
      contactTotal,
      contactActive,
      contactWhatsapp,
      contactIncomplete,
      supplierCollaboration,
      brokerCollaboration,
    ] = await Promise.all([
      client.masterSupplier.count(),
      client.masterSupplier.count({
        where: { isActive: true, collaborationStatus: 'ACTIVE' },
      }),
      client.masterSupplier.count({
        where: { externalProviderReference: { not: null } },
      }),
      client.masterBroker.count(),
      client.masterBroker.count({ where: { isActive: true } }),
      client.masterBroker.findMany({
        where: { cityId: { not: null } },
        distinct: ['cityId'],
        select: { cityId: true },
      }),
      client.masterBroker.count({
        where: { OR: [{ countryId: null }, { cityId: null }] },
      }),
      client.masterOrganizationContact.count(),
      client.masterOrganizationContact.count({ where: { isActive: true } }),
      client.masterOrganizationContact.count({ where: { hasWhatsapp: true } }),
      client.masterOrganizationContact.count({
        where: { OR: [{ phoneMasked: null }, { emailMasked: null }] },
      }),
      client.masterSupplier.groupBy({
        by: ['collaborationStatus'],
        _count: { _all: true },
      }),
      client.masterBroker.groupBy({
        by: ['collaborationStatus'],
        _count: { _all: true },
      }),
    ]);
    const collaboration = {
      ACTIVE: 0,
      UNDER_REVIEW: 0,
      PURCHASE_SUSPENDED: 0,
      ENDED: 0,
    };
    for (const entry of [...supplierCollaboration, ...brokerCollaboration])
      collaboration[entry.collaborationStatus] += entry._count._all;
    return {
      suppliers: {
        total: supplierTotal,
        activeCollaboration: supplierActive,
        contracted: null,
        providerConnected: supplierProviderConnected,
      },
      brokers: {
        total: brokerTotal,
        active: brokerActive,
        coveredCities: brokerCities.length,
        incomplete: brokerIncomplete,
      },
      contacts: {
        total: contactTotal,
        active: contactActive,
        whatsapp: contactWhatsapp,
        incomplete: contactIncomplete,
      },
      collaboration,
    };
  }

  async accommodationSummary() {
    const client = this.database.client;
    const [
      hotelTotal,
      hotelSaleable,
      hotelLocations,
      hotelIncomplete,
      chainTotal,
      chainActive,
      chainMemberHotels,
      chainIncomplete,
      roomTotal,
      roomActive,
      roomStandardCapacity,
      roomPendingApproval,
      mealTotal,
      mealActive,
      mealPlans,
      mealNeedsReview,
      facilityTotal,
      facilityActive,
      facilityCategories,
      facilityMissingIcon,
      compositeTotal,
      compositeActive,
      compositeMembers,
      compositeNeedsReview,
    ] = await Promise.all([
      client.masterHotel.count(),
      client.masterHotel.count({
        where: { isActive: true, isSaleableReference: true },
      }),
      client.masterHotel.findMany({
        distinct: ['cityId'],
        select: { cityId: true, city: { select: { countryId: true } } },
      }),
      client.masterHotel.count({
        where: {
          OR: [{ englishName: null }, { address: null }, { starRating: null }],
        },
      }),
      client.masterHotelChain.count(),
      client.masterHotelChain.count({ where: { isActive: true } }),
      client.masterHotel.count({ where: { chainId: { not: null } } }),
      client.masterHotelChain.count({
        where: { OR: [{ englishName: null }, { website: null }] },
      }),
      client.masterRoomType.count(),
      client.masterRoomType.count({ where: { isActive: true } }),
      client.masterRoomType.count({
        where: { referenceCapacity: { not: null } },
      }),
      client.masterRoomType.count({ where: { referenceCapacity: null } }),
      client.masterMealService.count(),
      client.masterMealService.count({ where: { isActive: true } }),
      client.masterMealService.count({ where: { category: 'MEAL_PLAN' } }),
      client.masterMealService.count({
        where: { OR: [{ englishName: null }, { isActive: false }] },
      }),
      client.masterFacility.count(),
      client.masterFacility.count({ where: { isActive: true } }),
      client.masterFacility.findMany({
        where: { category: { not: null } },
        distinct: ['category'],
        select: { category: true },
      }),
      client.masterFacility.count({ where: { iconFileReference: null } }),
      client.masterCompositeHotel.count(),
      client.masterCompositeHotel.count({ where: { isActive: true } }),
      client.masterCompositeHotelMember.findMany({
        distinct: ['hotelId'],
        select: { hotelId: true },
      }),
      client.masterCompositeHotel.count({
        where: { OR: [{ isActive: false }, { members: { none: {} } }] },
      }),
    ]);
    return {
      hotels: {
        total: hotelTotal,
        saleable: hotelSaleable,
        countries: new Set(hotelLocations.map(({ city }) => city.countryId))
          .size,
        cities: hotelLocations.length,
        incomplete: hotelIncomplete,
      },
      chains: {
        total: chainTotal,
        active: chainActive,
        memberHotels: chainMemberHotels,
        incomplete: chainIncomplete,
      },
      roomTypes: {
        total: roomTotal,
        active: roomActive,
        standardCapacity: roomStandardCapacity,
        pendingDomainApproval: roomPendingApproval,
      },
      mealServices: {
        total: mealTotal,
        active: mealActive,
        mealPlans,
        needsReview: mealNeedsReview,
      },
      facilities: {
        total: facilityTotal,
        active: facilityActive,
        categories: facilityCategories.length,
        missingIcon: facilityMissingIcon,
      },
      compositeHotels: {
        total: compositeTotal,
        active: compositeActive,
        uniqueMemberHotels: compositeMembers.length,
        needsReview: compositeNeedsReview,
      },
    };
  }
}
