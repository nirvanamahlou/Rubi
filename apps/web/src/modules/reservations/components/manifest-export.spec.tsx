import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ManifestExport } from './manifest-export';

it('offers date-range export with new-only selected by default', () => {
  const html = renderToStaticMarkup(<ManifestExport />);
  expect(html).toContain('از تاریخ رفت');
  expect(html).toContain('تا تاریخ رفت');
  expect(html).toContain('فقط قراردادهای جدید');
  expect(html).toContain('همه قراردادهای بازه');
  expect(html).toMatch(/name="manifest-scope"[^>]*checked=""[^>]*\/?>/);
  expect(html).toContain('دریافت MANIFEST بازه');
});
