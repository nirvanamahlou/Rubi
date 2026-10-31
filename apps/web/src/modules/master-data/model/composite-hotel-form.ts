import type { MasterDataRecord } from '@nora/contracts';

export interface CompositeHotelRow {
  key: string;
  cityId: string;
  hotelId: string;
}

export function compositeHotelRows(
  record?: MasterDataRecord,
): CompositeHotelRow[] {
  try {
    const members: unknown = JSON.parse(
      String(record?.attributes.memberHotels ?? '[]'),
    );
    if (Array.isArray(members) && members.length)
      return members.map(
        (member: { cityId?: string; hotelId?: string }, index) => ({
          key: `existing-${index}`,
          cityId: member.cityId ?? '',
          hotelId: member.hotelId ?? '',
        }),
      );
  } catch {
    /* Older records are restored from their compatible ID projection. */
  }
  const ids = String(record?.attributes.memberHotelIds ?? '')
    .split(',')
    .filter(Boolean);
  return ids.length
    ? ids.map((hotelId, index) => ({
        key: `existing-${index}`,
        cityId: String(record?.attributes.cityId ?? ''),
        hotelId,
      }))
    : [{ key: 'initial', cityId: '', hotelId: '' }];
}

export function compositeHotelValues(
  name: string,
  rows: readonly CompositeHotelRow[],
) {
  if (!name.trim() || name.trim().length > 160)
    throw new Error('عنوان را وارد کنید؛ حداکثر ۱۶۰ نویسه.');
  if (
    !rows.length ||
    rows.length > 50 ||
    rows.some((row) => !row.cityId || !row.hotelId)
  )
    throw new Error('برای هر ردیف شهر و هتل را انتخاب کنید.');
  if (new Set(rows.map((row) => row.hotelId)).size !== rows.length)
    throw new Error('هر هتل را فقط یک بار انتخاب کنید.');
  return {
    name: name.trim(),
    cityId: rows[0]!.cityId,
    memberHotelIds: rows.map((row) => row.hotelId).join(','),
  };
}
