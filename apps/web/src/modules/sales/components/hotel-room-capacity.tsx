import {
  hotelLargestCombinations,
  hotelRoomCapacityCombinations,
  type HotelRoomRateV1,
} from '@nora/contracts';

export function HotelRoomCapacity({ room }: { room: HotelRoomRateV1 }) {
  const { total, combinations } = hotelLargestCombinations(
    hotelRoomCapacityCombinations(room),
  );
  return (
    <div className="space-y-1 rounded-lg border border-border bg-surface p-3 text-sm">
      <p>
        <strong>{room.roomTypeName}</strong> ·{' '}
        <span>بیشترین ظرفیت ثبت‌شده برای هر اتاق</span>:{' '}
        <bdi>{combinations.length ? total : '—'}</bdi> <span>نفر</span>
      </p>
      {combinations.map((row, index) => (
        <p key={index} className="flex flex-wrap gap-1">
          <bdi>{row.adults}</bdi> <span>بزرگسال</span>
          {row.childAges.map((age, i) => (
            <span key={i}>
              {' '}
              + <span>۱ کودک</span> (<bdi>{age.min}</bdi>{' '}
              <span>تا کمتر از</span> <bdi>{age.maxExclusive}</bdi>{' '}
              <span>سال</span>)
            </span>
          ))}
        </p>
      ))}
      {!combinations.length && <p>ترکیب ظرفیت ثبت نشده است.</p>}
    </div>
  );
}
