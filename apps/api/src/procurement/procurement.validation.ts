import type { ProcurementDraftV1 } from '@nora/contracts';
import { decimal, requireRule } from './domain/procurement.rules';

export function object(
  value: unknown,
  keys?: readonly string[],
): Record<string, unknown> {
  requireRule(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'VALIDATION_ERROR',
    'ساختار ورودی معتبر نیست.',
  );
  const result = value as Record<string, unknown>;
  if (keys)
    requireRule(
      Object.keys(result).every((key) => keys.includes(key)),
      'VALIDATION_ERROR',
      'فیلد ناشناخته در ورودی است.',
    );
  return result;
}
export function text(
  value: unknown,
  field: string,
  max = 1000,
  optional = false,
): string {
  if (optional && (value === undefined || value === null)) return '';
  requireRule(
    typeof value === 'string' &&
      value.length <= max &&
      (optional || value.trim()),
    'VALIDATION_ERROR',
    'متن این فیلد معتبر نیست.',
    field,
  );
  requireRule(
    !Array.from(value).some(
      (char) =>
        char.charCodeAt(0) < 32 && ![9, 10, 13].includes(char.charCodeAt(0)),
    ),
    'VALIDATION_ERROR',
    'کاراکتر کنترلی مجاز نیست.',
    field,
  );
  return value.trim();
}
export function uuid(value: unknown, field = 'id'): string {
  const result = text(value, field, 36);
  requireRule(
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(result),
    'VALIDATION_ERROR',
    'شناسه معتبر نیست.',
    field,
  );
  return result.toLowerCase();
}
export function signedMoney(value: unknown, field = 'delta'): string {
  const result = text(value, field, 26);
  decimal(result.startsWith('-') ? result.slice(1) : result, field);
  return result;
}
export function integer(
  value: unknown,
  field = 'expectedVersion',
  max = 2147483647,
): number {
  requireRule(
    typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= 1 &&
      value <= max,
    'VALIDATION_ERROR',
    'عدد صحیح مثبت لازم است.',
    field,
  );
  return value;
}
export function date(value: unknown, field: string): string {
  const result = text(value, field, 30);
  requireRule(
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(result) &&
      Number.isFinite(Date.parse(result)),
    'VALIDATION_ERROR',
    'زمان UTC معتبر لازم است.',
    field,
  );
  const canonical = new Date(result).toISOString();
  requireRule(
    canonical.slice(0, 19) === result.slice(0, 19),
    'VALIDATION_ERROR',
    'تاریخ نامعتبر است.',
    field,
  );
  return canonical;
}
export function array(value: unknown, field: string, max = 100): unknown[] {
  requireRule(
    Array.isArray(value) && value.length <= max,
    'VALIDATION_ERROR',
    'تعداد اقلام معتبر نیست.',
    field,
  );
  return value;
}
export function money(value: unknown, field = 'amount'): string {
  decimal(value, field);
  return value as string;
}
export function currency(value: unknown): string {
  const result = text(value, 'currencyCode', 3);
  requireRule(
    /^[A-Z]{3}$/.test(result),
    'VALIDATION_ERROR',
    'کد ارز معتبر نیست.',
    'currencyCode',
  );
  return result;
}
export function draft(value: unknown): ProcurementDraftV1 {
  const input = object(value, [
    'title',
    'branchId',
    'unitId',
    'purchaseType',
    'category',
    'needReason',
    'requiredAt',
    'priority',
    'urgent',
    'urgencyReason',
    'estimatedAmount',
    'currencyCode',
    'unknownEstimateReason',
    'deliveryLocation',
    'notes',
    'documents',
    'items',
    'origin',
  ]);
  requireRule(
    input.urgent === undefined || typeof input.urgent === 'boolean',
    'VALIDATION_ERROR',
    'فوریت معتبر نیست.',
  );
  requireRule(
    input.priority === undefined ||
      ['LOW', 'NORMAL', 'HIGH'].includes(String(input.priority)),
    'VALIDATION_ERROR',
    'اولویت معتبر نیست.',
  );
  const origin = object(input.origin ?? { kind: 'GENERAL' });
  requireRule(
    ['GENERAL', 'SPECIALIZED'].includes(String(origin.kind)),
    'VALIDATION_ERROR',
    'مبدأ معتبر نیست.',
  );
  if (origin.kind === 'SPECIALIZED')
    requireRule(
      origin.module === 'RESERVATIONS',
      'VALIDATION_ERROR',
      'ماژول مبدأ معتبر نیست.',
    );
  const items = array(input.items ?? [], 'items').map((value) => {
    const item = object(value, [
      'id',
      'kind',
      'description',
      'specification',
      'quantity',
      'unit',
      'acceptanceCriteria',
      'period',
    ]);
    requireRule(
      ['GOODS', 'SERVICE'].includes(String(item.kind)),
      'VALIDATION_ERROR',
      'نوع قلم معتبر نیست.',
    );
    return {
      id: uuid(item.id),
      kind: item.kind as 'GOODS' | 'SERVICE',
      description: text(item.description, 'description', 2000, true),
      specification: text(item.specification, 'specification', 4000, true),
      quantity:
        item.quantity === '' || item.quantity === undefined
          ? ''
          : money(item.quantity, 'quantity'),
      unit: text(item.unit, 'unit', 80, true),
      acceptanceCriteria: text(
        item.acceptanceCriteria,
        'acceptanceCriteria',
        2000,
        true,
      ),
      period: text(item.period, 'period', 200, true),
    };
  });
  requireRule(
    new Set(items.map((item) => item.id)).size === items.length,
    'DUPLICATE_ITEM',
    'قلم تکراری مجاز نیست.',
  );
  return {
    title: text(input.title, 'title', 300, true),
    branchId: uuid(input.branchId, 'branchId'),
    unitId: input.unitId ? text(input.unitId, 'unitId', 160) : null,
    purchaseType: text(input.purchaseType, 'purchaseType', 80, true),
    category: text(input.category, 'category', 80, true),
    needReason: text(input.needReason, 'needReason', 4000, true),
    requiredAt: input.requiredAt ? date(input.requiredAt, 'requiredAt') : null,
    priority: (input.priority ?? 'NORMAL') as ProcurementDraftV1['priority'],
    urgent: input.urgent === true,
    urgencyReason: text(input.urgencyReason, 'urgencyReason', 1000, true),
    estimatedAmount:
      input.estimatedAmount === undefined ||
      input.estimatedAmount === null ||
      input.estimatedAmount === ''
        ? null
        : money(input.estimatedAmount),
    currencyCode: input.currencyCode ? currency(input.currencyCode) : null,
    unknownEstimateReason: text(
      input.unknownEstimateReason,
      'unknownEstimateReason',
      1000,
      true,
    ),
    deliveryLocation: text(
      input.deliveryLocation,
      'deliveryLocation',
      1000,
      true,
    ),
    notes: text(input.notes, 'notes', 4000, true),
    documents: array(input.documents ?? [], 'documents', 20).map((value) => {
      const document = object(value, ['id', 'versionId']);
      return { id: uuid(document.id), versionId: uuid(document.versionId) };
    }),
    items,
    origin:
      origin.kind === 'GENERAL'
        ? { kind: 'GENERAL' }
        : {
            kind: 'SPECIALIZED',
            module: 'RESERVATIONS',
            operationId: uuid(origin.operationId),
            version: integer(origin.version),
          },
  };
}
