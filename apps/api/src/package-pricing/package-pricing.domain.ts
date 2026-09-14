import type {
  PackagePriceBreakdownV1,
  PackagePricingRuleInputV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';

export class PackagePricingDomainError extends Error {
  constructor(
    readonly code: 'PACKAGE_VALIDATION_FAILED' | 'MINIMUM_MARGIN_VIOLATION',
    message: string,
  ) {
    super(message);
  }
}

const decimalPattern = /^(0|[1-9]\d{0,17})(\.\d{1,10})?$/;

function decimal(value: string, field: string) {
  if (!decimalPattern.test(value))
    throw new PackagePricingDomainError(
      'PACKAGE_VALIDATION_FAILED',
      `${field} باید Decimal نامنفی و معتبر باشد.`,
    );
  return new Prisma.Decimal(value);
}

function money(value: Prisma.Decimal) {
  return value.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

export function calculatePackagePrice(
  baseAmount: string,
  currencyCode: string,
  rules: readonly PackagePricingRuleInputV1[],
): PackagePriceBreakdownV1 & {
  minimumProfitAmount: string | null;
  minimumSaleAmount: string | null;
  marginPercent: string;
} {
  if (!/^[A-Z]{3}$/.test(currencyCode))
    throw new PackagePricingDomainError(
      'PACKAGE_VALIDATION_FAILED',
      'کد ارز معتبر نیست.',
    );
  const base = decimal(baseAmount, 'قیمت پایه');
  if (base.lte(0))
    throw new PackagePricingDomainError(
      'PACKAGE_VALIDATION_FAILED',
      'قیمت پایه باید مثبت باشد.',
    );
  const ordered = [...rules].sort(
    (left, right) => left.sequence - right.sequence,
  );
  if (
    ordered.length > 100 ||
    ordered.some(
      (rule, index) =>
        !Number.isSafeInteger(rule.sequence) ||
        rule.sequence < 1 ||
        (index > 0 && rule.sequence === ordered[index - 1]!.sequence) ||
        !rule.title.trim() ||
        rule.title.length > 160,
    )
  )
    throw new PackagePricingDomainError(
      'PACKAGE_VALIDATION_FAILED',
      'ترتیب و عنوان قواعد معتبر نیست.',
    );

  let current = base;
  let fee = new Prisma.Decimal(0);
  let tax = new Prisma.Decimal(0);
  let profit = new Prisma.Decimal(0);
  let minimumProfit: Prisma.Decimal | null = null;
  let minimumSale: Prisma.Decimal | null = null;
  const lines: PackagePriceBreakdownV1['lines'][number][] = [];

  for (const rule of ordered) {
    const value = decimal(rule.value, `مقدار قاعده ${rule.title}`);
    const before = current;
    let adjustment = new Prisma.Decimal(0);
    switch (rule.operation) {
      case 'ADD_FIXED':
        adjustment = value;
        break;
      case 'SUBTRACT_FIXED':
        adjustment = value.negated();
        break;
      case 'ADD_PERCENT':
        adjustment = current.mul(value).div(100);
        break;
      case 'SUBTRACT_PERCENT':
        adjustment = current.mul(value).div(100).negated();
        break;
      case 'MULTIPLY':
        adjustment = current.mul(value).sub(current);
        break;
      case 'DIVIDE':
        if (value.eq(0))
          throw new PackagePricingDomainError(
            'PACKAGE_VALIDATION_FAILED',
            'ضریب تقسیم نمی‌تواند صفر باشد.',
          );
        adjustment = current.div(value).sub(current);
        break;
      case 'FEE':
      case 'COMMISSION': {
        adjustment = current.mul(value).div(100);
        fee = fee.add(adjustment);
        break;
      }
      case 'TAX':
        adjustment = current.mul(value).div(100);
        tax = tax.add(adjustment);
        break;
      case 'PROFIT':
        adjustment = current.mul(value).div(100);
        profit = profit.add(adjustment);
        break;
      case 'ROUND': {
        if (value.eq(0))
          throw new PackagePricingDomainError(
            'PACKAGE_VALIDATION_FAILED',
            'گام گردکردن باید مثبت باشد.',
          );
        const rounded = current
          .div(value)
          .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
          .mul(value);
        adjustment = rounded.sub(current);
        break;
      }
      case 'MINIMUM_PROFIT':
        minimumProfit = Prisma.Decimal.max(minimumProfit ?? 0, value);
        break;
      case 'MINIMUM_SALE_PRICE':
        minimumSale = Prisma.Decimal.max(minimumSale ?? 0, value);
        break;
    }
    current = money(current.add(adjustment));
    if (current.lte(0))
      throw new PackagePricingDomainError(
        'PACKAGE_VALIDATION_FAILED',
        'نتیجه یک قاعده قیمت را صفر یا منفی کرده است.',
      );
    lines.push({
      sequence: rule.sequence,
      title: rule.title.trim(),
      operation: rule.operation,
      before: money(before).toFixed(4),
      adjustment: money(adjustment).toFixed(4),
      after: current.toFixed(4),
    });
  }

  const realizedProfit = current.sub(base);
  if (
    (minimumProfit && realizedProfit.lt(minimumProfit)) ||
    (minimumSale && current.lt(minimumSale))
  )
    throw new PackagePricingDomainError(
      'MINIMUM_MARGIN_VIOLATION',
      'قیمت نهایی حداقل سود یا حداقل قیمت فروش را رعایت نمی‌کند.',
    );

  const adjustment = current.sub(base).sub(fee).sub(tax).sub(profit);
  return {
    currencyCode,
    baseAmount: money(base).toFixed(4),
    adjustments: money(adjustment).toFixed(4),
    fee: money(fee).toFixed(4),
    tax: money(tax).toFixed(4),
    profit: money(profit).toFixed(4),
    finalAmount: money(current).toFixed(4),
    marginPercent: realizedProfit.mul(100).div(base).toFixed(6),
    minimumProfitAmount: minimumProfit ? money(minimumProfit).toFixed(4) : null,
    minimumSaleAmount: minimumSale ? money(minimumSale).toFixed(4) : null,
    lines,
  };
}

export function calculatePassengerPrice(
  finalAmount: string,
  multiplier: string,
) {
  const price = decimal(finalAmount, 'قیمت نهایی');
  const factor = decimal(multiplier, 'ضریب مسافر');
  const result = money(price.mul(factor));
  if (result.lte(0))
    throw new PackagePricingDomainError(
      'PACKAGE_VALIDATION_FAILED',
      'قیمت رده مسافر باید مثبت باشد.',
    );
  return result.toFixed(4);
}
