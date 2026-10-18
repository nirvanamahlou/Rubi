import { moneyUnits } from './pricing';
import type { SalesServiceInput } from './index';
export const AGENCY_COMMISSION = 'agencyCommissionV1';
export interface AgencyCommissionV1 {
  adult: string;
  child: string;
}
/** Informational IRR amount per passenger; never an implicit discount. */
export function readAgencyCommission(
  services: readonly Pick<SalesServiceInput, 'metadata'>[],
): AgencyCommissionV1 | undefined {
  const sources = services.filter(
    (s) => s.metadata?.[AGENCY_COMMISSION] !== undefined,
  );
  if (!sources.length) return undefined;
  if (sources.length !== 1) throw Error('کمیسیون آژانس معتبر نیست.');
  const raw = sources[0]!.metadata![AGENCY_COMMISSION];
  if (typeof raw !== 'string' || raw.length > 200)
    throw Error('کمیسیون آژانس معتبر نیست.');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw Error('کمیسیون آژانس معتبر نیست.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('کمیسیون آژانس معتبر نیست.');
  const row = value as Record<string, unknown>;
  if (
    Object.keys(row).length !== 2 ||
    !['adult', 'child'].every(
      (k) =>
        typeof row[k] === 'string' &&
        /^\d+(?:\.\d{1,4})?$/.test(row[k] as string),
    )
  )
    throw Error('کمیسیون آژانس معتبر نیست.');
  for (const amount of [row.adult, row.child]) {
    try {
      moneyUnits(amount as string);
    } catch {
      throw Error('کمیسیون آژانس معتبر نیست.');
    }
  }
  return row as unknown as AgencyCommissionV1;
}
