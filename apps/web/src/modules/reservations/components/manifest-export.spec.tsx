import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ManifestExport } from './manifest-export';

it('starts with a date-range ticket search before showing manifest cards', () => {
  const html = renderToStaticMarkup(<ManifestExport />);
  expect(html).toContain('از تاریخ پرواز');
  expect(html).toContain('تا تاریخ پرواز');
  expect(html).toContain('نمایش بلیط‌های بازه');
  expect(html).toContain('قالب فعال همان');
  expect(html).not.toContain('MANIFEST ایران ایرتور');
});
