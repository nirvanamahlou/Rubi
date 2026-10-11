import { isValidElement, type ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { tourPriceFields, type PackageTourPriceFieldV1 } from '@nora/contracts';
import { canonicalTestTree } from '@/i18n/test-tree';
import { TourPriceFields } from './tour-price-fields';

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
    props(canonicalTestTree(TourPriceFields({ value, onChange })));
  const add = render().find((node) => node.onClick && !node['aria-label'])!;
  (add.onClick as () => void)();
  expect(value).toHaveLength(5);
  const customId = value[4]!.id;
  const title = render().find(
    (node) => node['aria-label'] === 'نام فیلد قیمت 5',
  )!;
  (title.onChange as (event: unknown) => void)({ target: { value: 'Visa' } });
  const currency = render().find((node) => node['aria-label'] === 'ارز Visa')!;
  (currency.onChange as (event: unknown) => void)({ target: { value: 'gbp' } });
  const money = render().find((node) => node['aria-label'] === 'مبلغ Visa')!;
  (money.onValueChange as (amount: string) => void)('15.50');
  const defaultTitle = render().find(
    (node) => node['aria-label'] === 'نام فیلد قیمت 1',
  )!;
  (defaultTitle.onChange as (event: unknown) => void)({
    target: { value: 'Adult fare' },
  });
  expect(value[0]).toMatchObject({ kind: 'adultFlight', title: 'Adult fare' });
  for (let i = 0; i < 4; i++) {
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
