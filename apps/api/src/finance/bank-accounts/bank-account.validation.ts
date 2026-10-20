import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { BankIdentifiers } from './bank-account.crypto';

export function bankInput(value: unknown, keys: readonly string[]) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new BadRequestException('اطلاعات حساب بانکی معتبر نیست.');
  return value as Record<string, unknown>;
}
export function bankUuid(value: unknown): string {
  if (typeof value !== 'string' || !isUUID(value))
    throw new BadRequestException('شناسه حساب بانکی معتبر نیست.');
  return value.toLowerCase();
}
export function normalizeBankIdentifier(
  kind: keyof BankIdentifiers,
  raw: unknown,
): string | null {
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string' || raw.length > 120)
    throw new BadRequestException('شماره حساب، کارت یا شبا معتبر نیست.');
  const value = raw
    .normalize('NFKC')
    .replace(/[۰-۹٠-٩]/g, (d) =>
      String(d.charCodeAt(0) - (d >= '۰' ? 0x06f0 : 0x0660)),
    )
    .replace(/[\s-]/g, '')
    .toUpperCase();
  if (!value) return null;
  let valid = false;
  if (kind === 'accountNumber')
    valid = /^[A-Z0-9]{3,34}$/.test(value) && !/^0+$/.test(value);
  if (
    kind === 'cardNumber' &&
    /^\d{16}$/.test(value) &&
    !/^(\d)\1+$/.test(value)
  ) {
    const sum = [...value].reduce((sum, d, i) => {
      const n = Number(d) * (i % 2 === 0 ? 2 : 1);
      return sum + (n > 9 ? n - 9 : n);
    }, 0);
    valid = sum % 10 === 0;
  }
  if (
    kind === 'iban' &&
    /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value) &&
    (!value.startsWith('IR') || /^IR\d{24}$/.test(value))
  ) {
    const rearranged = value.slice(4) + value.slice(0, 4);
    let remainder = 0;
    for (const c of rearranged)
      for (const digit of /\d/.test(c) ? c : String(c.charCodeAt(0) - 55))
        remainder = (remainder * 10 + Number(digit)) % 97;
    valid = remainder === 1;
  }
  if (!valid)
    throw new BadRequestException(
      kind === 'iban'
        ? 'شماره شبا معتبر نیست.'
        : kind === 'cardNumber'
          ? 'شماره کارت معتبر نیست.'
          : 'شماره حساب معتبر نیست.',
    );
  return value;
}
export function bankVersion(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value >= 2147483647
  )
    throw new BadRequestException('نسخه حساب بانکی معتبر نیست.');
  return value;
}
export function maskedBankIdentifier(value: string | null) {
  return value
    ? '•'.repeat(Math.max(4, value.length - 4)) + value.slice(-4)
    : null;
}
