import { afterEach, describe, expect, it, vi } from 'vitest';
import { procurementApi } from './api';
import { reportRate } from './reports';
const previousBase = process.env.NEXT_PUBLIC_API_BASE_URL;
afterEach(() => {
  vi.unstubAllGlobals();
  if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase;
});
describe('Scoped procurement reporting', () => {
  it('does not turn unavailable rate denominators into a misleading zero percent', () => {
    expect(reportRate(0, 0)).toBe('بدون داده');
    expect(reportRate(1, 4)).toBe('۲۵٪');
    expect(reportRate(0, 4)).toBe('۰٪');
  });
  it('requests server-scoped reports by dimension and page, preserving exact amounts and cancelled groups', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const response = {
      groups: {
        items: [
          {
            label: 'واحد',
            currencyCode: 'IRR',
            amount: '9007199254740993.1234',
            count: 1,
            cancelled: true,
          },
        ],
        page: 2,
        pageSize: 50,
        hasMore: false,
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(response), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const result = await procurementApi.reports('unit', 2);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/reports?dimension=unit&page=2'),
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(result.groups.items[0]).toEqual(response.groups.items[0]);
  });
});
