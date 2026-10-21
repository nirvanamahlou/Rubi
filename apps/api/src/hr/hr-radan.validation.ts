import { BadRequestException } from '@nestjs/common';
import {
  HR_RADAN_FIELD_OPTIONS,
  type HrResourceDefinition,
} from '@nora/contracts';

export function validateRadanFields(
  values: string[],
  schema: HrResourceDefinition,
) {
  const read = (label: string) =>
    (values[schema.columns.indexOf(label)] ?? '').replace(/[۰-۹٠-٩]/g, (c) =>
      String(c.charCodeAt(0) - (c >= '۰' ? 1776 : 1632)),
    );
  for (const [label, options] of Object.entries(HR_RADAN_FIELD_OPTIONS)) {
    const value = read(label);
    if (value && !options.includes(value))
      throw new BadRequestException(`${label} را از فهرست انتخاب کنید.`);
  }
  if (schema.key === 'time.workingHours') {
    for (const label of ['ساعت قبل از شروع', 'ساعت بعد از پایان'])
      if (
        !/^\d{1,2}(\.\d{1,2})?$/.test(read(label)) ||
        Number(read(label)) > 48
      )
        throw new BadRequestException(
          'محدوده تردد باید بین صفر و ۴۸ ساعت باشد.',
        );
    if (read('رنگ') && !/^#[0-9a-f]{6}$/i.test(read('رنگ')))
      throw new BadRequestException('رنگ باید کد شش‌رقمی معتبر باشد.');
    const clock = (v: string) =>
      Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
    const offset = ['همان روز', 'یک روز بعد', 'دو روز بعد'].indexOf(
      read('روز پایان'),
    );
    const duration =
      offset * 1440 + clock(read('ساعت پایان')) - clock(read('ساعت شروع'));
    if (duration <= 0 || duration > 4320)
      throw new BadRequestException('پایان ساعت کاری باید پس از شروع باشد.');
  }
  if (schema.key === 'time.biometric') {
    const address = read('آدرس دستگاه');
    if (address && (address.length > 253 || !/^[a-z0-9.:-]+$/i.test(address)))
      throw new BadRequestException(
        'آدرس دستگاه باید میزبان یا IP بدون رمز و مسیر باشد.',
      );
    const port = read('پورت دستگاه');
    if (
      port &&
      (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535)
    )
      throw new BadRequestException('پورت دستگاه باید بین ۱ و ۶۵۵۳۵ باشد.');
  }
  if (schema.key === 'time.remote' && read('نوع دورکاری') === 'ساعتی') {
    if (
      !read('ساعت شروع') ||
      !read('ساعت پایان') ||
      read('از تاریخ') !== read('تا تاریخ') ||
      read('ساعت پایان') <= read('ساعت شروع')
    )
      throw new BadRequestException(
        'دورکاری ساعتی به ساعت شروع و پایان در همان روز نیاز دارد.',
      );
  }
  return values;
}
