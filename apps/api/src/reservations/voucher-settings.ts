import {
  voucherTextKeys,
  voucherNumberKeys,
  voucherFlagKeys,
  type VoucherSettingsV1,
} from '@nora/contracts';
export function validateSupplierFormPrices(
  value: unknown,
): VoucherSettingsV1['supplierFormPrices'] {
  if (value === undefined) return undefined;
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.entries(value).some(
      ([key, price]) =>
        !['pp', 'ratio', 'transferPp'].includes(key) ||
        !price ||
        typeof price.amount !== 'string' ||
        !/^\d{1,18}(?:\.\d{1,4})?$/.test(price.amount) ||
        (key !== 'ratio' &&
          (typeof price.currencyCode !== 'string' ||
            !/^[A-Z]{3}$/.test(price.currencyCode))),
    )
  )
    throw new Error('جدول قیمت فرم رزرواسیون معتبر نیست.');
  return value as NonNullable<VoucherSettingsV1['supplierFormPrices']>;
}
export function validateVoucherSettings(
  value: unknown,
  passengerIds: readonly string[],
  allowEmptyPassengers = false,
): VoucherSettingsV1 {
  const fail = (): never => {
    throw new Error(
      'تنظیمات فرم رزواسیون یا واچر معتبر نیست؛ فیلدها و مسافران را بررسی کنید.',
    );
  };
  if (!value || typeof value !== 'object') return fail();
  const v = value as VoucherSettingsV1;
  try {
    validateSupplierFormPrices(v.supplierFormPrices);
  } catch {
    return fail();
  }
  if (
    v.hotelPurchasePrices !== undefined &&
    (!Array.isArray(v.hotelPurchasePrices) ||
      v.hotelPurchasePrices.length > 20 ||
      v.hotelPurchasePrices.some(
        (p) =>
          !p ||
          typeof p.amount !== 'string' ||
          !/^\d{1,18}(?:\.\d{1,4})?$/.test(p.amount) ||
          typeof p.currencyCode !== 'string' ||
          !/^[A-Z]{3}$/.test(p.currencyCode),
      ) ||
      new Set(v.hotelPurchasePrices.map((p) => p.currencyCode)).size !==
        v.hotelPurchasePrices.length)
  )
    return fail();
  if (
    v.rooms !== undefined &&
    (!Array.isArray(v.rooms) ||
      v.rooms.length > 50 ||
      v.rooms.some(
        (room, index) =>
          !room ||
          room.ordinal !== index + 1 ||
          typeof room.roomTypeNameSnapshot !== 'string' ||
          !room.roomTypeNameSnapshot.trim() ||
          room.roomTypeNameSnapshot.length > 240 ||
          !Number.isInteger(room.adults) ||
          room.adults < 1 ||
          room.adults > 20 ||
          !Array.isArray(room.childAges) ||
          room.childAges.length > 20 ||
          room.childAges.some(
            (age) => !Number.isInteger(age) || age < 0 || age >= 15,
          ),
      ))
  )
    return fail();
  if (!v.text || !v.numbers || !v.flags || !Array.isArray(v.passengers))
    return fail();
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    (v.brokerId !== undefined && !uuid.test(v.brokerId)) ||
    (v.leaderId !== undefined && (!v.brokerId || !uuid.test(v.leaderId))) ||
    (v.transferBrokerId !== undefined &&
      (!v.brokerId || !uuid.test(v.transferBrokerId))) ||
    (v.transferBrokerName !== undefined &&
      (typeof v.transferBrokerName !== 'string' ||
        v.transferBrokerName.length > 200)) ||
    (v.transferDetailsOverride !== undefined &&
      typeof v.transferDetailsOverride !== 'boolean')
  )
    return fail();
  if (
    v.text.contractPartyName !== undefined &&
    (typeof v.text.contractPartyName !== 'string' ||
      v.text.contractPartyName.length > 200)
  )
    return fail();
  for (const key of voucherTextKeys)
    if (
      typeof v.text[key] !== 'string' ||
      v.text[key].length >
        (key === 'transferBoard'
          ? 300
          : [
                'stayNotes',
                'remarks',
                'excursionDescription',
                'extraServices',
              ].includes(key)
            ? 500
            : 200)
    )
      return fail();
  for (const key of voucherNumberKeys)
    if (
      !Number.isSafeInteger(v.numbers[key]) ||
      v.numbers[key] < 0 ||
      v.numbers[key] > 1000
    )
      return fail();
  for (const key of voucherFlagKeys)
    if (typeof v.flags[key] !== 'boolean') return fail();
  for (const key of [
    'checkIn',
    'checkOut',
    'arrivalDate',
    'departureDate',
  ] as const)
    if (
      v.text[key] &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(v.text[key]) ||
        !Number.isFinite(Date.parse(v.text[key])) ||
        new Date(v.text[key]).toISOString().slice(0, 10) !== v.text[key])
    )
      return fail();
  if (v.text.checkIn && v.text.checkOut && v.text.checkOut <= v.text.checkIn)
    return fail();
  for (const key of ['arrivalTime', 'departureTime'] as const)
    if (v.text[key] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v.text[key]))
      return fail();
  if (v.text.website && !/^https?:\/\//i.test(v.text.website)) return fail();
  if (
    v.passengers.length !== passengerIds.length ||
    new Set(v.passengers.map((p) => p?.id)).size !== passengerIds.length ||
    (!(allowEmptyPassengers && passengerIds.length === 0) &&
      !v.passengers.some((p) => p.selected)) ||
    v.passengers.some(
      (p) =>
        !p ||
        !passengerIds.includes(p.id) ||
        typeof p.selected !== 'boolean' ||
        typeof p.roomType !== 'string' ||
        p.roomType.length > 100 ||
        !['ADL', 'CHD', 'INF'].includes(p.age) ||
        (p.age === 'CHD'
          ? p.selected
            ? !['CHD_2_TO_6', 'CHD_6_TO_12'].includes(p.hotelChildAgeBand ?? '')
            : ![undefined, '', 'CHD_2_TO_6', 'CHD_6_TO_12'].includes(
                p.hotelChildAgeBand,
              )
          : ![undefined, ''].includes(p.hotelChildAgeBand)),
    )
  )
    return fail();
  for (const p of v.passengers) {
    if (
      p.roomOrdinal !== undefined &&
      (!Number.isInteger(p.roomOrdinal) ||
        !v.rooms?.some((room) => room.ordinal === p.roomOrdinal))
    )
      return fail();
    if (
      p.services !== undefined &&
      (!p.services ||
        typeof p.services !== 'object' ||
        [
          'outboundFlight',
          'returnFlight',
          'outboundTransfer',
          'returnTransfer',
          'hotel',
        ].some(
          (key) =>
            typeof p.services?.[key as keyof NonNullable<typeof p.services>] !==
            'boolean',
        ))
    )
      return fail();
    if (p.sex !== undefined && !['MALE', 'FEMALE', ''].includes(p.sex))
      return fail();
    if (
      p.documentNumber !== undefined &&
      (typeof p.documentNumber !== 'string' || p.documentNumber.length > 100)
    )
      return fail();
    if (
      p.birthDate !== undefined &&
      (typeof p.birthDate !== 'string' ||
        (p.birthDate &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(p.birthDate) ||
            !Number.isFinite(Date.parse(p.birthDate)) ||
            new Date(p.birthDate).toISOString().slice(0, 10) !== p.birthDate)))
    )
      return fail();
  }
  return {
    ...(v.rooms !== undefined
      ? {
          rooms: v.rooms.map((room) => ({
            ordinal: room.ordinal,
            roomTypeNameSnapshot: room.roomTypeNameSnapshot.trim(),
            adults: room.adults,
            childAges: [...room.childAges],
          })),
        }
      : {}),
    ...(v.hotelPurchasePrices !== undefined
      ? {
          hotelPurchasePrices: v.hotelPurchasePrices.map((p) => ({
            amount: p.amount,
            currencyCode: p.currencyCode,
          })),
        }
      : {}),
    ...(v.supplierFormPrices !== undefined
      ? {
          supplierFormPrices: Object.fromEntries(
            Object.entries(v.supplierFormPrices).map(([key, price]) => [
              key,
              key === 'ratio'
                ? { amount: price.amount }
                : { amount: price.amount, currencyCode: price.currencyCode },
            ]),
          ),
        }
      : {}),
    ...(v.brokerId ? { brokerId: v.brokerId } : {}),
    ...(v.leaderId ? { leaderId: v.leaderId } : {}),
    ...(v.transferBrokerId ? { transferBrokerId: v.transferBrokerId } : {}),
    ...(v.transferBrokerName !== undefined
      ? { transferBrokerName: v.transferBrokerName.trim() }
      : {}),
    ...(v.transferDetailsOverride !== undefined
      ? { transferDetailsOverride: v.transferDetailsOverride }
      : {}),
    text: {
      ...(Object.fromEntries(
        voucherTextKeys.map((k) => [k, v.text[k].trim()]),
      ) as VoucherSettingsV1['text']),
      ...(v.text.contractPartyName !== undefined
        ? { contractPartyName: v.text.contractPartyName.trim() }
        : {}),
    },
    numbers: Object.fromEntries(
      voucherNumberKeys.map((k) => [k, v.numbers[k]]),
    ) as VoucherSettingsV1['numbers'],
    flags: Object.fromEntries(
      voucherFlagKeys.map((k) => [k, v.flags[k]]),
    ) as VoucherSettingsV1['flags'],
    passengers: v.passengers.map((p) => ({
      id: p.id,
      selected: p.selected,
      roomType: p.roomType.trim(),
      ...(p.roomOrdinal !== undefined ? { roomOrdinal: p.roomOrdinal } : {}),
      ...(p.services !== undefined
        ? {
            services: {
              outboundFlight: p.services.outboundFlight,
              returnFlight: p.services.returnFlight,
              outboundTransfer: p.services.outboundTransfer,
              returnTransfer: p.services.returnTransfer,
              hotel: p.services.hotel,
            },
          }
        : {}),
      age: p.age,
      hotelChildAgeBand: p.hotelChildAgeBand ?? '',
      sex: p.sex ?? '',
      birthDate: p.birthDate ?? '',
      documentNumber: p.documentNumber?.trim() ?? '',
    })),
  };
}
