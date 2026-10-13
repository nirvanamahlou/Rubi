import { MarketingDomainError } from './marketing.errors';

const DECIMAL_PATTERN = /^(0|[1-9]\d{0,13})(?:\.(\d{1,4}))?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export interface MarketingMoney {
  amount: string;
  currencyCode: string;
}

export function normalizeMarketingDecimal(value: string): string {
  const candidate = value.trim();
  const match = DECIMAL_PATTERN.exec(candidate);
  if (!match) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Amount must be a non-negative decimal with up to 14 integer and 4 fractional digits.',
      { field: 'amount' },
    );
  }
  const [integer = '0', fraction = ''] = candidate.split('.');
  const normalizedFraction = fraction.replace(/0+$/, '');
  return normalizedFraction ? `${integer}.${normalizedFraction}` : integer;
}

export function createMarketingMoney(
  amount: string,
  currencyCode: string,
): MarketingMoney {
  if (!CURRENCY_PATTERN.test(currencyCode)) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Currency must be a three-letter uppercase code.',
      { field: 'currencyCode' },
    );
  }
  return {
    amount: normalizeMarketingDecimal(amount),
    currencyCode,
  };
}

function toScaledInteger(value: string): bigint {
  const normalized = normalizeMarketingDecimal(value);
  const [integer = '0', fraction = ''] = normalized.split('.');
  return BigInt(integer + fraction.padEnd(4, '0'));
}

export function compareMarketingDecimals(
  left: string,
  right: string,
): -1 | 0 | 1 {
  const leftValue = toScaledInteger(left);
  const rightValue = toScaledInteger(right);
  if (leftValue < rightValue) return -1;
  if (leftValue > rightValue) return 1;
  return 0;
}

export function subtractMarketingMoney(
  minuend: MarketingMoney,
  subtrahend: MarketingMoney,
): MarketingMoney {
  if (minuend.currencyCode !== subtrahend.currencyCode) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Money values with different currencies cannot be combined.',
      { field: 'currencyCode' },
    );
  }
  const result =
    toScaledInteger(minuend.amount) - toScaledInteger(subtrahend.amount);
  if (result < 0n) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Spend cannot exceed the approved budget in the same calculation.',
      { field: 'spend' },
    );
  }
  const digits = result.toString().padStart(5, '0');
  const integer = digits.slice(0, -4);
  const fraction = digits.slice(-4).replace(/0+$/, '');
  return {
    amount: fraction ? `${integer}.${fraction}` : integer,
    currencyCode: minuend.currencyCode,
  };
}
