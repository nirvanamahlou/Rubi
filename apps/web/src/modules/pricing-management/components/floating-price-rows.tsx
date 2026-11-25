import { moneyUnits, type FloatingTourSaleRow } from '@nora/contracts';
import { floatingFlightClock } from '@/modules/sales/model/floating-flight-times';

const groups = [
  ['double', 'دو تخته'],
  ['single', 'یک تخته'],
  ['extra', 'تخت اضافه'],
  ['childBed', 'کودک با تخت'],
  ['childNoBed', 'کودک بدون تخت'],
  ['infant', 'نوزاد'],
] as const;
export function FloatingPriceRows({
  rows,
  showSource = false,
  exactMoney = false,
}: {
  rows: FloatingTourSaleRow[];
  showSource?: boolean;
  exactMoney?: boolean;
}) {
  const amount = (items: { currency: string; amount: string }[] | undefined) =>
    items
      ?.map((m) => {
        if (exactMoney) return `${m.amount} ${m.currency}`;
        const unit = m.currency === 'IRR' ? 100000n : 10000n;
        const rounded = (moneyUnits(m.amount) + unit - 1n) / unit;
        return `${rounded.toLocaleString('en-US')} ${m.currency === 'IRR' ? 'IRT' : m.currency}`;
      })
      .join(' + ') || '—';
  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[1000px] text-sm">
        <thead>
          <tr>
            {[
              ...(showSource ? ['ردیف اکسل'] : []),
              'تاریخ حرکت',
              'تاریخ برگشت',
              'تعداد شب',
              'هتل و اتاق',
              ...groups.map((g) => g[1]),
              'کمیسیون',
            ].map((h) => (
              <th className="p-3" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr className="border-t" key={i}>
              {showSource && (
                <td className="p-3">{row.sourceRows.join('، ')}</td>
              )}
              <td className="p-3" dir="ltr">
                {row.startsOn ?? '—'}
              </td>
              <td className="p-3" dir="ltr">
                {row.endsOn ?? '—'}
              </td>
              <td>{row.nights}</td>
              <td>
                {row.stays.map((s) => (
                  <div key={s.hotelId}>
                    {s.hotelName} · {s.room} · {s.service} · {s.nights}
                  </div>
                ))}
                {row.flightSchedule && (
                  <div className="mt-2 space-y-1 text-xs">
                    {(
                      [
                        ['پرواز رفت', row.flightSchedule.outbound],
                        ['پرواز برگشت', row.flightSchedule.inbound],
                      ] as const
                    ).map(([label, leg]) => (
                      <div key={label}>
                        {label} · {leg.carrierName} · {leg.serviceNumber} ·{' '}
                        <bdi>
                          {leg.originAirport.code} →{' '}
                          {leg.destinationAirport.code}{' '}
                          {floatingFlightClock(leg.departureAt)}–
                          {floatingFlightClock(leg.arrivalAt)}
                        </bdi>
                      </div>
                    ))}
                  </div>
                )}
              </td>
              {groups.map(([g]) => (
                <td className="p-3" dir="ltr" key={g}>
                  {amount(row.prices[g])}
                </td>
              ))}
              <td dir="ltr">{amount(row.commission)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
