import type { FinanceCurrencyCode, MoneyContract } from '@rubi/contracts';

export type RoundingMode = 'HALF_UP' | 'HALF_EVEN' | 'DOWN';

const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;

function powerOfTen(scale: number): bigint {
  if (!Number.isInteger(scale) || scale < 0 || scale > 18) {
    throw new FinanceDomainError(
      'INVALID_SCALE',
      'Scale must be an integer between 0 and 18.',
    );
  }
  return 10n ** BigInt(scale);
}

function canonicalParts(value: string): { coefficient: bigint; scale: number } {
  if (!DECIMAL_PATTERN.test(value)) {
    throw new FinanceDomainError(
      'INVALID_DECIMAL',
      'Money and rates must use a canonical decimal string with at most 18 fractional digits.',
    );
  }
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [integer, fraction = ''] = unsigned.split('.');
  const coefficient = BigInt(`${negative ? '-' : ''}${integer}${fraction}`);
  return { coefficient, scale: fraction.length };
}

function formatDecimal(coefficient: bigint, scale: number): string {
  if (coefficient === 0n) return '0';
  const negative = coefficient < 0n;
  const digits = (negative ? -coefficient : coefficient).toString();
  if (scale === 0) return `${negative ? '-' : ''}${digits}`;
  const padded = digits.padStart(scale + 1, '0');
  const integer = padded.slice(0, -scale);
  const fraction = padded.slice(-scale).replace(/0+$/, '');
  return `${negative ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}`;
}

function roundedQuotient(
  coefficient: bigint,
  divisor: bigint,
  mode: RoundingMode,
): bigint {
  const quotient = coefficient / divisor;
  const remainder = coefficient % divisor;
  if (remainder === 0n || mode === 'DOWN') return quotient;

  const sign = coefficient < 0n ? -1n : 1n;
  const absoluteRemainder = remainder < 0n ? -remainder : remainder;
  const doubled = absoluteRemainder * 2n;
  if (doubled < divisor) return quotient;
  if (doubled > divisor) return quotient + sign;
  if (mode === 'HALF_UP') return quotient + sign;
  return quotient % 2n === 0n ? quotient : quotient + sign;
}

export class FinanceDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'FinanceDomainError';
  }
}

export class DecimalValue {
  private constructor(
    private readonly coefficient: bigint,
    public readonly scale: number,
  ) {}

  static parse(value: string): DecimalValue {
    const parsed = canonicalParts(value);
    return new DecimalValue(parsed.coefficient, parsed.scale);
  }

  static zero(): DecimalValue {
    return new DecimalValue(0n, 0);
  }

  get isNegative(): boolean {
    return this.coefficient < 0n;
  }

  get isZero(): boolean {
    return this.coefficient === 0n;
  }

  compare(other: DecimalValue): number {
    const scale = Math.max(this.scale, other.scale);
    const left = this.coefficient * powerOfTen(scale - this.scale);
    const right = other.coefficient * powerOfTen(scale - other.scale);
    return left === right ? 0 : left > right ? 1 : -1;
  }

  add(other: DecimalValue): DecimalValue {
    const scale = Math.max(this.scale, other.scale);
    return new DecimalValue(
      this.coefficient * powerOfTen(scale - this.scale) +
        other.coefficient * powerOfTen(scale - other.scale),
      scale,
    );
  }

  subtract(other: DecimalValue): DecimalValue {
    return this.add(new DecimalValue(-other.coefficient, other.scale));
  }

  multiply(other: DecimalValue): DecimalValue {
    const scale = this.scale + other.scale;
    if (scale > 36) {
      throw new FinanceDomainError(
        'PRECISION_EXCEEDED',
        'Intermediate decimal precision exceeds the supported boundary.',
      );
    }
    return new DecimalValue(this.coefficient * other.coefficient, scale);
  }

  round(scale: number, mode: RoundingMode): DecimalValue {
    powerOfTen(scale);
    if (scale >= this.scale) return this;
    const divisor = powerOfTen(this.scale - scale);
    return new DecimalValue(
      roundedQuotient(this.coefficient, divisor, mode),
      scale,
    );
  }

  toString(): string {
    return formatDecimal(this.coefficient, this.scale);
  }
}

export interface CurrencyPolicy {
  currencyCode: FinanceCurrencyCode;
  accountingScale: number;
  roundingMode: RoundingMode;
  displayUnit: 'OFFICIAL' | 'TOMAN_PRESENTATION';
}

export const proposedCurrencyPolicies: Readonly<
  Record<FinanceCurrencyCode, CurrencyPolicy>
> = {
  IRR: {
    currencyCode: 'IRR',
    accountingScale: 0,
    roundingMode: 'HALF_UP',
    displayUnit: 'TOMAN_PRESENTATION',
  },
  USD: {
    currencyCode: 'USD',
    accountingScale: 2,
    roundingMode: 'HALF_EVEN',
    displayUnit: 'OFFICIAL',
  },
  EUR: {
    currencyCode: 'EUR',
    accountingScale: 2,
    roundingMode: 'HALF_EVEN',
    displayUnit: 'OFFICIAL',
  },
  TRY: {
    currencyCode: 'TRY',
    accountingScale: 2,
    roundingMode: 'HALF_EVEN',
    displayUnit: 'OFFICIAL',
  },
  AED: {
    currencyCode: 'AED',
    accountingScale: 2,
    roundingMode: 'HALF_EVEN',
    displayUnit: 'OFFICIAL',
  },
};

export function currencyPolicyFor(
  currencyCode: FinanceCurrencyCode,
): CurrencyPolicy {
  const policy = proposedCurrencyPolicies[currencyCode];
  if (!policy) {
    throw new FinanceDomainError(
      'CURRENCY_POLICY_MISSING',
      'Currency policy is not configured.',
    );
  }
  return policy;
}
export class Money {
  private constructor(
    private readonly decimal: DecimalValue,
    public readonly currencyCode: FinanceCurrencyCode,
  ) {}

  static from(contract: MoneyContract): Money {
    return new Money(
      DecimalValue.parse(contract.amount),
      contract.currencyCode,
    );
  }

  static zero(currencyCode: FinanceCurrencyCode): Money {
    return new Money(DecimalValue.zero(), currencyCode);
  }

  get isNegative(): boolean {
    return this.decimal.isNegative;
  }

  get isZero(): boolean {
    return this.decimal.isZero;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.decimal.add(other.decimal), this.currencyCode);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.decimal.subtract(other.decimal), this.currencyCode);
  }

  equals(other: Money): boolean {
    return (
      this.currencyCode === other.currencyCode &&
      this.decimal.compare(other.decimal) === 0
    );
  }

  round(policy?: CurrencyPolicy): Money {
    const effectivePolicy = policy ?? currencyPolicyFor(this.currencyCode);
    if (effectivePolicy.currencyCode !== this.currencyCode) {
      throw new FinanceDomainError(
        'CURRENCY_POLICY_MISMATCH',
        'Rounding policy currency does not match the money currency.',
      );
    }
    return new Money(
      this.decimal.round(
        effectivePolicy.accountingScale,
        effectivePolicy.roundingMode,
      ),
      this.currencyCode,
    );
  }

  convert(input: {
    quoteCurrencyCode: FinanceCurrencyCode;
    rate: string;
    policy?: CurrencyPolicy;
  }): Money {
    const policy = input.policy ?? currencyPolicyFor(input.quoteCurrencyCode);
    if (policy.currencyCode !== input.quoteCurrencyCode) {
      throw new FinanceDomainError(
        'CURRENCY_POLICY_MISMATCH',
        'Conversion policy must match the quote currency.',
      );
    }
    const converted = this.decimal.multiply(DecimalValue.parse(input.rate));
    return new Money(
      converted.round(policy.accountingScale, policy.roundingMode),
      input.quoteCurrencyCode,
    );
  }

  toContract(): MoneyContract {
    return { amount: this.decimal.toString(), currencyCode: this.currencyCode };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currencyCode !== other.currencyCode) {
      throw new FinanceDomainError(
        'CURRENCY_MISMATCH',
        'Money arithmetic requires the same currency code.',
      );
    }
  }
}
