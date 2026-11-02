import {
  readLegacyServiceParties,
  hotelNights,
  reservationServicePurchaseTotal,
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
  if (intake.supplierDocumentKind && intake.supplierDocumentKind !== 'HOTEL') {
    const settings = intake.workflow.supplierFormSettings;
    const price = settings?.supplierFormPrices?.transferPp;
    const count =
      (settings?.hotelTransferCounts?.outbound ?? 0) +
      (settings?.hotelTransferCounts?.returning ?? 0);
    let total = '-';
    try {
      if (price) {
        reservationServicePurchaseTotal(price.amount, '1', 1);
        total = count
          ? reservationServicePurchaseTotal(price.amount, String(count), 1)
          : '0';
      }
    } catch {
      /* Incomplete quotation. */
    }
    return {
      headers: ['Transfer P.P', 'QUANTITY', 'TRANSFER TOTAL'],
      values: [
        price ? price.amount + ' ' + price.currencyCode : '-',
        String(count),
        price ? total + ' ' + price.currencyCode : '-',
      ],
      rows: [
        [
          price ? price.amount + ' ' + price.currencyCode : '-',
          String(count),
          price ? total + ' ' + price.currencyCode : '-',
        ],
      ],
    };
  }
  const counts = supplierTransferCounts(intake);
  const settings = intake.workflow.supplierFormSettings;
  const prices = settings?.supplierFormPrices;
  if (settings?.hotelRoomPrices) {
    const quotation = settings.hotelRoomPrices;
    let nights = 0;
    try {
      nights = hotelNights(
        settings.text.checkIn ||
          intake.snapshot.hotelSelection?.checkInDate ||
          '',
        settings.text.checkOut ||
          intake.snapshot.hotelSelection?.checkOutDate ||
          '',
      );
    } catch {
      /* Never guess invalid stay length. */
    }
    const rows = quotation.rooms.map((price) => {
      let amount = '-';
      try {
        amount = reservationServicePurchaseTotal(
          price.baseAmount,
          price.factor,
          nights,
        );
      } catch {
        /* Unavailable quote. */
      }
      return [
        String(price.roomOrdinal),
        settings.rooms?.find((room) => room.ordinal === price.roomOrdinal)
          ?.roomTypeNameSnapshot ?? '-',
        price.baseAmount + ' ' + quotation.currencyCode,
        price.factor,
        String(nights || '-'),
        amount + ' ' + quotation.currencyCode,
      ];
    });
    const trf = prices?.transferPp;
    const transferCounts = settings.hotelTransferCounts ?? {
      outbound: counts.outbound ?? 0,
      returning: counts.returning ?? 0,
    };
    const count = transferCounts.outbound + transferCounts.returning;
    let total = '-';
    try {
      if (trf)
        total =
          count === 0
            ? '0'
            : reservationServicePurchaseTotal(trf.amount, String(count), 1);
    } catch {
      /* Unavailable quote. */
    }
    if (intake.supplierDocumentKind !== 'HOTEL')
      rows.push([
        'TRANSFER',
        'OUTBOUND: ' +
          transferCounts.outbound +
          ' / RETURN: ' +
          transferCounts.returning,
        trf ? trf.amount + ' ' + trf.currencyCode : '-',
        String(count),
        '-',
        trf ? total + ' ' + trf.currencyCode : '-',
      ]);
    return {
      headers: [
        'ROOM',
        'ROOM TYPE',
        intake.supplierDocumentKind === 'HOTEL'
          ? 'Hotel P.P'
          : 'Hotel P.P / Transfer P.P',
        intake.supplierDocumentKind === 'HOTEL' ? 'Ratio' : 'Ratio / COUNT',
        'NIGHTS',
        'PROPOSED PURCHASE',
      ],
      values: rows[0] ?? [],
      rows,
    };
  }
  const legacy = {
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
  return { ...legacy, rows: [legacy.values] };
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

/** Room defaults alone must not erase an existing legacy quotation. */
export function normalizeSupplierDraftPrices(
  draft: Pick<VoucherSettingsV1, 'hotelRoomPrices' | 'supplierFormPrices'>,
  currencies: Parameters<typeof normalizeSupplierFormPrices>[1],
) {
  return normalizeSupplierFormPrices(
    draft.hotelRoomPrices
      ? draft.supplierFormPrices?.transferPp
        ? { transferPp: draft.supplierFormPrices.transferPp }
        : {}
      : draft.supplierFormPrices,
    currencies,
  );
}
