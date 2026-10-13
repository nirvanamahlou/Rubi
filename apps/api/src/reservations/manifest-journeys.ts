import { createHash } from 'node:crypto';
import type {
  ReservationIntakeV1,
  SalesTicketSelectionInput,
} from '@nora/contracts';

export type ManifestJourney = SalesTicketSelectionInput & {
  transportType: 'FLIGHT' | 'BUS' | 'TRAIN';
  departureTimeKnown?: boolean;
  originName?: string;
  destinationName?: string;
};

/** Ground service identity is contract-scoped unless Sales supplies a shared reference. */
export function manifestJourneys(
  snapshot: ReservationIntakeV1['snapshot'],
): ManifestJourney[] {
  const journeys: ManifestJourney[] = (snapshot.ticketSelections ?? []).map(
    (ticket) => ({ ...ticket, transportType: 'FLIGHT' }),
  );
  for (const service of snapshot.serviceSelections ?? []) {
    if (service.kind !== 'BUS' && service.kind !== 'TRAIN') continue;
    const m = service.metadata ?? {};
    const text = (key: string) =>
      typeof m[key] === 'string' ? (m[key] as string).trim() : '';
    let departureAt = text('departureAt');
    const departureTimeKnown = Boolean(departureAt);
    if (!departureAt) {
      const date = text('date');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const day = new Date(date + 'T00:00:00Z');
      if (Number.isNaN(day.valueOf()) || !day.toISOString().startsWith(date))
        continue;
      departureAt = date + 'T00:00:00+03:30';
    }
    if (Number.isNaN(Date.parse(departureAt))) continue;
    const originId = text('originId');
    const destinationId = text('destinationId');
    const originName = text('pickup');
    const destinationName = text('dropoff');
    if ((!originId && !originName) || (!destinationId && !destinationName))
      continue;
    const carrierNameSnapshot = text('carrierName') || service.titleSnapshot;
    const serviceNumberSnapshot = text('serviceNumber');
    const cabinClassCode = text('cabinClass') || text('vehicleType');
    const direction = text('direction') === 'RETURN' ? 'RETURN' : 'OUTBOUND';
    const identity = JSON.stringify([
      service.kind,
      service.clientKey,
      service.referenceId || [snapshot.contractId, service.clientKey],
      direction,
      originId,
      destinationId,
      originName,
      destinationName,
      new Date(departureAt).toISOString(),
      carrierNameSnapshot,
      serviceNumberSnapshot,
      cabinClassCode,
    ]);
    journeys.push({
      transportType: service.kind,
      departureTimeKnown,
      serviceClientKey: service.clientKey,
      offerId: 'ground-' + createHash('sha256').update(identity).digest('hex'),
      direction,
      originId,
      destinationId,
      originName,
      destinationName,
      departureAt,
      arrivalAt:
        text('arrivalAt') && !Number.isNaN(Date.parse(text('arrivalAt')))
          ? text('arrivalAt')
          : departureAt,
      carrierNameSnapshot,
      serviceNumberSnapshot,
      cabinClassCode,
    });
  }
  return journeys;
}
