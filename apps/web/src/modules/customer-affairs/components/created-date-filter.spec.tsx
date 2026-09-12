import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CreatedDateFilter } from './created-date-filter';
import { customerAffairsApi } from '../api/customer-affairs-client';

describe('created date range', () => {
  it('renders shared calendar controls and clear action', () => {
    const html = renderToStaticMarkup(
      <CreatedDateFilter from="" to="" onApply={() => {}} />,
    );
    expect(html).toContain('ثبت پرونده از تاریخ');
    expect(html).toContain('پاک‌کردن بازه');
    expect(html).not.toContain('type="date"');
  });
  it('prevents inverted ranges', () => {
    const html = renderToStaticMarkup(
      <CreatedDateFilter
        from="2026-09-13"
        to="2026-09-12"
        onApply={() => {}}
      />,
    );
    expect(html).toContain('تاریخ پایان نباید قبل');
    expect(html).toContain('disabled');
  });
  it('sends UTC boundaries including the entire selected end day', async () => {
    const original = process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://127.0.0.1:4190/api/v1';
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      await customerAffairsApi.tickets('', 'ALL', {
        createdFrom: '2026-09-12',
        createdTo: '2026-09-12',
      });
      const query = new URL(fetchMock.mock.calls[0]![0]).searchParams;
      expect(query.get('createdFrom')).toBe(
        new Date('2026-09-12T00:00:00').toISOString(),
      );
      expect(query.get('createdBefore')).toBe(
        new Date('2026-09-13T00:00:00').toISOString(),
      );
    } finally {
      vi.unstubAllGlobals();
      if (original === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
      else process.env.NEXT_PUBLIC_API_BASE_URL = original;
    }
  });
});
