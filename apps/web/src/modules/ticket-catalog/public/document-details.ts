import type { TicketLayoutFlight } from '@/components/travel/flight-ticket-layout';
export type TicketDocumentFacts = Pick<
  TicketLayoutFlight,
  'originAirport' | 'destinationAirport' | 'baggageKg'
>;
type SavedOffer = Pick<
  TicketLayoutFlight,
  'originId' | 'destinationId' | 'cabinClassCode' | 'businessOutput'
> & { offerId?: string | undefined };
/** Public catalog read adapter. Never replaces the contract's saved route/time/class. */
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
          data.originId !== offer.originId ||
          data.destinationId !== offer.destinationId
        )
          return;
        const airport = async (
          id: string | null | undefined,
          cityId: string,
        ) => {
          if (!id) return undefined;
          const result = await get(
            `/master-data/airports/${encodeURIComponent(id)}`,
          );
          if (!result.ok) return undefined;
          const { data: item } = (await result.json()) as {
            data?: {
              code: string;
              name: string;
              attributes: { cityId?: string; englishName?: string };
            };
          };
          if (!item || item.attributes.cityId !== cityId) return undefined;
          return {
            code: /^[A-Z]{3}$/.test(item.code) ? item.code : '—',
            name: item.attributes.englishName || item.name,
          };
        };
        const [originAirport, destinationAirport] = await Promise.all([
          airport(data.originAirportId, offer.originId).catch(() => undefined),
          airport(data.destinationAirportId, offer.destinationId).catch(
            () => undefined,
          ),
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
