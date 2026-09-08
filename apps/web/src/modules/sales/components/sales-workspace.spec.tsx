import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { salesApi } from '../api/client';
import {
  formatMoney,
  loadSalesWorkspace,
  paymentReferenceSearchQuery,
  SalesWorkspace,
} from './sales-workspace';

describe('sales dashboard loading', () => {
  it('searches tracking references server-side across contracts without a current contract or stale settlement filter', async () => {
    const query = paymentReferenceSearchQuery('  OTHER-CONTRACT-TRACK  ');
    expect(query).toEqual({ search: 'OTHER-CONTRACT-TRACK', page: 1 });
    const api = {
      dashboard: vi.fn().mockResolvedValue({ data: {} }),
      list: vi
        .fn()
        .mockResolvedValue({
          data: [{ id: 'other-contract' }],
          meta: { total: 1 },
        }),
    };
    const result = await loadSalesWorkspace(api, query);
    expect(api.list).toHaveBeenCalledWith({
      search: 'OTHER-CONTRACT-TRACK',
      page: 1,
      pageSize: 20,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
    expect(result.contracts).toMatchObject({
      status: 'fulfilled',
      value: { data: [{ id: 'other-contract' }] },
    });
  });
  it('passes filters and pagination to the API rather than filtering only the loaded page', async () => {
    const api = {
      dashboard: vi.fn().mockResolvedValue({ data: {} }),
      list: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    } satisfies Pick<typeof salesApi, 'dashboard' | 'list'>;
    await loadSalesWorkspace(api, {
      search: 'Example',
      settlementStatus: 'SETTLED',
      page: 3,
    });
    expect(api.list).toHaveBeenCalledWith({
      search: 'Example',
      settlementStatus: 'SETTLED',
      page: 3,
      pageSize: 20,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
    expect(api.dashboard).toHaveBeenCalledWith();
  });
  it('formats money without lossy floating point conversion or mixing currencies', () => {
    expect(formatMoney('9007199254740993.25', 'IRR')).toBe(
      '۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۳٫۲۵ ریال',
    );
    expect(formatMoney('-1234.50', 'USD')).toBe('-۱٬۲۳۴٫۵۰ USD');
    expect(formatMoney('0', 'IRR')).toBe('۰ ریال');
  });
  it('exposes labelled server-backed search and settlement controls', () => {
    const html = renderToStaticMarkup(<SalesWorkspace />);
    expect(html).toContain('جست‌وجوی قرارداد');
    expect(html).toContain('وضعیت تسویه');
    expect(html).toContain('شماره قرارداد، نام مشتری یا شماره پیگیری پرداخت');
    expect(html).not.toContain('اولین قرارداد سفر را ثبت کنید');
  });
  it('keeps an empty successful contract list separate from unavailable statistics', async () => {
    const api = {
      dashboard: vi.fn().mockRejectedValue(new Error('statistics unavailable')),
      list: vi.fn().mockResolvedValue({
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
