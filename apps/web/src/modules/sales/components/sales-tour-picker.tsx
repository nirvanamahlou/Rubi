'use client';
import { useEffect, useState } from 'react';
import type { MasterDataRecord, TourDepartureV1 } from '@rubi/contracts';
import { Button } from '@/components/ui';
import { toursApi } from '@/modules/ticket-catalog/api/tours';
import { masterDataApi } from '@/modules/master-data/api/client';
import { selectSalesInsurance } from '../model/sales-insurance';
import { withSalesHotelDates, type SalesFormState } from '../model/sales-form';

export function SalesTourPicker({
  state,
  cities,
  hotels,
  onChange,
}: {
  state: SalesFormState;
  cities: readonly MasterDataRecord[];
  hotels: readonly MasterDataRecord[];
  onChange: (state: SalesFormState) => void;
}) {
  const [rows, setRows] = useState<TourDepartureV1[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    void toursApi
      .departures()
      .then(({ data }) => {
        if (alive) setRows(data);
      })
      .catch((reason: unknown) => {
        if (alive)
          setError(
            reason instanceof Error ? reason.message : 'دریافت تور ناموفق بود.',
          );
      });
    return () => {
      alive = false;
    };
  }, []);
  const select = async (tour: TourDepartureV1) => {
    setBusy(true);
    setError('');
    try {
      const insurance = tour.package.insuranceId
        ? selectSalesInsurance(
            (
              await masterDataApi.detail(
                'insurance-plans',
                tour.package.insuranceId,
              )
            ).data,
          )
        : undefined;
      const hotel =
        tour.package.hotelIds.length === 1
          ? hotels.find((item) => item.id === tour.package.hotelIds[0])
          : undefined;
      onChange(
        withSalesHotelDates(state, {
          ...state,
          tour,
          originId: tour.package.originId,
          destinationId: tour.package.destinationId,
          originCountryId: String(
            cities.find((city) => city.id === tour.package.originId)?.attributes
              .countryId ?? '',
          ),
          destinationCountryId: String(
            cities.find((city) => city.id === tour.package.destinationId)
              ?.attributes.countryId ?? '',
          ),
          serviceKinds: [
            'FLIGHT',
            ...(tour.package.hotelIds.length ? ['HOTEL' as const] : []),
            ...(insurance ? ['INSURANCE' as const] : []),
            ...(tour.package.visa ? ['VISA' as const] : []),
            ...(tour.package.transferOutbound || tour.package.transferReturn
              ? ['TRANSFER' as const]
              : []),
          ],
          serviceDirections: {
            FLIGHT: tour.returning ? ['OUTBOUND', 'RETURN'] : ['OUTBOUND'],
            TRANSFER: [
              ...(tour.package.transferOutbound ? ['OUTBOUND' as const] : []),
              ...(tour.package.transferReturn ? ['RETURN' as const] : []),
            ],
          },
          tripType: tour.returning ? 'ROUND_TRIP' : 'ONE_WAY',
          departureDate: tour.startsOn,
          returnDate: tour.endsOn,
          outboundOffer: tour.outbound,
          returnOffer: tour.returning,
          contractFlights: {},
          insurancePlan: insurance,
          ticket: {
            ...state.ticket,
            outboundOfferId: tour.outbound.id,
            outboundDepartureAt: tour.outbound.departureAt,
            outboundArrivalAt: tour.outbound.arrivalAt,
            outboundNumber: tour.outbound.serviceNumber,
            carrier: tour.outbound.carrierName,
            cabinClassCode: tour.outbound.cabinClassCode,
            returnOfferId: tour.returning?.id ?? '',
            returnDepartureAt: tour.returning?.departureAt ?? '',
            returnArrivalAt: tour.returning?.arrivalAt ?? '',
            returnNumber: tour.returning?.serviceNumber ?? '',
          },
          hotel: {
            ...state.hotel,
            hotelId: hotel?.id ?? '',
            name: hotel?.name ?? '',
            checkInManual: false,
            checkOutManual: false,
          },
          servicePricing: {},
        }),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'انتخاب تور ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-bold">انتخاب نوبت تور</h3>
      <input
        aria-label="جست‌وجوی تور"
        className="h-10 w-full rounded-xl border px-3"
        placeholder="نام تور…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      {rows
        .filter((row) => row.package.name.includes(search))
        .map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
          >
            <div>
              <strong>{row.package.name}</strong>
              <p>
                <bdi>{row.startsOn}</bdi> تا <bdi>{row.endsOn}</bdi> ·{' '}
                {row.remainingCapacity} صندلی
              </p>
            </div>
            <Button
              disabled={
                busy ||
                row.remainingCapacity <
                  state.passengerComposition.adults +
                    state.passengerComposition.children
              }
              onClick={() => void select(row)}
            >
              انتخاب تور
            </Button>
          </div>
        ))}
      {!rows.length && !error && (
        <p>نوبت توری برای فروش یافت نشد؛ ابتدا در مدیریت بلیت تعریف کنید.</p>
      )}
    </section>
  );
}
