import {
  ticketOfferMatchesRoute,
  type TicketSaleRouteV1,
} from '@nora/contracts';
import type { TicketLayoutFlight } from '@/components/travel/flight-ticket-layout';
export type TicketDocumentFacts = Pick<
  TicketLayoutFlight,
  'originAirport' | 'destinationAirport' | 'baggageKg'
>;
type SavedOffer = Pick<
  TicketLayoutFlight,
  'originId' | 'destinationId' | 'cabinClassCode' | 'businessOutput'
> & { offerId?: string | undefined };
/** Selected airport geography is display-only; saved commercial route/time/class stay intact. */
export async function readTicketDocumentFacts(
  offers: readonly SavedOffer[],
  get: (path: string) => Promise<Response>,
): Promise<Record<string, TicketDocumentFacts>> {
  const facts: Record<string, TicketDocumentFacts> = {};
  const unique = [
    ...new Map(
      offers.filter((o) => o.offerId).map((o) => [o.offerId!, o]),
    ).values(),
  ];
  await Promise.all(
    unique.map(async (offer) => {
      try {
        const response = await get(
          `/ticket-catalog/offers/${encodeURIComponent(offer.offerId!)}/document-details`,
        );
        if (!response.ok) return;
        const { data } = (await response.json()) as {
          data?: {
            id: string;
            saleRoutes?: readonly TicketSaleRouteV1[];
            originId: string;
            destinationId: string;
            originAirportId?: string | null;
            destinationAirportId?: string | null;
            economyBaggageKg?: string | null;
            businessBaggageKg?: string | null;
          };
        };
        if (
          !data ||
          data.id !== offer.offerId ||
          !ticketOfferMatchesRoute(data, offer)
        )
          return;
        const airport = async (id: string | null | undefined) => {
          if (!id) return undefined;
          const result = await get(
            `/master-data/airports/${encodeURIComponent(id)}`,
          );
          if (!result.ok) return undefined;
          const { data: item } = (await result.json()) as {
            data?: {
              code: string;
              name: string;
              attributes: {
                cityId?: string;
                englishName?: string;
                iataCode?: string;
              };
            };
          };
          if (!item) return undefined;
          const cityId = item.attributes.cityId;
          let cityName: string | undefined;
          if (cityId) {
            const cityResponse = await get(
              `/master-data/cities/${encodeURIComponent(cityId)}`,
            ).catch(() => null);
            if (cityResponse?.ok) {
              const body = (await cityResponse.json().catch(() => null)) as {
                data?: {
                  id: string;
                  name: string;
                  attributes: { englishName?: string };
                };
              } | null;
              if (body?.data?.id === cityId)
                cityName = body.data.attributes.englishName || body.data.name;
            }
          }
          const iata = (item.attributes.iataCode || item.code)
            .trim()
            .toUpperCase();
          return {
            code: /^[A-Z]{3}$/.test(iata) ? iata : '—',
            name: item.attributes.englishName || item.name,
            ...(cityName ? { cityName } : {}),
          };
        };
        const [originAirport, destinationAirport] = await Promise.all([
          airport(data.originAirportId).catch(() => undefined),
          airport(data.destinationAirportId).catch(() => undefined),
        ]);
        facts[offer.offerId!] = {
          originAirport,
          destinationAirport,
          baggageKg:
            offer.businessOutput || offer.cabinClassCode === 'BUSINESS'
              ? data.businessBaggageKg
              : offer.cabinClassCode === 'ECONOMY'
                ? data.economyBaggageKg
                : null,
        };
      } catch {
        /* Optional metadata is never guessed if the authorized source is unavailable. */
      }
    }),
  );
  return facts;
}
