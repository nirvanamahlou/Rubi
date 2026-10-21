import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const list = vi.hoisted(() => vi.fn());
const selector = vi.hoisted(() => ({
  props: undefined as
    | undefined
    | {
        options: { value: string; label: string; searchText?: string }[];
        onValueChange: (value: string) => void;
        optionLimit?: number;
      },
}));
vi.mock('@/components/ui/search-combobox', () => ({
  SearchCombobox: (
    props: NonNullable<typeof selector.props> & {
      value: string;
      disabled: boolean;
    },
  ) => {
    selector.props = props;
    return <input value={props.value} disabled={props.disabled} readOnly />;
  },
}));
vi.mock('./travel-workflow-form', () => ({ travelRequest: list }));
import {
  loadReservationCurrencies,
  ReservationCurrencySelect,
} from './reservation-currencies';
beforeEach(() => {
  list.mockReset();
  selector.props = undefined;
});
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
  const change = vi.fn();
  const html = renderToStaticMarkup(
    <ReservationCurrencySelect
      value="EUR"
      currencies={currencies}
      disabled={false}
      label="Currency"
      onChange={change}
    />,
  );
  expect(html).toContain('value="EUR"');
  expect(selector.props?.options).toEqual([
    { value: 'EUR', label: 'Euro · EUR (€)', searchText: 'Euro EUR' },
    { value: 'USD', label: 'Dollar · USD ($)', searchText: 'Dollar USD' },
  ]);
  selector.props!.onValueChange('USD');
  expect(change).toHaveBeenCalledWith('USD');
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
  expect(selector.props?.options.map((option) => option.value)).toEqual([
    'GBP',
    'EUR',
  ]);
  expect(selector.props?.options[0]?.label).toBe('£');
  expect(html).toContain('disabled');
});
it('passes Persian master-data currency labels and every option to the actual picker boundary', () => {
  const currencies = [
    { code: 'IRR', name: 'ریال' },
    { code: 'EUR', name: 'یورو' },
    { code: 'USD', name: 'دلار' },
    { code: 'GBP', name: 'پوند' },
    { code: 'AED', name: 'درهم' },
    { code: 'TRY', name: 'لیر' },
  ];
  renderToStaticMarkup(
    <ReservationCurrencySelect
      value=""
      currencies={currencies}
      disabled={false}
      label="ارز هتل"
      onChange={vi.fn()}
    />,
  );
  expect(selector.props?.options.map((option) => option.value)).toEqual([
    ...currencies.map((currency) => currency.code),
  ]);
  expect(selector.props?.options[0]?.label).toContain('ریال');
  expect(selector.props?.optionLimit).toBeGreaterThanOrEqual(currencies.length);
});
it('does not substitute a hardcoded currency list when the directory fails', async () => {
  list.mockRejectedValueOnce(new Error('unavailable'));
  await expect(loadReservationCurrencies('request')).rejects.toThrow(
    'unavailable',
  );
});
