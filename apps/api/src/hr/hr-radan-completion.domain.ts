import { BadRequestException } from '@nestjs/common';
import {
  HR_RADAN_CALCULATION_COMPONENTS,
  HR_RADAN_COMPLETION_OPTIONS,
  HR_RADAN_PROVINCES,
  HR_RADAN_REQUEST_TYPES,
} from '@nora/contracts';
import * as v from './hr.validation';

export function durationMinutes(value: unknown) {
  const text = v.digits(v.text(value, 'ساعت:دقیقه', 12));
  if (!/^\d{1,6}:[0-5]\d$/.test(text))
    throw new BadRequestException('زمان باید ساعت:دقیقه باشد.');
  return Number(text.split(':')[0]) * 60 + Number(text.split(':')[1]);
}
export function jalaliYear(value: unknown) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1300 || year > 1600)
    throw new BadRequestException('سال شمسی معتبر نیست.');
  return year;
}
export function selection(value: string, options: readonly string[]) {
  let result: unknown;
  try {
    result = JSON.parse(value);
  } catch {
    throw new BadRequestException('گزینه‌های انتخاب‌شده معتبر نیستند.');
  }
  if (
    !Array.isArray(result) ||
    result.length > options.length ||
    result.some((x) => typeof x !== 'string' || !options.includes(x)) ||
    new Set(result).size !== result.length
  )
    throw new BadRequestException('گزینه‌های انتخاب‌شده معتبر نیستند.');
  return result as string[];
}
export function validateCompletionValues(
  key: string,
  columns: readonly string[],
  values: string[],
) {
  const read = (label: string) => values[columns.indexOf(label)] ?? '';
  for (const [label, options] of Object.entries(HR_RADAN_COMPLETION_OPTIONS))
    if (read(label) && !options.includes(read(label)))
      throw new BadRequestException(`${label} معتبر نیست.`);
  if (key === 'employee.identity') {
    if (read('کد پستی') && !/^\d{10}$/.test(v.digits(read('کد پستی'))))
      throw new BadRequestException('کد پستی باید ده رقم باشد.');
    if (read('کد ملی') && !/^\d{10}$/.test(v.digits(read('کد ملی'))))
      throw new BadRequestException('کد ملی باید ده رقم باشد.');
    if (
      read('استان محل صدور') &&
      !(HR_RADAN_PROVINCES as readonly string[]).includes(
        read('استان محل صدور'),
      )
    )
      throw new BadRequestException('استان معتبر نیست.');
    if (read('شهر محل صدور') && !read('استان محل صدور'))
      throw new BadRequestException('ابتدا استان را انتخاب کنید.');
  }
  if (
    key === 'employee.phones' &&
    !/^[+\d ()-]{3,30}$/.test(v.digits(read('شماره تماس')))
  )
    throw new BadRequestException('شماره تماس معتبر نیست.');
  if (key === 'time.calculationSettings') {
    if (!['حکم', 'تردد'].includes(read('مبنای محاسبات')))
      throw new BadRequestException('مبنای محاسبات را انتخاب کنید.');
    selection(read('اجزای کارکرد'), HR_RADAN_CALCULATION_COMPONENTS);
    for (const label of columns.slice(2, 9))
      if (
        label !== 'طول مرخصی روزانه به دقیقه' &&
        !['بله', 'خیر'].includes(read(label))
      )
        throw new BadRequestException(`${label} را انتخاب کنید.`);
    if (
      !/^\d{1,4}$/.test(read('طول مرخصی روزانه به دقیقه')) ||
      Number(read('طول مرخصی روزانه به دقیقه')) < 1 ||
      Number(read('طول مرخصی روزانه به دقیقه')) > 1440
    )
      throw new BadRequestException('طول مرخصی روزانه معتبر نیست.');
  }
  if (key === 'requests.procedures') {
    if (!selection(read('درخواست‌ها'), HR_RADAN_REQUEST_TYPES).length)
      throw new BadRequestException('حداقل یک نوع درخواست انتخاب کنید.');
  }
  if (
    key === 'requests.approvalStages' &&
    (!/^\d{1,2}$/.test(read('اولویت')) || Number(read('اولویت')) < 1)
  )
    throw new BadRequestException('اولویت باید بین یک و ۹۹ باشد.');
  if (key === 'time.leaveTransferRules') {
    jalaliYear(read('سال مبدأ'));
    for (const label of columns.slice(2)) {
      if (label === 'حد پایین ساعت:دقیقه' && !read(label)) continue;
      durationMinutes(read(label));
    }
    if (
      read('حد پایین ساعت:دقیقه') &&
      durationMinutes(read('حد پایین ساعت:دقیقه')) >
        durationMinutes(read('حد تعیین‌شده ساعت:دقیقه'))
    )
      throw new BadRequestException(
        'حد پایین نمی‌تواند بیشتر از حد بالا باشد.',
      );
  }
  if (['requests.radanLeave', 'requests.radanMission'].includes(key)) {
    if (read('تا تاریخ') < read('از تاریخ'))
      throw new BadRequestException('پایان بازه پیش از شروع است.');
    if (
      key === 'requests.radanMission' &&
      read('با جایگزینی') === 'بله' &&
      !['درون‌شهری', 'برون‌شهری', 'برون‌کشوری'].includes(read('نوع مأموریت'))
    )
      throw new BadRequestException('این نوع مأموریت جایگزینی ندارد.');
    if (read('نوع مدت') === 'ساعتی') {
      if (
        read('از تاریخ') !== read('تا تاریخ') ||
        !read('ساعت شروع') ||
        !read('ساعت پایان') ||
        read('ساعت پایان') <= read('ساعت شروع')
      )
        throw new BadRequestException(
          'درخواست ساعتی باید بازه مثبت در همان روز داشته باشد.',
        );
      if (
        key === 'requests.radanLeave' &&
        !['استحقاقی', 'استعلاجی', 'تشویقی', 'بدون حقوق'].includes(
          read('نوع مرخصی'),
        )
      )
        throw new BadRequestException('نوع مرخصی ساعتی معتبر نیست.');
      if (
        key === 'requests.radanMission' &&
        !['درون‌شهری', 'برون‌شهری'].includes(read('نوع مأموریت'))
      )
        throw new BadRequestException('نوع مأموریت ساعتی معتبر نیست.');
      if (read('با جایگزینی') === 'بله')
        throw new BadRequestException('جایگزینی برای درخواست روزانه است.');
    }
  }
  return values;
}

export function transferSplit(balance: number, rule: string[]) {
  const threshold = durationMinutes(rule[2]);
  const lower = rule[9] ? durationMinutes(rule[9]) : undefined;
  if (
    lower !== undefined &&
    (lower > threshold || (balance <= threshold && balance >= lower))
  )
    throw new BadRequestException('مانده در محدوده انتقال تعریف‌شده نیست.');
  const offset = balance > threshold ? 3 : 6;
  const amounts = rule.slice(offset, offset + 3).map(durationMinutes);
  if (amounts.reduce((a, b) => a + b, 0) !== balance)
    throw new BadRequestException(
      'مجموع انتقال، سوخت و بازخرید باید برابر مانده واقعی باشد.',
    );
  return { carry: amounts[0]!, burn: amounts[1]!, buyback: amounts[2]! };
}

export function assertTemplateIntervals(days: readonly string[][]) {
  const spans = days
    .map((day) => {
      const offset = ['همان روز', 'یک روز بعد', 'دو روز بعد'].indexOf(day[3]!);
      const endDate = new Date(v.isoDate(day[0]).getTime() + offset * 86400000)
        .toISOString()
        .slice(0, 10);
      return [
        v.localClockToUtc(day[0]!, day[1]!).getTime(),
        v.localClockToUtc(endDate, day[2]!).getTime(),
      ] as const;
    })
    .sort((a, b) => a[0] - b[0]);
  if (
    spans.some(
      (span, index) =>
        span[1] <= span[0] || (index > 0 && spans[index - 1]![1] > span[0]),
    )
  )
    throw new BadRequestException('روزهای شیفت هم‌پوشانی دارند.');
}
