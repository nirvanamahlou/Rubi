import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SourceShareChart, sourceShareLayout } from './source-share-chart';

describe('source share chart', () => {
  it('separates clustered small-source labels without dropping categories', () => {
    const sources = [
      { label: 'نامشخص', count: 92 },
      ...Array.from({ length: 8 }, (_, index) => ({
        label: `source-${index}`,
        count: 1,
      })),
    ];
    const items = sourceShareLayout(sources, 100);
    expect(items).toHaveLength(9);
    expect(items.reduce((sum, item) => sum + item.share, 0)).toBeCloseTo(1);
    for (const right of [true, false]) {
      const labels = items
        .filter((item) => item.right === right)
        .sort((a, b) => a.labelY - b.labelY);
      labels.forEach((item, index) => {
        expect(item.labelY).toBeGreaterThanOrEqual(36);
        expect(item.labelY).toBeLessThanOrEqual(324);
        if (index)
          expect(
            item.labelY - labels[index - 1]!.labelY,
          ).toBeGreaterThanOrEqual(36);
      });
    }
    expect(sources[0]!.count).toBe(92);
  });

  it('renders a single source as a full ring with contact count and accessible labels', () => {
    const html = renderToStaticMarkup(
      <SourceShareChart
        total={1}
        sources={[{ label: 'معرفی دوستان', count: 1 }]}
      />,
    );
    expect(html).toContain('stroke-dasharray="100 0"');
    expect(html).toContain('۱۰۰٪');
    expect(html).toContain('کل مخاطبان');
    expect(html).toContain('<polyline');
    expect(html).toContain('<figcaption');
  });

  it('keeps empty data finite and excludes zero-value slices', () => {
    const html = renderToStaticMarkup(
      <SourceShareChart total={0} sources={[]} />,
    );
    expect(html).not.toMatch(/NaN|Infinity/);
    expect(sourceShareLayout([{ label: 'empty', count: 0 }], 0)).toEqual([]);
  });
});
