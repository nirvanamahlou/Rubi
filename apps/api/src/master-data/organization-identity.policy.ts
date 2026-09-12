import { BadRequestException, ConflictException } from '@nestjs/common';

export function normalizeOrganizationNationalId(value: unknown): string | null {
  if (value !== null && typeof value !== 'string')
    throw new BadRequestException('شناسه ملی شرکت باید متن باشد.');
  const normalized = String(value ?? '')
    .trim()
    .replace(/[۰-۹٠-٩]/g, (digit) =>
      String(digit.charCodeAt(0) - (digit >= '۰' ? 1776 : 1632)),
    );
  if (normalized && !/^[0-9]{11}$/.test(normalized))
    throw new BadRequestException('شناسه ملی شرکت باید ۱۱ رقم باشد.');
  return normalized || null;
}

export function rethrowOrganizationIdentityError(error: unknown): never {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'P2002' &&
    'meta' in error &&
    JSON.stringify(error.meta).includes('nationalId')
  )
    throw new ConflictException(
      'این شناسه ملی برای سازمان دیگری ثبت شده است؛ پرونده موجود را انتخاب کنید.',
    );
  throw error;
}
