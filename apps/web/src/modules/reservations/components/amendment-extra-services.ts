import type {
  SalesContractAmendmentV1,
  SalesServiceInput,
} from '@nora/contracts';

export const amendmentExtras = [
  { key: 'insurance', kind: 'INSURANCE', title: 'بیمه' },
  { key: 'city-tour', kind: 'OTHER', title: 'گشت شهری', role: 'CITY_TOUR' },
  { key: 'tour-guide', kind: 'OTHER', title: 'راهنما', role: 'TOUR_GUIDE' },
] as const;

function unusedKey(draft: SalesContractAmendmentV1, base: string) {
  let key = base;
  let suffix = 1;
  while (draft.services.some((s) => s.clientKey === key))
    key = `${base}-${suffix++}`;
  return key;
}

export function assignAmendmentExtra(
  draft: SalesContractAmendmentV1,
  customerId: string,
  key: string,
  checked: boolean,
): SalesContractAmendmentV1 {
  const extra = amendmentExtras.find((e) => e.key === key);
  if (!extra || !draft.passengers.some((p) => p.customerId === customerId))
    return draft;
  const existing = draft.services.find((s) =>
    extra.kind === 'INSURANCE'
      ? s.kind === 'INSURANCE'
      : s.metadata?.additionalServiceRole === extra.role ||
        s.clientKey === extra.key,
  );
  const service: SalesServiceInput = existing ?? {
    clientKey: unusedKey(draft, extra.key),
    kind: extra.kind,
    titleSnapshot: extra.title,
    ...('role' in extra
      ? { metadata: { additionalServiceRole: extra.role } }
      : {}),
  };
  return {
    ...draft,
    services:
      checked && !existing ? [...draft.services, service] : draft.services,
    passengers: draft.passengers.map((p) =>
      p.customerId === customerId
        ? {
            ...p,
            serviceClientKeys: checked
              ? [...new Set([...p.serviceClientKeys, service.clientKey])]
              : p.serviceClientKeys.filter((k) => k !== service.clientKey),
          }
        : p,
    ),
  };
}

export function addAmendmentHotel(
  draft: SalesContractAmendmentV1,
): SalesContractAmendmentV1 {
  if (draft.hotelSelection) return draft;
  const existing = draft.services.find((s) => s.kind === 'HOTEL');
  const key = existing?.clientKey ?? unusedKey(draft, 'amendment-hotel');
  const end = new Date(draft.departureDate + 'T12:00:00Z');
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    ...draft,
    services: existing
      ? draft.services
      : [
          ...draft.services,
          { clientKey: key, kind: 'HOTEL', titleSnapshot: 'هتل' },
        ],
    passengers: draft.passengers.map((p) => ({
      ...p,
      serviceClientKeys: [...new Set([...p.serviceClientKeys, key])],
    })),
    hotelSelection: {
      serviceClientKey: key,
      hotelId: '',
      hotelNameSnapshot: '',
      cityId: draft.destinationId,
      checkInDate: draft.departureDate,
      checkOutDate:
        draft.returnNotBefore && draft.returnNotBefore > draft.departureDate
          ? draft.returnNotBefore
          : end.toISOString().slice(0, 10),
      roomCount: 1,
      occupancy: Math.max(
        1,
        draft.passengers.filter((p) => p.ageCategory !== 'INF').length,
      ),
      roomTypeId: '',
      inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
    },
  };
}
