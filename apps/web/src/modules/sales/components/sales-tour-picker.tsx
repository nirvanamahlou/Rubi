'use client';
import { useEffect, useState } from 'react';
import type { MasterDataRecord, TourDepartureV1 } from '@nora/contracts';
import {
  SearchCombobox,
  type SearchOption,
} from '@/components/ui/search-combobox';
import { toursApi } from '@/modules/ticket-catalog/api/tours';
import { masterDataApi } from '@/modules/master-data/api/client';
import { selectSalesInsurance } from '../model/sales-insurance';
import { withSalesHotelDates, type SalesFormState } from '../model/sales-form';

export function SalesTourPicker({
  state,
  countries,
  cities,
  hotels,
  onChange,
}: {
  state: SalesFormState;
  countries: readonly MasterDataRecord[];
  cities: readonly MasterDataRecord[];
  hotels: readonly MasterDataRecord[];
  onChange: (state: SalesFormState) => void;
}) {
  const [rows, setRows] = useState<TourDepartureV1[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void toursApi
      .departures()
      .then(({ data }) => {
        if (alive) setRows(data);
      })
      .catch((reason: unknown) => {
        if (alive) {
          setRows([]);
          setError(
            reason instanceof Error ? reason.message : 'دریافت تور ناموفق بود.',
          );
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open]);
  const options = salesTourOptions(
    rows,
    state.passengerComposition.adults + state.passengerComposition.children,
  );
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
      const originCountryId = String(
        cities.find((city) => city.id === tour.package.originId)?.attributes
          .countryId ?? '',
      );
      const destinationCountryId = String(
        cities.find((city) => city.id === tour.package.destinationId)
          ?.attributes.countryId ?? '',
      );
      onChange(
        withSalesHotelDates(state, {
          ...state,
          tour,
          originId: tour.package.originId,
          destinationId: tour.package.destinationId,
          originCountryId,
          originCountryCode: String(
            countries.find((country) => country.id === originCountryId)
              ?.attributes.iso2Code ?? '',
          ),
          destinationCountryId,
          destinationCountryCode: String(
            countries.find((country) => country.id === destinationCountryId)
              ?.attributes.iso2Code ?? '',
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
      <SearchCombobox
        label="جست‌وجو و انتخاب تور"
        placeholder="انتخاب تور فعال…"
        value={state.tour?.id ?? ''}
        selectedLabel={state.tour?.package.name}
        options={loading || error ? [] : options}
        loading={loading}
        error={error || undefined}
        disabled={busy}
        onOpenChange={(next) => {
          if (next && !open) {
            setLoading(true);
            setError('');
          }
          setOpen(next);
        }}
        onValueChange={(id) => {
          const tour = rows.find((row) => row.id === id);
          if (
            tour &&
            options.some((option) => option.value === id && !option.disabled)
          )
            void select(tour);
        }}
      />
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

export function salesTourOptions(
  rows: readonly TourDepartureV1[],
  passengers: number,
): SearchOption[] {
  return rows
    .filter(
      (row) =>
        row.outbound.status === 'ACTIVE' &&
        (!row.returning || row.returning.status === 'ACTIVE'),
    )
    .map((row) => ({
      value: row.id,
      label:
        row.package.name +
        ' · ' +
        row.startsOn +
        ' تا ' +
        row.endsOn +
        ' · ' +
        row.remainingCapacity +
        ' صندلی',
      searchText: [row.package.details?.airlineName, row.outbound.carrierName]
        .filter(Boolean)
        .join(' '),
      disabled: row.remainingCapacity < passengers,
    }));
}
