import type { TicketOfferV1 } from '@nora/contracts';
import { ArrowLeft } from 'lucide-react';
import { ticketCabinLabel } from '@/modules/sales/model/ticket-price-rows';
import { pricingFlightDate } from '@/modules/sales/model/ticket-pricing-display';
import styles from './site-management.module.css';
const time = new Intl.DateTimeFormat('fa-IR', {
  timeZone: 'Asia/Tehran',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
function Leg({
  offer,
  direction,
  cityCountries,
}: {
  offer: TicketOfferV1;
  direction: string;
  cityCountries: Record<string, string>;
}) {
  return (
    <div className={styles.leg}>
      <span className={styles.direction}>{direction}</span>
      <strong>
        {offer.carrierName} · <bdi>{offer.serviceNumber}</bdi> ·{' '}
        {ticketCabinLabel(offer.cabinClassCode)}
      </strong>
      <time dateTime={offer.departureAt}>
        <bdi>{pricingFlightDate(offer, cityCountries, true)}</bdi>
      </time>
      <small>
        <span>ساعت رسیدن</span>:{' '}
        <bdi>{time.format(new Date(offer.arrivalAt))}</bdi>
        {' · '}
        <span>ظرفیت کلاس:</span> {offer.totalCapacity.toLocaleString('fa-IR')} ·
        مانده: {offer.remainingCapacity.toLocaleString('fa-IR')}
      </small>
    </div>
  );
}
export function SiteTicketFacts({
  offer,
  tickets,
  cities,
  cityCountries = {},
}: {
  offer: TicketOfferV1;
  tickets: TicketOfferV1[];
  cities: Record<string, string>;
  cityCountries?: Record<string, string>;
}) {
  const pairs =
    offer.baseRoundTripSalePrices ?? offer.roundTripSalePrices ?? [];
  const returning = [...new Set(pairs.map((p) => p.returnOfferId))].flatMap(
    (id) => {
      const row = tickets.find((t) => t.id === id);
      return row ? [row] : [];
    },
  );
  return (
    <div>
      <h2 className={styles.route}>
        <small>مبدأ</small>
        <bdi>{cities[offer.originId] ?? offer.originId}</bdi>
        <ArrowLeft size={14} aria-hidden="true" />
        <small>مقصد</small>
        <bdi>{cities[offer.destinationId] ?? offer.destinationId}</bdi>
      </h2>
      <div className={styles.legs}>
        <Leg
          offer={offer}
          direction={returning.length ? 'رفت' : 'پرواز'}
          cityCountries={cityCountries}
        />
        {returning.map((row) => (
          <Leg
            key={row.id}
            offer={row}
            direction="برگشت"
            cityCountries={cityCountries}
          />
        ))}
      </div>
    </div>
  );
}
