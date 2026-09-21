import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import {
  TicketOfferCard,
  ticketDisplayTime,
  ticketDuration,
} from './ticket-offer-card';

const offer: TicketOfferV1 = {
  id: 'synthetic',
  version: 1,
  branchId: 'test',
  originId: 'origin',
  destinationId: 'destination',
  departureAt: '2026-09-10T20:00:00Z',
  arrivalAt: '2026-09-10T23:15:00Z',
  carrierName: 'Test Airline',
  serviceNumber: 'TEST-1',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 20,
  remainingCapacity: 12,
  status: 'ACTIVE',
};
describe('readable sales ticket card', () => {
  it('keeps standalone fare validation and shows an available fare', () => {
    const render = (value: TicketOfferV1) =>
      renderToStaticMarkup(
        <TicketOfferCard
          offer={value}
          selected={false}
          requireStandaloneFare
          onSelect={vi.fn()}
        />,
      );
    expect(render(offer)).toContain('disabled=""');
    expect(render(offer)).toContain('قیمت فروش تکی ثبت نشده');
    const priced = render({
      ...offer,
      standaloneSalePrice: {
        amount: '2500000',
        currencyCode: 'IRR',
        revision: 1,
      },
    });
    expect(priced).not.toContain('disabled=""');
    expect(priced).toContain('2500000 IRR');
  });
  it.each([true, false])(
    'shows travel dates prominently beside the airline (selected=%s)',
    (selected) => {
      const html = renderToStaticMarkup(
        <TicketOfferCard
          offer={offer}
          selected={selected}
          onSelect={vi.fn()}
        />,
      );
      const dateGroup = html.match(
        /<span data-ticket-meta="travel-dates"[^>]*>/,
      )?.[0];
      expect(dateGroup).toContain('text-lg');
      expect(dateGroup).toContain('font-extrabold');
      expect(dateGroup).toContain('text-primary');
      const dates = html.match(/<time[^>]*>/g) ?? [];
      expect(dates).toHaveLength(2);
      expect(dates[0]).toContain(offer.departureAt);
      expect(dates[1]).toContain(offer.arrivalAt);
    },
  );
  it('keeps departure and arrival times smaller at opposite card edges', () => {
    const html = renderToStaticMarkup(
      <TicketOfferCard offer={offer} selected={false} onSelect={vi.fn()} />,
    );
    const departureTime = html.match(
      /<strong dir="ltr" data-ticket-time="departure"[^>]*>/,
    )?.[0];
    const arrivalTime = html.match(
      /<strong dir="ltr" data-ticket-time="arrival"[^>]*>/,
    )?.[0];
    for (const time of [departureTime, arrivalTime]) {
      expect(time).toContain('text-base');
      expect(time).toContain('text-muted-foreground');
      expect(time).not.toContain('text-2xl');
    }
    expect(departureTime).toContain('text-start');
    expect(arrivalTime).toContain('text-end');
    expect(html).toContain(
      'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]',
    );
  });
  it('separates departure and arrival with the actual route and selected state', () => {
    const html = renderToStaticMarkup(
      <TicketOfferCard
        offer={offer}
        selected
        onSelect={vi.fn()}
        originLabel="تهران"
        destinationLabel="آنتالیا"
      />,
    );
    for (const text of [
      'تهران',
      'آنتالیا',
      'حرکت',
      'رسیدن',
      'Test Airline',
      'TEST-1',
      'انتخاب‌شده',
      'ظرفیت کل',
      'aria-pressed="true"',
      'ring-primary/20',
      'مدت پرواز:',
      'ساعت‌ها به وقت تهران',
    ])
      expect(html).toContain(text);
    expect(html).toContain('مانده');
    expect(html).not.toContain('قیمت');
  });
  it('uses fixed Tehran times without seconds and shows overnight arrival date', () => {
    expect(ticketDisplayTime(offer.departureAt).time).toBe('۲۳:۳۰');
    expect(ticketDisplayTime(offer.arrivalAt).time).toBe('۰۲:۴۵');
    expect(ticketDisplayTime(offer.departureAt).date).not.toBe(
      ticketDisplayTime(offer.arrivalAt).date,
    );
    expect(ticketDuration(offer)).toBe('۳ ساعت و ۱۵ دقیقه');
  });
  it('keeps an unselected offer keyboard selectable and real cabin unchanged', () => {
    const html = renderToStaticMarkup(
      <TicketOfferCard offer={offer} selected={false} onSelect={vi.fn()} />,
    );
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('اکونومی');
    expect(html).not.toContain('بیزینس');
  });
  it('disables an offer whose remaining seats are below the passenger count', () => {
    const html = renderToStaticMarkup(
      <TicketOfferCard
        offer={{ ...offer, remainingCapacity: 2 }}
        selected={false}
        requiredSeats={3}
        onSelect={vi.fn()}
      />,
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain('برای ۳ صندلی کافی نیست');
  });
});
