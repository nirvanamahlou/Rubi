import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AccountingConfigurationV1 } from '@nora/contracts';
import { AccountingChartDetailLevels } from './accounting-chart-detail-levels';

const types: AccountingConfigurationV1[] = [
  {
    id: 'cash',
    bookId: 'book',
    code: '1',
    title: 'صندوق',
    kind: 'detail-types',
    active: true,
    version: 1,
    attributes: {},
  },
  {
    id: 'person',
    bookId: 'book',
    code: '2',
    title: 'شخص',
    kind: 'detail-types',
    active: true,
    version: 1,
    attributes: {},
  },
];
const props = {
  attributes: {
    detailLevels: ['4'],
    detail4Required: true,
    detail4TypeIds: ['cash'],
    detail5TypeIds: ['person'],
  },
  types,
  onSelect: () => undefined,
  onChange: () => undefined,
};

describe('chart detail-level grid', () => {
  it('lists every defined detail type for each selected level, including inactive catalogue rows', () => {
    const catalogue: AccountingConfigurationV1[] = [
      ...types,
      { ...types[0]!, id: 'company', title: 'شرکت' },
      { ...types[0]!, id: 'inactive', title: 'نوع غیرفعال', active: false },
      { ...types[0]!, id: 'year', title: 'سال آزمایشی', kind: 'fiscal-years' },
    ];
    for (const level of [4, 5, 6] as const) {
      const html = renderToStaticMarkup(
        <AccountingChartDetailLevels
          {...props}
          types={catalogue}
          level={level}
        />,
      );
      for (const type of catalogue.filter(
        (type) => type.kind === 'detail-types',
      ))
        expect(html).toContain(`id="coa-detail-type-${type.id}"`);
      expect(html).not.toContain('coa-detail-type-year');
      expect(
        html.match(/<input[^>]*id="coa-detail-type-inactive"[^>]*>/)?.[0],
      ).toContain('disabled');
      expect(html).toContain('(غیرفعال)');
    }
  });
  it('preserves an inactive saved choice and locks mutations while saving or without permission', () => {
    const html = renderToStaticMarkup(
      <AccountingChartDetailLevels
        {...props}
        types={[{ ...types[0]!, active: false }]}
        level={4}
        disabled
      />,
    );
    const input = html.match(/<input[^>]*id="coa-detail-type-cash"[^>]*>/)?.[0];
    expect(input).toContain('checked=""');
    expect(input).toContain('disabled');
    expect(
      html.match(/<input[^>]*aria-label="فعال بودن سطح چهار"[^>]*>/)?.[0],
    ).toContain('disabled');
  });
  it('keeps levels five and six reachable on older level-four-only accounts; waits for a level before showing types', () => {
    const html = renderToStaticMarkup(
      <AccountingChartDetailLevels {...props} level={null} />,
    );
    for (const title of ['سطح چهار', 'سطح پنج', 'سطح شش'])
      expect(html).toContain(`>${title}</button>`);
    expect(html).not.toContain('coa-detail-type-cash');
    expect(html).not.toContain('اضافه کردن سطح جدید');
  });
  it('renders the selected level choices with associated labels and independent checked states', () => {
    const html = renderToStaticMarkup(
      <AccountingChartDetailLevels {...props} level={5} />,
    );
    expect(html).toContain('aria-label="انواع تفصیلی سطح پنج"');
    expect(html).toMatch(/id="coa-detail-type-person"[^>]*checked=""/);
    expect(html).not.toMatch(/id="coa-detail-type-cash"[^>]*checked=""/);
    expect(html).toContain('for="coa-detail-type-person"');
  });
});
