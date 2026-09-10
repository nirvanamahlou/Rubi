import {
  voucherTextKeys,
  voucherNumberKeys,
  voucherFlagKeys,
  type VoucherSettingsV1,
} from '@rubi/contracts';
export function validateVoucherSettings(
  value: unknown,
  passengerIds: readonly string[],
): VoucherSettingsV1 {
  const fail = (): never => {
    throw new Error('تنظیمات واچر معتبر نیست؛ فیلدها و مسافران را بررسی کنید.');
  };
  if (!value || typeof value !== 'object') return fail();
  const v = value as VoucherSettingsV1;
  if (!v.text || !v.numbers || !v.flags || !Array.isArray(v.passengers))
    return fail();
  for (const key of voucherTextKeys)
    if (
      typeof v.text[key] !== 'string' ||
      v.text[key].length >
        ([
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
    !v.passengers.some((p) => p.selected) ||
    v.passengers.some(
      (p) =>
        !p ||
        !passengerIds.includes(p.id) ||
        typeof p.selected !== 'boolean' ||
        typeof p.roomType !== 'string' ||
        p.roomType.length > 100 ||
        !['ADL', 'CHD', 'INF'].includes(p.age),
    )
  )
    return fail();
  for (const p of v.passengers) {
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
    text: Object.fromEntries(
      voucherTextKeys.map((k) => [k, v.text[k].trim()]),
    ) as VoucherSettingsV1['text'],
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
      age: p.age,
      sex: p.sex ?? '',
      birthDate: p.birthDate ?? '',
      documentNumber: p.documentNumber?.trim() ?? '',
    })),
  };
}
