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
} from '@rubi/contracts';

import { assertGenericCurrencyRateMutationAllowed } from './currency-rate.policy';
import { buildMasterDataXlsx, MASTER_DATA_XLSX_MIME } from './master-data.xlsx';
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
  'TOUR_OPERATOR',
  'BROKER',
]);

const autoCodeAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const compactCodeRules: Partial<
  Record<MasterDataResource, { alphabet: string; length: number }>
> = {
  currencies: { alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', length: 3 },
  airlines: { alphabet: autoCodeAlphabet, length: 2 },
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
  airlines: 'AIR',
  hotels: 'HOTEL',
  organizations: 'ORG',
  brokers: 'BROKER',
  leaders: 'LEADER',
  'acquaintance-methods': 'ACQ',
};

function autoCodeSource(
  values: Record<string, string | number | readonly string[] | null>,
): string {
  for (const field of ['displayName', 'name', 'legalName', 'englishName']) {
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
  insurers: ['code', 'name', 'organizationId'],
  airlines: ['code', 'name', 'icaoCode', 'organizationId'],
  hotels: ['code', 'name', 'cityId', 'organizationId', 'starRating'],
  organizations: ['code', 'legalName', 'displayName', 'roleCodes'],
  brokers: ['code', 'name', 'organizationId'],
  leaders: ['code', 'name', 'languages', 'expertise'],
  'acquaintance-methods': ['code', 'name', 'description'],
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
  currencies: ['code', 'name', 'englishName', 'displayPolicy'],
  'exchange-rates': [
    'fromCurrencyCode',
    'toCurrencyCode',
    'rate',
    'source',
    'observedAt',
  ],
  banks: ['code', 'name', 'englishName', 'countryId'],
  'bank-branches': ['code', 'name', 'bankId', 'cityId'],
  'payment-methods': ['code', 'name', 'channel', 'direction'],
  insurers: ['name', 'organizationId'],
  airlines: ['name', 'organizationId'],
  hotels: ['name', 'cityId'],
  organizations: ['legalName', 'displayName', 'roleCodes'],
  brokers: ['name', 'organizationId'],
  leaders: ['name', 'languages'],
  'acquaintance-methods': ['name'],
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
    'terminalType',
    'paymentChannel',
    'paymentDirection',
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
    page: 1,
    pageSize: 100,
  };
}

@Injectable()
export class MasterDataService {
  constructor(
    @Inject(MasterDataRepository)
    private readonly repository: MasterDataRepository,
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
      resource !== 'payment-methods';
    if (usesGeneratedCode) {
      if (partial && Object.hasOwn(values, 'code'))
        throw new BadRequestException(
          'کد داخلی به‌صورت خودکار تولید می‌شود و قابل ویرایش نیست.',
        );
      if (!partial) data.code = await this.generateAutoCode(resource, values);
    }
    if (
      usesGeneratedCode &&
      typeof data.code === 'string' &&
      !codePattern.test(data.code)
    )
      throw new BadRequestException('کد داخلی تولیدشده معتبر نیست.');
    if (
      ['currencies', 'banks', 'bank-branches', 'payment-methods'].includes(
        resource,
      ) &&
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
    if (resource === 'airlines' && typeof data.icaoCode === 'string') {
      const icaoCode = data.icaoCode.trim().toUpperCase();
      if (icaoCode.length !== 3)
        throw new BadRequestException('کد ICAO باید سه حرف باشد.');
      data.icaoCode = icaoCode;
    }
    for (const optionalReference of ['regionId', 'parentRegionId']) {
      if (data[optionalReference] === '') data[optionalReference] = null;
    }

    for (const field of [
      'countryId',
      'organizationId',
      'cityId',
      'regionId',
      'parentRegionId',
      'airportId',
      'bankId',
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
    if (
      resource === 'hotels' &&
      data.starRating !== undefined &&
      data.starRating !== null
    ) {
      const rating = Number(data.starRating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5)
        throw new BadRequestException(
          'درجه هتل باید عدد صحیح بین ۱ تا ۵ باشد.',
        );
      data.starRating = rating;
    }
    if (resource === 'leaders' && typeof data.languages === 'string')
      data.languages = data.languages
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    if (resource === 'organizations') {
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
      insurers: {
        field: 'organizationId',
        target: 'organizations',
        role: 'INSURANCE_PROVIDER',
      },
      airlines: {
        field: 'organizationId',
        target: 'organizations',
        role: 'AIRLINE',
      },
      brokers: {
        field: 'organizationId',
        target: 'organizations',
        role: 'BROKER',
      },
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
