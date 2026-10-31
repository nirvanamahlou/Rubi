import {
  readLegacyServiceParties,
  type VoucherSettingsV1,
} from '@nora/contracts';
import type { ReservationFormIntake } from './reservation-form';
import { supplierFormData } from './voucher-settings';
import { reservationFormPriceText } from './reservation-form-price';
export const supplierPriceColumns = [
  { key: 'pp', label: 'Hotel P.P' },
  { key: 'ratio', label: 'Ratio' },
  { key: 'transferPp', label: 'Transfer P.P' },
] as const;

export function supplierTransferCounts(intake: ReservationFormIntake) {
  if (intake.workflow.supplierFormSettings?.flags.transfer === false)
    return { outbound: 0, returning: 0 };
  const passengers = supplierFormData(intake).passengers;
  const services = intake.snapshot.serviceSelections;
  const parties = readLegacyServiceParties(services);
  const count = (direction: 'OUTBOUND' | 'RETURN') => {
    const transfers = services.filter(
      (service) =>
        service.kind === 'TRANSFER' &&
        (service.metadata?.direction === direction ||
          service.clientKey ===
            (direction === 'OUTBOUND'
              ? 'transfer-outbound'
              : 'transfer-return')),
    );
    if (passengers.length) {
      const selected = passengers.filter(
        (person) =>
          person.age !== 'INF' &&
          (direction === 'OUTBOUND'
            ? person.outboundTransfer
            : person.returnTransfer),
      ).length;
      const declared = transfers
        .map((service) => service.metadata?.passengerCount)
        .filter(
          (value): value is number =>
            typeof value === 'number' &&
            Number.isSafeInteger(value) &&
            value >= 0,
        );
      return declared.length
        ? Math.min(selected, Math.max(...declared))
        : selected;
    }
    if (!transfers.length) return 0;
    const counts = transfers.map((service) => {
      const party = parties?.[service.clientKey];
      if (party) return party.adults + party.children;
      const value = service.metadata?.passengerCount;
      return typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value >= 0
        ? value
        : null;
    });
    return counts.some((value) => value === null)
      ? null
      : Math.max(...(counts as number[]));
  };
  return { outbound: count('OUTBOUND'), returning: count('RETURN') };
}
export function supplierPriceTableData(intake: ReservationFormIntake) {
  const counts = supplierTransferCounts(intake);
  const prices = intake.workflow.supplierFormSettings?.supplierFormPrices;
  return {
    headers: [
      'Hotel P.P',
      'Ratio',
      `Transfer P.P (OUTBOUND: ${counts.outbound ?? '-'} / RETURN: ${counts.returning ?? '-'})`,
    ],
    values: supplierPriceColumns.map(({ key }) =>
      prices?.[key]
        ? key === 'ratio'
          ? prices.ratio!.amount
          : reservationFormPriceText(
              [prices[key] as { amount: string; currencyCode: string }],
              'code',
            )
        : '-',
    ),
  };
}
/** Blank columns are omitted; partially entered money/currency is never silently lost. */
export function normalizeSupplierFormPrices(
  prices: VoucherSettingsV1['supplierFormPrices'],
  currencies: readonly { code: string }[],
) {
  return Object.fromEntries(
    supplierPriceColumns.flatMap(({ key }) => {
      const price = prices?.[key];
      if (
        !price ||
        (!price.amount.trim() && (key === 'ratio' || !price.currencyCode))
      )
        return [];
      if (
        !/^\d{1,18}(?:\.\d{1,4})?$/.test(price.amount) ||
        (key !== 'ratio' &&
          !currencies.some((currency) => currency.code === price.currencyCode))
      )
        throw Error('مبلغ و ارز هر ستون قیمت را کامل و از فهرست انتخاب کنید.');
      return [[key, key === 'ratio' ? { amount: price.amount } : { ...price }]];
    }),
  );
}
