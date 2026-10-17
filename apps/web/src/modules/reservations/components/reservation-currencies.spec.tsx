import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const list = vi.hoisted(() => vi.fn());
vi.mock('./travel-workflow-form', () => ({ travelRequest: list }));
import {
  loadReservationCurrencies,
  ReservationCurrencySelect,
} from './reservation-currencies';
beforeEach(() => list.mockReset());
it('reads every active master-data currency page and retains canonical codes separately from display symbols', async () => {
  list.mockResolvedValueOnce({
    data: [{ code: ' eur ', name: 'Euro' }],
    meta: { total: 3 },
  });
  list.mockResolvedValueOnce({
    data: [
      { code: 'USD', name: 'Dollar' },
      { code: 'EUR', name: 'Euro duplicate' },
    ],
    meta: { total: 3 },
  });
  const currencies = await loadReservationCurrencies('request');
  expect(currencies).toEqual([
    { code: 'EUR', name: 'Euro' },
    { code: 'USD', name: 'Dollar' },
  ]);
  expect(list.mock.calls.map(([path]) => path)).toEqual([
    'reservations/requests/request/voucher-currencies?page=1',
    'reservations/requests/request/voucher-currencies?page=2',
  ]);
  const html = renderToStaticMarkup(
    <ReservationCurrencySelect
      value="EUR"
      currencies={currencies}
      disabled={false}
      label="Currency"
      onChange={vi.fn()}
    />,
  );
  expect(html).toContain('value="EUR"');
  expect(html).toContain('€');
  expect(html).not.toContain('maxlength="3"');
});
it('preserves a saved inactive currency without inventing new directory options', () => {
  const html = renderToStaticMarkup(
    <ReservationCurrencySelect
      value="GBP"
      currencies={[{ code: 'EUR', name: 'Euro' }]}
      disabled
      label="Currency"
      onChange={vi.fn()}
    />,
  );
  expect(html).toContain('value="GBP"');
  expect(html).toContain('£');
  expect(html).not.toContain('value="USD"');
  expect(html).toContain('disabled');
});
it('does not substitute a hardcoded currency list when the directory fails', async () => {
  list.mockRejectedValueOnce(new Error('unavailable'));
  await expect(loadReservationCurrencies('request')).rejects.toThrow(
    'unavailable',
  );
});
