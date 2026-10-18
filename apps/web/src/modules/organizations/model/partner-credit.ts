import type {
  B2bAgencyCreditPolicyV1,
  PartnerFinanceV1,
} from '@nora/contracts';
import { projectCredit, type CreditProjection } from './credit-projection';

/** A supplier advance is not an extra credit grant. Ambiguous limits fail closed. */
export function projectPartnerCredit(
  policy: B2bAgencyCreditPolicyV1,
  finance: PartnerFinanceV1,
  activeLimitsForCurrency: number,
  now = new Date(),
): CreditProjection {
  if (
    finance.creditDirection !== 'COUNTERPARTY_TO_US' ||
    activeLimitsForCurrency !== 1
  )
    return {
      status: 'UNAVAILABLE',
      reason:
        'سقف‌های هم‌زمان این ارز باید ابتدا در قراردادها تطبیق داده شوند.',
    };
  if (finance.reconciliationRequired.length)
    return {
      status: 'UNAVAILABLE',
      reason: 'خرید و پرداخت جایگزین‌شده نیازمند تطبیق است.',
    };
  const balance =
    finance.totals.find((row) => row.currencyCode === policy.currencyCode)
      ?.balance ?? '0';
  return projectCredit(
    policy,
    {
      status: 'AVAILABLE',
      amount: balance.startsWith('-') ? '0' : balance,
      currencyCode: policy.currencyCode,
      observedAt: finance.observedAt,
      sourceVersion: 1,
    },
    now,
  );
}
