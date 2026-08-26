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
  countries: { alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', length: 2 },
  currencies: { alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', length: 3 },
  airlines: { alphabet: autoCodeAlphabet, length: 2 },
};
const resourceCodePrefixes: Record<MasterDataResource, string> = {
  countries: 'CNT',
  cities: 'CITY',
  currencies: 'CUR',
  'exchange-rates': 'RATE',
  banks: 'BANK',
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

const allowedFields: Record<MasterDataResource, readonly string[]> = {
  countries: ['code', 'name', 'englishName'],
  cities: ['code', 'name', 'countryId'],
  currencies: ['code', 'name', 'englishName', 'symbol', 'decimalDigits'],
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
  banks: ['code', 'name', 'countryId'],
  insurers: ['code', 'name', 'organizationId'],
  airlines: ['code', 'name', 'icaoCode', 'organizationId'],
  hotels: ['code', 'name', 'cityId', 'organizationId', 'starRating'],
  organizations: ['code', 'legalName', 'displayName', 'roleCodes'],
  brokers: ['code', 'name', 'organizationId'],
  leaders: ['code', 'name', 'languages', 'expertise'],
  'acquaintance-methods': ['code', 'name', 'description'],
};

const requiredFields: Record<MasterDataResource, readonly string[]> = {
  countries: ['name', 'englishName'],
  cities: ['name', 'countryId'],
  currencies: ['name'],
  'exchange-rates': [
    'fromCurrencyCode',
    'toCurrencyCode',
    'rate',
    'source',
    'observedAt',
  ],
  banks: ['name', 'countryId'],
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
    const data = await this.prepare(resource, values, actor.userId, true);
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
    const filterKeys = Object.keys(input.filters);
    const resource = resourceOf(input.resource);
    const allowedFilterKeys = ['search', 'status', 'sortBy', 'sortDirection'];
    if (filterKeys.some((key) => !allowedFilterKeys.includes(key)))
      throw new BadRequestException('فیلتر خروجی خارج از allowlist است.');
    if (
      input.filters.status !== undefined &&
      !['all', 'active', 'inactive'].includes(String(input.filters.status))
    )
      throw new BadRequestException('وضعیت فیلتر خروجی معتبر نیست.');
    const allowedColumns = new Set([
      ...allowedFields[resource],
      'code',
      'name',
      'status',
      'updatedAt',
    ]);
    if (input.columns.some((column) => !allowedColumns.has(column)))
      throw new BadRequestException('ستون خروجی خارج از allowlist است.');
    if (input.columns.length < 1 || input.columns.length > 30)
      throw new BadRequestException('بین ۱ تا ۳۰ ستون خروجی لازم است.');
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
    if (resource !== 'exchange-rates') {
      if (partial && Object.hasOwn(values, 'code'))
        throw new BadRequestException(
          'کد داخلی به‌صورت خودکار تولید می‌شود و قابل ویرایش نیست.',
        );
      if (!partial) data.code = await this.generateAutoCode(resource, values);
    }
    if (typeof data.code === 'string' && !codePattern.test(data.code))
      throw new BadRequestException('کد داخلی تولیدشده معتبر نیست.');
    if (resource === 'airlines' && typeof data.icaoCode === 'string') {
      const icaoCode = data.icaoCode.trim().toUpperCase();
      if (icaoCode.length !== 3)
        throw new BadRequestException('کد ICAO باید سه حرف باشد.');
      data.icaoCode = icaoCode;
    }
    for (const field of ['countryId', 'organizationId', 'cityId']) {
      if (
        typeof data[field] === 'string' &&
        !uuidPattern.test(data[field] as string)
      )
        throw new BadRequestException(`${field} باید UUID معتبر باشد.`);
    }
    if (resource === 'currencies' && data.decimalDigits !== undefined) {
      const digits = Number(data.decimalDigits);
      if (!Number.isInteger(digits) || digits < 0 || digits > 6)
        throw new BadRequestException(
          'دقت ارز باید عدد صحیح بین صفر تا شش باشد.',
        );
      data.decimalDigits = digits;
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
      banks: { field: 'countryId', target: 'countries' },
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
