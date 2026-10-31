'use client';
import { useCallback, useEffect, useState } from 'react';
import { toursApi } from '../api/tours';
import {
  TicketDatePicker,
  type TicketDatePickerProps,
} from './ticket-date-picker';

export function PackageTicketDatePicker({
  originId,
  destinationId,
  branchId,
  ...props
}: TicketDatePickerProps & {
  originId: string;
  destinationId: string;
  branchId: string;
}) {
  const [range, setRange] = useState({ start: '', end: '' });
  const [marks, setMarks] = useState<{ key: string; days: string[] }>({
    key: '',
    days: [],
  });
  const key = JSON.stringify([
    originId,
    destinationId,
    branchId,
    range.start,
    range.end,
  ]);
  const visibleRange = useCallback(
    (start: string, end: string) =>
      setRange((previous) =>
        previous.start === start && previous.end === end
          ? previous
          : { start, end },
      ),
    [],
  );
  useEffect(() => {
    let cancelled = false;
    if (!originId || !destinationId || !branchId || !range.start || !range.end)
      return;
    void toursApi
      .offers(originId, destinationId, range.start, range.end)
      .then((offers) => {
        if (cancelled) return;
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Tehran',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        setMarks({
          key,
          days: [
            ...new Set(
              offers
                .filter(
                  (offer) =>
                    offer.branchId === branchId && offer.status === 'ACTIVE',
                )
                .map((offer) => formatter.format(new Date(offer.departureAt))),
            ),
          ],
        });
      })
      .catch(() => {
        if (!cancelled) setMarks({ key, days: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [originId, destinationId, branchId, range.start, range.end, key]);
  return (
    <TicketDatePicker
      {...props}
      markedDates={marks.key === key ? marks.days : []}
      onVisibleRangeChange={visibleRange}
    />
  );
}
