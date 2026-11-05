import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CallKpiIcon } from './kpi-icon';

it('keeps repeated KPI illustrations decorative and resolves every SVG reference within its own instance', () => {
  const kinds = ['today', 'week', 'withoutOutcome', 'needsFollowUp'] as const;
  const html = renderToStaticMarkup(
    <>
      {[0, 1].map((copy) =>
        kinds.map((kind) => (
          <CallKpiIcon key={`${copy}-${kind}`} kind={kind} />
        )),
      )}
    </>,
  );
  const icons = [...html.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/g)].map(
    ([svg]) => svg,
  );
  expect(icons).toHaveLength(8);
  const allIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  expect(allIds.length).toBeGreaterThan(0);
  expect(new Set(allIds).size).toBe(allIds.length);

  for (const svg of icons) {
    const localIds = [...svg.matchAll(/\bid="([^"]+)"/g)].map(
      (match) => match[1],
    );
    const references = [...svg.matchAll(/url\(#([^)]+)\)/g)].map(
      (match) => match[1],
    );
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) expect(localIds).toContain(reference);
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('focusable="false"');
    expect(svg).not.toMatch(/<(?:image|title|foreignObject)\b|\btabindex=/i);
  }
});
