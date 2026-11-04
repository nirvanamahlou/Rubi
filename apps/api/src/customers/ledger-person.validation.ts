import { BadRequestException } from '@nestjs/common';
import {
  detailDigits,
  ledgerPersonTextKeys,
  ledgerTaxKinds,
  personTitles,
  personMarital,
  personEducation,
  personReligions,
  type LedgerPersonInput,
  type PersonNote,
  type PersonTaxRow,
} from '@nora/contracts';
const invalid = (field: string): never => {
  throw new BadRequestException('مقدار نامعتبر در فرم شخص: ' + field);
};
function object(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return invalid('شخص');
  return raw as Record<string, unknown>;
}
function text(raw: unknown, key: string, max: number, required = false) {
  if (raw === undefined && !required) return '';
  if (
    typeof raw !== 'string' ||
    raw.trim().length > max ||
    (required && !raw.trim())
  )
    return invalid(key);
  return raw.trim();
}
function date(raw: unknown, key: string) {
  const value = text(raw, key, 10);
  if (
    value &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value)
  )
    invalid(key);
  return value;
}
function email(value: string, key: string) {
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) invalid(key);
  return value;
}
function rows(raw: unknown, max: number) {
  if (!Array.isArray(raw) || raw.length > max) return invalid('تعداد ردیف‌ها');
  return raw.map(object);
}
function id(raw: unknown) {
  const value = text(raw, 'شناسه', 36, true);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    invalid('شناسه');
  return value;
}
function unique(keys: string[]) {
  if (new Set(keys).size !== keys.length) invalid('ردیف تکراری');
}
export function ledgerPersonInput(raw: unknown): LedgerPersonInput {
  const r = object(raw);
  const firstName = text(r.firstName, 'نام', 120, true),
    lastName = text(r.lastName, 'نام خانوادگی', 120, true),
    code = detailDigits(text(r.code, 'کد', 20, true));
  if (!/^\d{1,20}$/.test(code)) invalid('کد');
  if ((firstName + ' ' + lastName).length > 160) invalid('نام کامل');
  if (r.gender !== 'M' && r.gender !== 'F') return invalid('جنسیت');
  const birthDate = date(r.birthDate, 'تاریخ تولد');
  if (birthDate > new Date().toISOString().slice(0, 10)) invalid('تاریخ تولد');
  if (
    r.version !== undefined &&
    (typeof r.version !== 'number' ||
      !Number.isSafeInteger(r.version) ||
      r.version < 1)
  )
    invalid('نسخه');
  const fields: LedgerPersonInput['fields'] = {};
  const input = object(r.fields);
  if (
    Object.keys(input).some(
      (k) => !ledgerPersonTextKeys.some((field) => field === k),
    )
  )
    invalid('فیلد');
  for (const k of ledgerPersonTextKeys) {
    const v = text(input[k], k, 200);
    if (v) fields[k] = v;
  }
  for (const k of ['marriageDate', 'vatExpiry', 'issueDate'] as const)
    date(fields[k], k);
  for (const k of ['email', 'workflowEmail'] as const)
    email(fields[k] ?? '', k);
  for (const [k, choices] of [
    ['salutation', personTitles],
    ['religion', personReligions],
    ['marital', personMarital],
    ['education', personEducation],
    ['denomination', ['شیعه', 'سنی']],
  ] as const)
    if (fields[k] && !(choices as readonly string[]).includes(fields[k]!))
      invalid(k);
  const addresses = rows(r.addresses, 100).map((a) => {
    if (typeof a.primary !== 'boolean') return invalid('نشانی اصلی');
    return {
      id: id(a.id),
      primary: a.primary,
      title: text(a.title, 'عنوان نشانی', 160, true),
      region: text(a.region, 'منطقه جغرافیایی', 200, true),
      address: text(a.address, 'نشانی', 1000, true),
      phone: text(a.phone, 'تلفن', 32),
      postalCode: text(a.postalCode, 'کد پستی', 20),
      fax: text(a.fax, 'فاکس', 32),
      email: email(text(a.email, 'ایمیل', 200), 'ایمیل'),
    };
  });
  unique(addresses.map((a) => a.id));
  if (addresses.filter((a) => a.primary).length > 1) invalid('نشانی اصلی');
  const taxRows = rows(r.taxRows, 2).map((t) => {
    if (
      (t.operation !== 'purchase' && t.operation !== 'sale') ||
      !ledgerTaxKinds.some((k) => k === t.kind) ||
      (t.operation === 'purchase' && t.kind === 'consumer')
    )
      return invalid('طرف معامله مالیاتی');
    return { operation: t.operation, kind: t.kind } as PersonTaxRow;
  });
  unique(taxRows.map((t) => t.operation));
  const notes = rows(r.notes, 10).map((n) => ({
    id: id(n.id),
    title: text(n.title, 'عنوان یادداشت', 160, true),
    text: text(n.text, 'متن یادداشت', 1000),
    date: date(n.date, 'تاریخ یادداشت'),
  }));
  unique(notes.map((n) => n.id));
  return {
    firstName,
    lastName,
    code,
    gender: r.gender,
    birthDate,
    fields,
    addresses,
    taxRows,
    notes,
    ...(r.nationalId !== undefined
      ? { nationalId: detailDigits(text(r.nationalId, 'کد ملی', 10)) }
      : {}),
    ...(typeof r.version === 'number' ? { version: r.version } : {}),
  };
}
export function authoredPersonNotes(
  notes: PersonNote[],
  previous: PersonNote[],
  user: string,
): PersonNote[] {
  const now = new Date().toISOString();
  return notes.map((n) => {
    const old = previous.find((x) => x.id === n.id);
    if (
      old &&
      old.title === n.title &&
      old.text === n.text &&
      old.date === n.date
    )
      return old;
    return {
      ...n,
      createdBy: old?.createdBy ?? user,
      createdAt: old?.createdAt ?? now,
      updatedBy: user,
      updatedAt: now,
    };
  });
}
