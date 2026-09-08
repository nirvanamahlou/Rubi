import { BadRequestException } from '@nestjs/common';
import {
  getHrResource,
  type HrResourceDefinition,
  type HrWorkflowData,
} from '@rubi/contracts';

export function object(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('ساختار درخواست معتبر نیست.');
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !keys.includes(key)))
    throw new BadRequestException('فیلد ناشناخته در درخواست وجود دارد.');
  return result;
}
export function text(
  value: unknown,
  label: string,
  max = 160,
  optional = false,
): string {
  if (optional && (value === undefined || value === '')) return '';
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > max ||
    value.includes(String.fromCharCode(0))
  )
    throw new BadRequestException(`${label} معتبر نیست.`);
  return value.trim();
}
export function uuid(value: unknown, label = 'شناسه'): string {
  const result = text(value, label, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      result,
    )
  )
    throw new BadRequestException(`${label} باید شناسه پایدار باشد.`);
  return result;
}
export function version(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new BadRequestException('نسخه معتبر رکورد الزامی است.');
  return Number(value);
}
export function digits(value: string): string {
  return value
    .replace(/[۰-۹٠-٩]/g, (c) =>
      String(c.charCodeAt(0) - (c >= '۰' ? 1776 : 1632)),
    )
    .replace(/[٬,\s]/g, '')
    .replace('٫', '.');
}
export function isoDate(value: unknown, label = 'تاریخ'): Date {
  const input = text(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input))
    throw new BadRequestException(`${label} باید تاریخ میلادی ISO باشد.`);
  const date = new Date(`${input}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input ||
    date.getUTCFullYear() < 1900 ||
    date.getUTCFullYear() > 2200
  )
    throw new BadRequestException(`${label} معتبر نیست.`);
  return date;
}
export function resource(section: unknown, tab: unknown): HrResourceDefinition {
  const result = getHrResource(
    text(section, 'بخش', 40),
    text(tab, 'نوع رکورد', 40),
  );
  if (!result)
    throw new BadRequestException('نوع رکورد منابع انسانی شناخته‌شده نیست.');
  return result;
}
export function workflowData(value: unknown): HrWorkflowData {
  if (value === undefined) return {};
  const data = object(value, [
    'managerId',
    'targetBranchId',
    'organizationBranchId',
    'documentId',
    'startsAt',
    'endsAt',
    'minutes',
    'allowanceDays',
    'currency',
    'reason',
  ]);
  for (const key of [
    'managerId',
    'targetBranchId',
    'documentId',
    'organizationBranchId',
  ])
    if (data[key] !== undefined && !(key === 'managerId' && data[key] === null))
      uuid(data[key], key);
  for (const key of ['startsAt', 'endsAt'])
    if (data[key] !== undefined) {
      const item = text(data[key], key, 30);
      if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(item) ||
        !Number.isFinite(Date.parse(item))
      )
        throw new BadRequestException('زمان باید UTC با پسوند Z باشد.');
    }
  if (
    data.startsAt &&
    data.endsAt &&
    String(data.endsAt) <= String(data.startsAt)
  )
    throw new BadRequestException('پایان باید پس از شروع باشد.');
  if (
    data.minutes !== undefined &&
    (!Number.isInteger(data.minutes) ||
      Number(data.minutes) < 0 ||
      Number(data.minutes) > 1440)
  )
    throw new BadRequestException('دقیقه معتبر نیست.');
  if (data.currency !== undefined && !/^[A-Z]{3}$/.test(String(data.currency)))
    throw new BadRequestException('کد ارز سه‌حرفی الزامی است.');
  if (
    data.allowanceDays !== undefined &&
    !/^\d{1,3}(\.\d{1,2})?$/.test(String(data.allowanceDays))
  )
    throw new BadRequestException('سهمیه معتبر نیست.');
  if (data.reason !== undefined) text(data.reason, 'دلیل', 1000);
  return data as HrWorkflowData;
}
export function recordValues(
  value: unknown,
  schema: HrResourceDefinition,
): string[] {
  if (!Array.isArray(value) || value.length !== schema.columns.length)
    throw new BadRequestException('تعداد فیلدها با فرم مصوب مطابقت ندارد.');
  return value.map((input: unknown, index) => {
    const field = schema.fields[index]!;
    if (
      typeof input !== 'string' ||
      input.length > field.maxLength ||
      input.includes(String.fromCharCode(0)) ||
      /data:|blob:/i.test(input)
    )
      throw new BadRequestException(`${field.label} معتبر نیست.`);
    const normalized = input.trim();
    if (field.required && !normalized)
      throw new BadRequestException(`${field.label} الزامی است.`);
    if (field.type === 'date' && normalized && normalized !== '—')
      isoDate(normalized, field.label);
    if (
      field.type === 'time' &&
      normalized &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(digits(normalized))
    )
      throw new BadRequestException(`${field.label} باید HH:mm باشد.`);
    if (
      field.type === 'money' &&
      normalized &&
      normalized !== '—' &&
      !/^\d{1,20}(\.\d{1,4})?$/.test(digits(normalized))
    )
      throw new BadRequestException(`${field.label} باید مبلغ غیرمنفی باشد.`);
    if (
      field.type === 'decimal' &&
      normalized &&
      !/^\d{1,8}(\.\d{1,2})?$/.test(digits(normalized))
    )
      throw new BadRequestException(`${field.label} باید عدد معتبر باشد.`);
    if (/پوشیده/.test(field.label) && normalized && !/[•*]/.test(normalized))
      throw new BadRequestException('این فیلد فقط مقدار پوشیده را می‌پذیرد.');
    if (
      /شبا|کارت|CVV|رمز/i.test(field.label) &&
      normalized &&
      !/[•*]/.test(normalized)
    )
      throw new BadRequestException(
        'اطلاعات بانکی خام باید در سامانه مالک و با مجوز تخصصی نگهداری شود.',
      );
    return normalized;
  });
}
export const APPROVED = new Set(['تأییدشده', 'تاییدشده', 'فعال', 'آماده شروع']);
export const FINAL = new Set([...APPROVED, 'ردشده', 'لغوشده']);
export function status(
  value: unknown,
  approval: boolean,
  fallback = 'پیش‌نویس',
): string {
  const result = value === undefined ? fallback : text(value, 'وضعیت', 80);
  if (/پرداخت|واریز|ارسال.*مالی|تسویه‌شده|متصل|همگام|قطع.*دسترسی/.test(result))
    throw new BadRequestException(
      'این وضعیت فقط با پاسخ معتبر سامانه مالک قابل ثبت است.',
    );
  if (
    approval &&
    ![
      'پیش‌نویس',
      'در انتظار تأیید',
      'در انتظار بررسی',
      'در انتظار مدیر',
      'در حال بررسی',
      'تأییدشده',
      'تاییدشده',
      'فعال',
      'آماده شروع',
      'ردشده',
      'لغوشده',
      'در انتظار امضا',
    ].includes(result)
  )
    throw new BadRequestException('وضعیت گردش تأیید معتبر نیست.');
  return result;
}

/** Exact UTC duration; an overnight shift crosses midnight only when its end precedes its start. */
export function attendanceMinutes(events: { at: Date; kind: string }[]): {
  worked: number;
  exceptions: string[];
} {
  let start: Date | undefined;
  let worked = 0;
  const exceptions: string[] = [];
  for (const event of [...events].sort(
    (a, b) => a.at.getTime() - b.at.getTime(),
  )) {
    if (event.kind === 'ورود') {
      if (start) exceptions.push('ورود تکراری');
      else start = event.at;
    } else if (event.kind === 'خروج') {
      if (!start) exceptions.push('خروج بدون ورود');
      else {
        worked += Math.floor((event.at.getTime() - start.getTime()) / 60_000);
        start = undefined;
      }
    } else exceptions.push('نوع تردد ناشناخته');
  }
  if (start) exceptions.push('خروج ثبت نشده');
  return { worked, exceptions: [...new Set(exceptions)] };
}

export const HR_TIME_ZONE = 'Asia/Tehran';
export function localClockParts(at: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
  };
}
export function localClockToUtc(date: string, time: string): Date {
  isoDate(date);
  const clock = digits(time);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock))
    throw new BadRequestException('ساعت معتبر نیست.');
  const desired = Date.parse(`${date}T${clock}:00Z`);
  let guess = desired;
  for (let i = 0; i < 3; i++) {
    const parts = localClockParts(new Date(guess));
    guess += desired - Date.parse(`${parts.date}T${parts.time}:00Z`);
  }
  const result = new Date(guess);
  const parts = localClockParts(result);
  if (parts.date !== date || parts.time !== clock)
    throw new BadRequestException('زمان محلی در تقویم معتبر نیست.');
  return result;
}
