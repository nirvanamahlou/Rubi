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
  status: 'ACTIVE',
};
describe('readable sales ticket card', () => {
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
    expect(html).not.toContain('ظرفیت باقی');
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
});
