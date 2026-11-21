'use client';

import { useEffect, useState } from 'react';
import type {
  FloatingTourFlightInput,
  MasterDataRecord,
  TourPackageV1,
} from '@nora/contracts';
import { ContractFlightEditor } from '@/modules/sales/components/contract-flight-editor';
import { floatingFlightClock } from '@/modules/sales/model/floating-flight-times';
import type { ContractFlightDraft } from '@/modules/sales/model/sales-form';
import { listReferences } from '@/modules/ticket-catalog/api/references';

// The editor needs a civil day to edit clocks. The API attaches the real Excel dates.
const clockEditorDay = '2000-01-01';
export type FloatingPackageFlightDrafts = Partial<
  Record<'outbound' | 'inbound', ContractFlightDraft>
>;

export function packageFlightInput(
  draft?: ContractFlightDraft,
): FloatingTourFlightInput | undefined {
  if (
    draft?.confirmation !== 'saved' ||
    !draft.originAirport ||
    !draft.destinationAirport
  )
    return;
  return {
    departureClock: floatingFlightClock(draft.departureAt),
    arrivalClock: floatingFlightClock(draft.arrivalAt),
    carrierName: draft.carrierName.trim(),
    serviceNumber: draft.serviceNumber.trim(),
    cabinClassCode: draft.cabinClassCode,
    originAirport: draft.originAirport,
    destinationAirport: draft.destinationAirport,
  };
}

export function FloatingPackageFlights({
  tour,
  drafts,
  disabled,
  onChange,
}: {
  tour: TourPackageV1;
  drafts: FloatingPackageFlightDrafts;
  disabled: boolean;
  onChange: (
    direction: keyof FloatingPackageFlightDrafts,
    value: ContractFlightDraft | undefined,
  ) => void;
}) {
  const [references, setReferences] = useState<{
    cities: MasterDataRecord[];
    airlines: MasterDataRecord[];
  }>();
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    const load = async (resource: 'cities' | 'airlines') => {
      const records: MasterDataRecord[] = [];
      for (let page = 1; page <= 100; page++) {
        const response = await listReferences(
          resource,
          '',
          page,
          abort.signal,
          {},
          'sales',
        );
        records.push(...response.data);
        if (page * response.meta.pageSize >= response.meta.total)
          return records;
        if (!response.data.length) break;
      }
      throw new Error('دریافت مرجع اطلاعات پایه ممکن نشد.');
    };
    void Promise.all([load('cities'), load('airlines')])
      .then(([cities, airlines]) => {
        if (!abort.signal.aborted) setReferences({ cities, airlines });
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted && error instanceof Error)
          setError(error.message);
      });
    return () => abort.abort();
  }, []);
  const country = (id: string) =>
    String(
      references?.cities.find((city) => city.id === id)?.attributes.countryId ??
        '',
    );
  const stops = tour.details?.isCombined
    ? tour.details.destinations
    : undefined;
  const directions = [
    [
      'outbound',
      'پرواز رفت',
      tour.originId,
      stops?.[0]?.cityId ?? tour.destinationId,
    ],
    [
      'inbound',
      'پرواز برگشت',
      stops?.at(-1)?.cityId ?? tour.destinationId,
      tour.originId,
    ],
  ] as const;
  return (
    <div className="space-y-3">
      {error && <p role="alert">{error}</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {directions.map(([direction, label, origin, destination]) => (
          <fieldset
            key={direction}
            disabled={disabled || !references}
            className="min-w-0 space-y-2"
          >
            <legend className="font-semibold">{label}</legend>
            <ContractFlightEditor
              packagePricing
              flightDate={clockEditorDay}
              value={drafts[direction]}
              airlines={references?.airlines ?? []}
              originCityId={origin}
              destinationCityId={destination}
              originCountryId={country(origin)}
              destinationCountryId={country(destination)}
              onChange={(value) => onChange(direction, value)}
            />
          </fieldset>
        ))}
      </div>
    </div>
  );
}
