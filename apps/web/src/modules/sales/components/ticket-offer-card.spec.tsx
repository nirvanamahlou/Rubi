import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { TicketOfferV1 } from '@rubi/contracts';
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
  it.each([true, false])(
    'shows both dates larger, bold and full-contrast (selected=%s)',
    (selected) => {
      const html = renderToStaticMarkup(
        <TicketOfferCard
          offer={offer}
          selected={selected}
          onSelect={vi.fn()}
        />,
      );
      const dates = html.match(/<time[^>]*>/g) ?? [];
      expect(dates).toHaveLength(2);
      for (const date of dates) {
        expect(date).toContain(
          'text-sm font-bold leading-relaxed sm:text-base',
        );
        expect(date).toContain('break-words');
        expect(date).not.toContain('opacity');
        expect(date).not.toContain('truncate');
      }
      expect(dates[0]).toContain(offer.departureAt);
      expect(dates[1]).toContain(offer.arrivalAt);
    },
  );
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
      'bg-blue-600',
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
