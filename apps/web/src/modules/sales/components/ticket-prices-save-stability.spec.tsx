import * as React from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  saves: [] as (() => void)[],
  update: vi.fn(),
  offers: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const index = fixture.cursor++;
    if (!(index in fixture.values))
      fixture.values[index] =
        typeof initial === 'function' ? (initial as () => unknown)() : initial;
    return [
      fixture.values[index],
      (next: unknown) => {
        fixture.values[index] =
          typeof next === 'function'
            ? (next as (previous: unknown) => unknown)(fixture.values[index])
            : next;
      },
    ];
  },
}));
vi.mock('@/modules/ticket-catalog/api/tours', () => ({
  toursApi: { updateStandaloneSalePrice: fixture.update },
}));
vi.mock('../api/ticket-pricing-offers', () => ({
  loadTicketPricingOffers: fixture.offers,
}));
vi.mock('@/components/ui/button', () => ({
  Button: (props: Record<string, unknown>) => {
    if (
      canonicalTestTree(props.children as React.ReactNode) === 'ثبت قیمت پایه'
    )
      fixture.saves.push(props.onClick as () => void);
    const rest = { ...props };
    delete rest.loading;
    delete rest.asChild;
    return React.createElement(
      'button',
      rest,
      props.children as React.ReactNode,
    );
  },
}));
import { TicketPricesWorkspace } from './ticket-prices-workspace';
const offer = {
  id: 'first',
  version: 1,
  branchId: 'branch',
  originId: 'origin',
  destinationId: 'destination',
  carrierName: 'Air',
  serviceNumber: '100',
  cabinClassCode: 'ECONOMY',
  departureAt: '2099-01-01T10:00:00Z',
  arrivalAt: '2099-01-01T12:00:00Z',
  totalCapacity: 2,
  remainingCapacity: 2,
  status: 'ACTIVE',
  baseStandaloneSalePrice: { amount: '100', currencyCode: 'IRR', revision: 1 },
};
function render() {
  fixture.cursor = 0;
  fixture.saves = [];
  return renderToStaticMarkup(React.createElement(TicketPricesWorkspace));
}
it('retains the mounted list and unrelated drafts while refreshing saved base-price facts', async () => {
  const offers = [offer, { ...offer, id: 'second' }];
  fixture.values = [
    offers,
    [],
    '',
    '',
    {
      first: { amount: '200', currencyCode: 'IRR' },
      second: { amount: '333', currencyCode: 'IRR' },
    },
    {},
    ['IRR'],
    { origin: 'Origin', destination: 'Destination' },
    '',
    '',
    '',
    'ALL',
    '',
    '',
    '',
    '',
    { amount: '', currencyCode: 'IRR' },
    false,
    false,
    '',
    '',
    '',
    {},
  ];
  let finish!: (result: { data: typeof offers }) => void;
  fixture.update.mockResolvedValue({
    data: { revision: 2, amount: '200', currencyCode: 'IRR' },
  });
  fixture.offers.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  expect(render().match(/<article /g)).toHaveLength(2);
  fixture.saves[0]!();
  await vi.waitFor(() => expect(fixture.offers).toHaveBeenCalledOnce());
  const pendingHtml = render();
  expect(pendingHtml.match(/<article /g)).toHaveLength(2);
  expect(pendingHtml).toContain('value="333"');
  finish({
    data: [
      {
        ...offer,
        baseStandaloneSalePrice: {
          ...offer.baseStandaloneSalePrice,
          amount: '200',
          revision: 2,
        },
      },
      offers[1]!,
    ],
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const savedHtml = render();
  expect(savedHtml).toContain('ثبت شد');
  expect(savedHtml.match(/<article /g)).toHaveLength(2);
  expect(savedHtml).toContain('value="333"');
  expect(savedHtml).not.toContain('قیمت پایه ثبت شد؛');
}, 30000);
