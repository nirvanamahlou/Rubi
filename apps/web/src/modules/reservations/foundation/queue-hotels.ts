import type { RequestView } from './model';

type HotelRow = Pick<RequestView, 'hotelId' | 'hotelName' | 'hotels'>;

export function queueHotels(row: HotelRow) {
  return row.hotels?.length
    ? row.hotels
    : row.hotelId || row.hotelName
      ? [{ hotelId: row.hotelId, name: row.hotelName ?? '' }]
      : [];
}

/** Resolve each itinerary stop independently; an unavailable lookup keeps its snapshot. */
export function queueHotelName(
  row: HotelRow,
  names: Readonly<Record<string, string>> = {},
) {
  return (
    queueHotels(row)
      .map((hotel) => (names[`hotels:${hotel.hotelId}`] || hotel.name).trim())
      .filter(Boolean)
      .join(' / ') ||
    row.hotelName ||
    ''
  );
}
