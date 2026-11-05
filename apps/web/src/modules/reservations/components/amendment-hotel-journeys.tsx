'use client';
import { useEffect, useState } from 'react';
import {
  HOTEL_JOURNEYS,
  readHotelJourneys,
  salesContractFlights,
  ticketOfferMatchesRoute,
  type TicketSaleRouteV1,
  type SalesContractAmendmentV1,
  type MasterDataRecord,
  type HotelJourneyV1,
} from '@nora/contracts';
import { HotelJourneyEditor } from '@/modules/sales/components/hotel-journey-editor';
import { localizedFetch } from '@/i18n/localized-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';

export function AmendmentHotelJourneys({
  draft,
  refs,
  onChange,
}: {
  draft: SalesContractAmendmentV1;
  refs: Record<string, MasterDataRecord[]>;
  onChange: (patch: Partial<SalesContractAmendmentV1>) => void;
}) {
  const hotel = draft.hotelSelection;
  const returnFlight = salesContractFlights(
    draft.services,
    draft.ticketSelections,
  ).find((f) => f.direction === 'RETURN');
  const offerId = returnFlight?.offerId;
  const originId = returnFlight?.originId;
  const destinationId = returnFlight?.destinationId;
  const [returnAirport, setReturnAirport] = useState<{
    key: string;
    id: string;
  }>();
  const airportKey = `${offerId ?? ''}:${originId ?? ''}:${destinationId ?? ''}`;
  useEffect(() => {
    const base = getPublicApiBaseUrl();
    if (
      !base ||
      !offerId ||
      !originId ||
      !destinationId ||
      !hotel?.additionalStays?.length
    )
      return;
    const abort = new AbortController();
    void localizedFetch(
      `${base}/ticket-catalog/offers/${encodeURIComponent(offerId)}/document-details`,
      {
        credentials: 'include',
        cache: 'no-store',
        signal: abort.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) return;
        const { data } = (await response.json()) as {
          data?: {
            id: string;
            originId: string;
            destinationId: string;
            saleRoutes?: readonly TicketSaleRouteV1[];
            originAirportId?: string | null;
          };
        };
        if (
          !abort.signal.aborted &&
          data?.id === offerId &&
          data.originAirportId &&
          ticketOfferMatchesRoute(data, { originId, destinationId })
        )
          setReturnAirport({ key: airportKey, id: data.originAirportId });
      })
      .catch(() => undefined);
    return () => abort.abort();
  }, [
    offerId,
    originId,
    destinationId,
    airportKey,
    hotel?.additionalStays?.length,
  ]);
  if (!hotel?.additionalStays?.length) return null;
  const stays = [hotel, ...hotel.additionalStays];
  const journeys = readHotelJourneys(draft.services);
  const returnCity = returnFlight?.originId ?? draft.destinationId;
  const change = (fromId: string, value: HotelJourneyV1 | undefined) => {
    const next = [
      ...journeys.filter((j) => j.fromHotelId !== fromId),
      ...(value ? [value] : []),
    ];
    onChange({
      services: draft.services.map((service) => {
        if (service.clientKey !== hotel.serviceClientKey) return service;
        const metadata = { ...service.metadata };
        if (next.length) metadata[HOTEL_JOURNEYS] = JSON.stringify(next);
        else delete metadata[HOTEL_JOURNEYS];
        return { ...service, metadata };
      }),
    });
  };
  return (
    <div className="grid gap-4">
      <h3 className="font-bold">جابه‌جایی‌های اختیاری هتل‌ها</h3>
      {stays.map((stay, i) => {
        const next = stays[i + 1];
        return (
          <HotelJourneyEditor
            key={stay.hotelId}
            value={journeys.find(
              (j) =>
                j.fromHotelId === stay.hotelId &&
                j.toHotelId === (next?.hotelId ?? null),
            )}
            onChange={(value) => change(stay.hotelId, value)}
            fromHotelId={stay.hotelId}
            toHotelId={next?.hotelId ?? null}
            fromLabel={stay.hotelNameSnapshot}
            toLabel={next?.hotelNameSnapshot ?? 'فرودگاه بلیت برگشت'}
            originCityId={stay.cityId}
            destinationCityId={next?.cityId ?? returnCity}
            preferredAirportId={
              !next && returnAirport?.key === airportKey
                ? returnAirport.id
                : undefined
            }
            cities={refs.cities ?? []}
            airlines={refs.airlines ?? []}
            workflow="reservations"
            defaultDate={next?.checkInDate ?? stay.checkOutDate}
          />
        );
      })}
    </div>
  );
}
