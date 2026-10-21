import type { SalesContractCreateRequest, SalesServiceInput } from './index';
export interface SalesPassengerHotelStayV1 {
  checkInDate: string;
  checkOutDate: string;
  different: boolean;
}
export function readPassengerHotelStays(
  services: readonly Pick<SalesServiceInput, 'kind' | 'metadata'>[],
  shared?: { checkInDate: string; checkOutDate: string } | null,
): Record<string, SalesPassengerHotelStayV1> | null {
  const raw = services.find((s) => s.kind === 'HOTEL')?.metadata
    ?.passengerHotelStaysV1;
  if (raw === undefined) return null;
  if (typeof raw !== 'string' || raw.length > 100000)
    throw Error('تنظیمات اقامت مسافران معتبر نیست.');
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('تنظیمات اقامت مسافران معتبر نیست.');
  const valid = (d: unknown): d is string =>
    typeof d === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    Number.isFinite(Date.parse(d)) &&
    new Date(d).toISOString().slice(0, 10) === d;
  for (const stay of Object.values(value))
    if (
      !stay ||
      typeof stay !== 'object' ||
      !valid(stay.checkInDate) ||
      !valid(stay.checkOutDate) ||
      stay.checkOutDate <= stay.checkInDate ||
      typeof stay.different !== 'boolean'
    )
      throw Error('تاریخ اقامت مسافر معتبر نیست.');
  const stays = value as Record<string, SalesPassengerHotelStayV1>;
  return shared
    ? Object.fromEntries(
        Object.entries(stays).map(([id, stay]) => [
          id,
          stay.different ? stay : { ...stay, ...shared },
        ]),
      )
    : stays;
}
export function validatePassengerHotelStays(
  input: Pick<
    SalesContractCreateRequest,
    'services' | 'passengers' | 'hotelSelection'
  >,
) {
  const stays = readPassengerHotelStays(input.services);
  if (!stays) return;
  const hotel = input.hotelSelection;
  if (!hotel) throw Error('اقامت بدون هتل معتبر نیست.');
  const guests = input.passengers.filter((p) =>
    p.serviceClientKeys.includes(hotel.serviceClientKey),
  );
  if (
    Object.keys(stays).length !== guests.length ||
    Object.keys(stays).some((id) => !guests.some((p) => p.customerId === id))
  )
    throw Error('اقامت باید فقط برای مهمانان هتل ثبت شود.');
  for (const p of guests) {
    const stay = stays[p.customerId];
    if (!stay) throw Error('تاریخ اقامت مسافر ثبت نشده است.');
    if (
      !stay.different &&
      (stay.checkInDate !== hotel.checkInDate ||
        stay.checkOutDate !== hotel.checkOutDate)
    )
      throw Error('تاریخ اقامت پیش‌فرض با هتل یکسان نیست.');
  }
}
