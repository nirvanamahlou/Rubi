import { describe, expect, it, vi } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import { loadTourDepartureTickets } from './tour-departure-tickets';

const pack = {
  originId: 'tehran',
  destinationId: 'kish',
  branchId: 'niyayesh',
};
describe('dated tour inventory', () => {
  it('does not make an unbounded inventory request before dates are selected', async () => {
    const search = vi.fn().mockResolvedValue([]);
    expect(
      await loadTourDepartureTickets(
        pack,
        { start: '', end: '' },
        true,
        search,
      ),
    ).toEqual({ out: [], back: [] });
    expect(search).not.toHaveBeenCalled();
  });
  it('uses the selected outbound day and never queries a return for a one-way tour', async () => {
    const search = vi.fn().mockResolvedValue([]);
    await loadTourDepartureTickets(
      pack,
      { start: '2036-01-15', end: '2036-01-18' },
      false,
      search,
    );
    expect(search.mock.calls).toEqual([['tehran', 'kish', '2036-01-15']]);
  });
  it('uses the reverse route and selected return day, retaining only active tickets in the tour branch', async () => {
    const valid = {
      id: 'valid',
      branchId: 'niyayesh',
      status: 'ACTIVE',
    } as TicketOfferV1;
    const search = vi
      .fn()
      .mockResolvedValue([
        valid,
        { ...valid, id: 'paused', status: 'PAUSED' },
        { ...valid, id: 'foreign', branchId: 'hq' },
      ]);
    expect(
      await loadTourDepartureTickets(
        pack,
        { start: '2036-01-15', end: '2036-01-18' },
        true,
        search,
      ),
    ).toEqual({ out: [valid], back: [valid] });
    expect(search.mock.calls).toEqual([
      ['tehran', 'kish', '2036-01-15'],
      ['kish', 'tehran', '2036-01-18'],
    ]);
  });
});
