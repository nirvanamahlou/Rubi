import { BadRequestException } from '@nestjs/common';
import type {
  SystemScope,
  SystemSettingWriteV1,
  SystemValueType,
} from '@nora/contracts';

const identifierPattern = /^[a-z][a-z0-9._-]{1,119}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sensitiveKeyPattern =
  /(password|passphrase|token|secret|cookie|authorization|cvv|card.?number|private.?key)/i;

export function validReason(value: unknown): string {
  if (typeof value !== 'string')
    throw new BadRequestException('دلیل تغییر الزامی است.');
  const reason = value.trim();
  if (reason.length < 5 || reason.length > 1000)
    throw new BadRequestException('دلیل تغییر باید بین ۵ تا ۱۰۰۰ نویسه باشد.');
  return reason;
}

export function validIdentifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || !identifierPattern.test(value.trim()))
    throw new BadRequestException(`${label} معتبر نیست.`);
  return value.trim();
}

export function validUuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !uuidPattern.test(value))
    throw new BadRequestException(`${label} معتبر نیست.`);
  return value;
}

export function scopeKey(scope: SystemScope, scopeId?: string | null): string {
  if (scope === 'GLOBAL') {
    if (scopeId) throw new BadRequestException('Scope سراسری شناسه ندارد.');
    return 'GLOBAL';
  }
  const id = validUuid(scopeId, 'شناسه Scope');
  return `${scope}:${id}`;
}

export function assertSafeJson(value: unknown, path = 'value'): void {
  if (value === undefined)
    throw new BadRequestException('مقدار تنظیم مشخص نشده است.');
  if (typeof value === 'number' && !Number.isFinite(value))
    throw new BadRequestException('عدد تنظیم معتبر نیست.');
  if (typeof value === 'string' && value.length > 20_000)
    throw new BadRequestException('مقدار تنظیم بیش از حد مجاز است.');
  if (Array.isArray(value)) {
    if (value.length > 500)
      throw new BadRequestException('آرایه تنظیم بیش از حد مجاز است.');
    value.forEach((item, index) => assertSafeJson(item, `${path}.${index}`));
    return;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length > 500)
      throw new BadRequestException('ساختار تنظیم بیش از حد مجاز است.');
    for (const [key, item] of entries) {
      if (sensitiveKeyPattern.test(key))
        throw new BadRequestException(
          `فیلد حساس ${path}.${key} در تنظیمات عمومی مجاز نیست.`,
        );
      assertSafeJson(item, `${path}.${key}`);
    }
  }
}

export function validateTypedValue(
  valueType: SystemValueType,
  value: unknown,
): void {
  assertSafeJson(value);
  const valid =
    (valueType === 'STRING' && typeof value === 'string') ||
    (valueType === 'NUMBER' &&
      typeof value === 'number' &&
      Number.isFinite(value)) ||
    (valueType === 'BOOLEAN' && typeof value === 'boolean') ||
    (valueType === 'JSON' && typeof value === 'object' && value !== null);
  if (!valid)
    throw new BadRequestException('نوع داده با مقدار تنظیم سازگار نیست.');
}

export function validateSetting(input: SystemSettingWriteV1) {
  const namespace = validIdentifier(input?.namespace, 'Namespace');
  const key = validIdentifier(input?.key, 'Key');
  if (!['STRING', 'NUMBER', 'BOOLEAN', 'JSON'].includes(input?.valueType))
    throw new BadRequestException('نوع داده تنظیم معتبر نیست.');
  if (!['GLOBAL', 'LEGAL_ENTITY', 'BRANCH', 'USER'].includes(input?.scope))
    throw new BadRequestException('Scope تنظیم معتبر نیست.');
  validateTypedValue(input.valueType, input.value);
  if (
    input.expectedVersion !== undefined &&
    (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1)
  )
    throw new BadRequestException('نسخه مورد انتظار معتبر نیست.');
  const status = input.status ?? 'ACTIVE';
  if (!['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(status))
    throw new BadRequestException('وضعیت تنظیم معتبر نیست.');
  return {
    namespace,
    key,
    valueType: input.valueType,
    value: input.value,
    scope: input.scope,
    scopeId: input.scopeId ?? null,
    scopeKey: scopeKey(input.scope, input.scopeId),
    status,
    reason: validReason(input.reason),
    expectedVersion: input.expectedVersion,
  };
}

export function maskIp(value: string | undefined): string | null {
  if (!value) return null;
  const ip = value.trim();
  if (ip.includes(':')) return `${ip.split(':').slice(0, 3).join(':')}:*`;
  const parts = ip.split('.');
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.*.*` : 'masked';
}

export function sanitizeText(value: unknown, max = 1000): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string')
    throw new BadRequestException('مقدار متنی معتبر نیست.');
  const result = value.trim();
  if (result.length > max || sensitiveKeyPattern.test(result))
    throw new BadRequestException(
      'مقدار متنی شامل داده حساس یا بیش از حد مجاز است.',
    );
  return result || null;
}
