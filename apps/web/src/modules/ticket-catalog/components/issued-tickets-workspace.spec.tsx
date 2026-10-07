import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { IssuedTicketsWorkspace } from './issued-tickets-workspace';
describe('issued passenger ticket exports', () => {
  it('offers both server exports and mandatory issuance dates', () => {
    const html = renderToStaticMarkup(<IssuedTicketsWorkspace tickets={[]} />);
    expect(html).toContain('دانلود اکسل');
    expect(html).toContain('دانلود PDF');
    expect(html).toContain('صدور از تاریخ');
    expect(html).toContain('صدور تا تاریخ');
    expect(html).not.toContain('انتخاب بازه تاریخ صدور برای خروجی الزامی است');
  });
});
