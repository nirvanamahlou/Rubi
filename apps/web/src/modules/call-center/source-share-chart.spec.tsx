import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SourceShareChart, sourceShareLayout } from './source-share-chart';

describe('source share chart', () => {
  it('keeps every source in the ring and readable legend, including small categories', () => {
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
    expect(new Set(items.map((item) => item.color)).size).toBe(9);
    expect(sources[0]!.count).toBe(92);

    const html = renderToStaticMarkup(
      <SourceShareChart sources={sources} total={100} />,
    );
    const legend = html.match(
      /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/,
    )?.[1];
    expect(legend).toBeDefined();
    expect(legend).toContain('<ul');
    expect(legend?.match(/<li\b/g)).toHaveLength(9);
    for (const source of sources) expect(legend).toContain(source.label);
    expect(legend).toContain('<bdi');
    expect(legend).toContain('۹۲٪');
    expect(legend).toContain('(۹۲)');
    expect(legend).toContain('۱٪');
    expect(html).not.toContain('<polyline');
    expect(html).not.toContain('<tspan');
  });

  it('uses the supplied contact denominator instead of normalizing the visible sources', () => {
    const sources = [
      { label: 'سایت', count: 3 },
      { label: 'معرفی دوستان', count: 2 },
    ];
    const items = sourceShareLayout(sources, 12);
    expect(items[0]!.share).toBeCloseTo(0.25);
    expect(items[1]!.share).toBeCloseTo(1 / 6);
    expect(items[1]!.start).toBeCloseTo(25);

    const html = renderToStaticMarkup(
      <SourceShareChart sources={sources} total={12} />,
    );
    expect(html).toContain('aria-label="کل مخاطبان ۱۲"');
    expect(html).toContain('۲۵٪');
    expect(html).toContain('۱۶٫۷٪');
    expect(html).toContain('(۳)');
    expect(html).toContain('(۲)');
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
    expect(html).toContain('aria-label="کل مخاطبان ۱"');
    expect(html).toContain('>مخاطب</text>');
    expect(html).toContain('معرفی دوستان');
    expect(html).toContain('(۱)');
    expect(html).toContain('<figcaption');
    expect(html.match(/<li\b/g)).toHaveLength(1);
  });

  it('excludes nonpositive categories without losing the positive source', () => {
    const sources = [
      { label: 'empty', count: 0 },
      { label: 'invalid', count: -1 },
      { label: 'سایت', count: 1 },
    ];
    const items = sourceShareLayout(sources, 1);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ label: 'سایت', start: 0, share: 1 });
    const html = renderToStaticMarkup(
      <SourceShareChart total={1} sources={sources} />,
    );
    expect(html).not.toContain('empty');
    expect(html).not.toContain('invalid');
    expect(html.match(/<li\b/g)).toHaveLength(1);
  });

  it('keeps empty data finite without fictional source rows', () => {
    const html = renderToStaticMarkup(
      <SourceShareChart total={0} sources={[]} />,
    );
    expect(html).not.toMatch(/NaN|Infinity/);
    expect(html).toContain('aria-label="کل مخاطبان ۰"');
    expect(html).not.toMatch(/<li\b/);
    expect(sourceShareLayout([{ label: 'empty', count: 0 }], 0)).toEqual([]);
  });
});
