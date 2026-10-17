import { BadRequestException, ConflictException } from '@nestjs/common';
import type {
  IntegrationCatalogueConfigV1,
  IntegrationLifecycle,
  IntegrationRegistryWriteV1,
} from '@nora/contracts';

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const code = /^[a-z][a-z0-9._-]{1,63}$/;
const unsafe =
  /https?:\/\/|(?:password|secret|token|authorization|bearer)\s*[:= ]|-----BEGIN/i;

function record(value: unknown, keys: readonly string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('ساختار اطلاعات معتبر نیست.');
  const object = value as Record<string, unknown>;
  if (Object.keys(object).some((key) => !keys.includes(key)))
    throw new BadRequestException(
      'فیلد ناشناخته یا اطلاعات اتصال در این مرحله مجاز نیست.',
    );
  return object;
}

function text(value: unknown, label: string, pattern?: RegExp) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > 120 ||
    unsafe.test(value) ||
    Array.from(value).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    (pattern && !pattern.test(value))
  )
    throw new BadRequestException(`${label} معتبر نیست.`);
  return value.trim();
}

function lifecycle(value: unknown): IntegrationLifecycle {
  if (
    typeof value !== 'string' ||
    !['ENABLED', 'DISABLED', 'ARCHIVED'].includes(value)
  )
    throw new BadRequestException('وضعیت فهرست معتبر نیست.');
  return value as IntegrationLifecycle;
}

function list(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum)
    throw new BadRequestException(
      'تعداد ردیف‌ها بیش از حد مجاز یا نامعتبر است.',
    );
  return value;
}

function unique(values: readonly string[]) {
  if (new Set(values).size !== values.length)
    throw new BadRequestException('شناسه یا کد تکراری مجاز نیست.');
}

export function validateIntegrationCatalogue(
  value: unknown,
): IntegrationCatalogueConfigV1 {
  const input = record(value, [
    'schemaVersion',
    'brands',
    'systems',
    'capabilities',
  ]);
  if (input.schemaVersion !== 1)
    throw new BadRequestException('نسخه ساختار پشتیبانی نمی‌شود.');
  const brands = list(input.brands, 100).map((value) => {
    const row = record(value, ['id', 'code', 'name', 'lifecycle']);
    return {
      id: text(row.id, 'شناسه برند', uuid).toLowerCase(),
      code: text(row.code, 'کد برند', code),
      name: text(row.name, 'نام برند'),
      lifecycle: lifecycle(row.lifecycle),
    };
  });
  const capabilities = list(input.capabilities, 50).map((value) => {
    const row = record(value, ['code', 'name', 'lifecycle']);
    return {
      code: text(row.code, 'کد قابلیت', code),
      name: text(row.name, 'نام قابلیت'),
      lifecycle: lifecycle(row.lifecycle),
    };
  });
  const systems = list(input.systems, 200).map((value) => {
    const row = record(value, [
      'id',
      'code',
      'name',
      'brandId',
      'kind',
      'businessDomain',
      'lifecycle',
      'capabilityCodes',
    ]);
    const capabilityCodes = list(row.capabilityCodes, 50).map((value) =>
      text(value, 'کد قابلیت', code),
    );
    unique(capabilityCodes);
    if (
      typeof row.businessDomain !== 'string' ||
      !['TRAVEL', 'EDUCATION', 'OTHER'].includes(row.businessDomain)
    )
      throw new BadRequestException('حوزه فعالیت معتبر نیست.');
    const brandId = text(row.brandId, 'شناسه برند', uuid).toLowerCase();
    if (
      !brands.some((brand) => brand.id === brandId) ||
      capabilityCodes.some(
        (code) => !capabilities.some((capability) => capability.code === code),
      )
    )
      throw new BadRequestException(
        'برند یا قابلیت سامانه در همین فهرست وجود ندارد.',
      );
    return {
      id: text(row.id, 'شناسه سامانه', uuid).toLowerCase(),
      code: text(row.code, 'کد سامانه', code),
      name: text(row.name, 'نام سامانه'),
      brandId,
      kind: text(row.kind, 'نوع سامانه'),
      businessDomain: row.businessDomain as 'TRAVEL' | 'EDUCATION' | 'OTHER',
      lifecycle: lifecycle(row.lifecycle),
      capabilityCodes,
    };
  });
  unique(brands.map((row) => row.id));
  unique(brands.map((row) => row.code));
  unique(systems.map((row) => row.id));
  unique(systems.map((row) => row.code));
  unique(capabilities.map((row) => row.code));
  return { schemaVersion: 1, brands, systems, capabilities };
}

export function validateIntegrationWrite(
  value: unknown,
): IntegrationRegistryWriteV1 {
  const input = record(value, [
    'schemaVersion',
    'brands',
    'systems',
    'capabilities',
    'expectedVersion',
    'reason',
  ]);
  if (
    !Number.isSafeInteger(input.expectedVersion) ||
    Number(input.expectedVersion) < 0
  )
    throw new BadRequestException('نسخه مورد انتظار معتبر نیست.');
  const reason = text(input.reason, 'دلیل تغییر');
  if (reason.length < 5)
    throw new BadRequestException('دلیل تغییر باید حداقل ۵ نویسه باشد.');
  return {
    ...validateIntegrationCatalogue({
      schemaVersion: input.schemaVersion,
      brands: input.brands,
      systems: input.systems,
      capabilities: input.capabilities,
    }),
    expectedVersion: Number(input.expectedVersion),
    reason,
  };
}

export function retainIntegrationIdentities(
  current: IntegrationCatalogueConfigV1,
  next: IntegrationCatalogueConfigV1,
) {
  for (const key of ['brands', 'systems'] as const) {
    if (
      current[key].some(
        (previous) =>
          !next[key].some(
            (row) => row.id === previous.id && row.code === previous.code,
          ),
      )
    )
      throw new ConflictException(
        'حذف یا تغییر هویت سابق مجاز نیست؛ غیرفعال یا آرشیو کنید.',
      );
  }
  if (
    current.capabilities.some(
      (row) => !next.capabilities.some((nextRow) => nextRow.code === row.code),
    )
  )
    throw new ConflictException('قابلیت سابق باید با حفظ کد آرشیو شود.');
}

export function integrationBranchId(value: unknown) {
  return text(value, 'شناسه شعبه', uuid).toLowerCase();
}

/** Configuration may also be written through the owner's administrative API. */
export function safeIntegrationReason(value: unknown): string {
  try {
    return text(value, 'دلیل تغییر');
  } catch {
    return 'تغییر تنظیمات فهرست';
  }
}
