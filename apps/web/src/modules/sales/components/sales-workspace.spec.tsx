import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { salesApi } from '../api/client';
import { loadSalesWorkspace, SalesWorkspace } from './sales-workspace';

describe('sales dashboard loading', () => {
  it('keeps an empty successful contract list separate from unavailable statistics', async () => {
    const api = {
      dashboard: vi.fn().mockRejectedValue(new Error('statistics unavailable')),
      list: vi
        .fn()
        .mockResolvedValue({
          data: [],
          meta: { page: 1, pageSize: 20, total: 0 },
        }),
    } satisfies Pick<typeof salesApi, 'dashboard' | 'list'>;
    const result = await loadSalesWorkspace(api);
    expect(result.dashboard.status).toBe('rejected');
    expect(result.contracts).toMatchObject({
      status: 'fulfilled',
      value: { data: [] },
    });
    expect(api.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
  });
  it('keeps successful statistics when the list fails without manufacturing contracts', async () => {
    const api = {
      dashboard: vi.fn().mockResolvedValue({ data: { todayContracts: 0 } }),
      list: vi.fn().mockRejectedValue(new Error('list unavailable')),
    } satisfies Pick<typeof salesApi, 'dashboard' | 'list'>;
    const result = await loadSalesWorkspace(api);
    expect(result.dashboard).toMatchObject({
      status: 'fulfilled',
      value: { data: { todayContracts: 0 } },
    });
    expect(result.contracts.status).toBe('rejected');
  });
  it('renders compact dashboard navigation without showing failure during initial load', () => {
    const html = renderToStaticMarkup(<SalesWorkspace />);
    expect(html).toContain('داشبورد قراردادها');
    expect(html).toContain('/sales/contracts/new');
    expect(html).not.toContain('در دسترس نیست');
    expect(html).not.toContain('ناموفق');
  });
});
