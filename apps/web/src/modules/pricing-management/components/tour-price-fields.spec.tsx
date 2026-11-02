import { isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { tourPriceFields, type PackageTourPriceFieldV1 } from '@nora/contracts';
import { canonicalTestTree } from '@/i18n/test-tree';
import { TourPriceFields } from './tour-price-fields';

const currencies = [
  { code: 'IRR', name: 'ریال' },
  { code: 'GBP', name: 'پوند' },
];

it('keeps every price-field delete icon readable without a solid red background', () => {
  const html = renderToStaticMarkup(
    <TourPriceFields value={tourPriceFields()} onChange={vi.fn()} />,
  );
  const buttons = [
    ...html.matchAll(/<button\b[^>]*aria-label="حذف فیلد[^>]*>/g),
  ];
  expect(buttons).toHaveLength(5);
  for (const [button] of buttons) {
    expect(button).toContain('bg-transparent');
    expect(button).toContain('text-destructive');
    expect(button).toContain('border-destructive/30');
    expect(button).not.toMatch(/(?:\s|")bg-destructive(?:\s|")/);
    expect(button).not.toContain('text-white');
  }
  expect(html.match(/lucide-trash-2/g)).toHaveLength(5);
});

function props(node: ReactNode): Record<string, unknown>[] {
  if (Array.isArray(node)) return node.flatMap(props);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node.props, ...props(node.props.children as ReactNode)];
}
it('adds a typed price with independent currency, edits a default label and removes every default', () => {
  let value: PackageTourPriceFieldV1[] = tourPriceFields();
  const onChange = vi.fn((next: PackageTourPriceFieldV1[]) => {
    value = next;
  });
  const render = () =>
    props(canonicalTestTree(TourPriceFields({ value, onChange, currencies })));
  const add = render().find((node) => node.onClick && !node['aria-label'])!;
  (add.onClick as () => void)();
  expect(value).toHaveLength(6);
  const customId = value[5]!.id;
  const title = render().find(
    (node) => node['aria-label'] === 'نام فیلد قیمت 6',
  )!;
  (title.onChange as (event: unknown) => void)({ target: { value: 'Visa' } });
  const currency = render().find((node) => node['aria-label'] === 'ارز Visa')!;
  (currency.onChange as (event: unknown) => void)({ target: { value: 'GBP' } });
  const money = render().find((node) => node['aria-label'] === 'مبلغ Visa')!;
  (money.onValueChange as (amount: string) => void)('15.50');
  expect(
    render().some((node) => node['aria-label'] === 'نام فیلد قیمت 1'),
  ).toBe(false);
  const select = render().find(
    (node) => node['aria-label'] === 'نوع فیلد قیمت 1',
  )!;
  expect(select.value).toBe('adultFlight');
  for (let i = 0; i < 5; i++) {
    const remove = render().find((node) =>
      String(node['aria-label']).startsWith('حذف فیلد'),
    )!;
    (remove.onClick as () => void)();
  }
  expect(value).toEqual([
    {
      id: customId,
      title: 'Visa',
      kind: 'custom',
      amount: '15.50',
      currencyCode: 'GBP',
      mode: 'fixed',
    },
  ]);
  (
    render().find((node) => node['aria-label'] === 'حذف فیلد Visa')!
      .onClick as () => void
  )();
  expect(value).toEqual([]);
});

it('offers registered currencies, rejects arbitrary codes and preserves saved unavailable currencies', () => {
  const value = tourPriceFields();
  value[0]!.currencyCode = 'USD';
  const onChange = vi.fn();
  const tree = props(
    canonicalTestTree(TourPriceFields({ value, onChange, currencies })),
  );
  const currency = tree.find(
    (node) => node['aria-label'] === `ارز ${value[0]!.title}`,
  )!;
  expect(currency.disabled).toBe(false);
  expect(
    tree.some((node) => node.value === 'USD' && node.disabled === true),
  ).toBe(true);
  (currency.onChange as (event: unknown) => void)({ target: { value: 'XYZ' } });
  expect(onChange).not.toHaveBeenCalled();
  (currency.onChange as (event: unknown) => void)({ target: { value: 'GBP' } });
  expect(onChange.mock.calls[0]![0][0]).toMatchObject({
    currencyCode: 'GBP',
    amount: value[0]!.amount,
  });
  expect(value[0]!.currencyCode).toBe('USD');
  const html = renderToStaticMarkup(
    <TourPriceFields
      value={value}
      onChange={onChange}
      currencies={currencies}
    />,
  );
  expect(html).toContain('پوند');
  expect(html).toContain('GBP');
  const currencyInputs = [
    ...html.matchAll(/<input[^>]*aria-label="ارز [^>]*>/g),
  ];
  expect(currencyInputs.length).toBeGreaterThan(0);
  for (const [input] of currencyInputs)
    expect(input).toContain('role="combobox"');
});

it.each([{ currenciesLoading: true, currencies }, { currencies: [] }])(
  'disables currency selection until options are available: %j',
  (state) => {
    const value = tourPriceFields();
    const tree = props(
      canonicalTestTree(
        TourPriceFields({ value, onChange: vi.fn(), ...state }),
      ),
    );
    const currency = tree.find(
      (node) => node['aria-label'] === `ارز ${value[0]!.title}`,
    )!;
    expect(currency.disabled).toBe(true);
  },
);
