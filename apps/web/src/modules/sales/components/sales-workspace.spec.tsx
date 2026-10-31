import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { salesApi } from '../api/client';
import type { SalesContractSummary } from '@nora/contracts';
import {
  contractRowClassName,
  formatMoney,
  hasContractDateFilter,
  loadSalesWorkspace,
  paymentReferenceSearchQuery,
  SalesWorkspace,
  ContractListContactRouteDate,
  ContractListAmounts,
  ContractListNumber,
  ContractListTravelDates,
  ContractListPassengers,
} from './sales-workspace';

describe('sales dashboard loading', () => {
  it('shows the booked travel dates in separate cells with their recorded calendars', () => {
    const contract = {
      travelDates: {
        outbound: { date: '2026-10-25', calendar: 'gregorian' },
        returning: { date: '2026-11-01', calendar: 'persian' },
      },
    } as SalesContractSummary;
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            <ContractListTravelDates contract={contract} />
          </tr>
        </tbody>
      </table>,
    );
    expect(html.match(/<td\b/g)).toHaveLength(2);
    expect(html).toContain('25/10/2026');
    expect(html).toContain(
      new Date('2026-11-01T00:00:00Z').toLocaleDateString('fa-IR', {
        timeZone: 'UTC',
      }),
    );
  });
  it('shows both missing travel dates as unknown for older API responses', () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            <ContractListTravelDates contract={{} as SalesContractSummary} />
          </tr>
        </tbody>
      </table>,
    );
    expect(html.match(/—/g)).toHaveLength(2);
  });
  it('shows the passenger total and each nonempty age band without zero badges', () => {
    const html = renderToStaticMarkup(
      <ContractListPassengers
        contract={
          {
            passengerNames: [],
            passengerCount: 4,
            passengerComposition: {
              adults: 2,
              children2To6: 1,
              children6To12: 1,
              infants: 0,
              childrenUnknownAge: 0,
            },
          } as unknown as SalesContractSummary
        }
      />,
    );
    expect(html).toContain('۴ مسافر');
    expect(html).toContain('۲ بزرگسال، ۱ کودک ۲ تا ۶ سال، ۱ کودک ۶ تا ۱۲ سال');
    expect(html).not.toContain('نوزاد');
  });
  it('keeps corrected yellow contract-number cells structurally identical to ordinary cells', () => {
    const render = (reservationContractChanged: boolean) =>
      renderToStaticMarkup(
        <table>
          <tbody>
            <tr>
              <ContractListNumber
                contract={{
                  contractNumber: 'SYNTHETIC-1',
                  reservationContractChanged,
                }}
              />
            </tr>
          </tbody>
        </table>,
      );
    const corrected = render(true);
    const plain = render(false);
    expect(corrected).toContain('اصلاح قرارداد توسط رزرواسیون');
    expect(corrected).not.toMatch(/<p(?:\s|>)/);
    expect(corrected.replace(/title="[^"]*"/, '')).toBe(
      plain.replace(/title="[^"]*"/, ''),
    );
  });
  it('renders one filter form for contracts and receivables', () => {
    const html = renderToStaticMarkup(<SalesWorkspace />);
    expect(html.match(/<form/g)).toHaveLength(1);
    expect(html).toContain('جست‌وجوی قرارداد');
    expect(html).toContain('نوع مشتری');
    expect(html).toContain('مبنای تاریخ');
  });
  it('uses expanded server-side pages for travel dates too', async () => {
    const api = {
      dashboard: vi.fn().mockResolvedValue({ data: {} }),
      list: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    };
    await loadSalesWorkspace(api as never, { travelFrom: '2026-10-01' });
    expect(api.list).toHaveBeenCalledWith(
      expect.objectContaining({ travelFrom: '2026-10-01', pageSize: 10_000 }),
    );
  });
  it('renders customer phone and destination only with the original contract date rather than its last edit', () => {
    const createdAt = '2026-09-01T12:00:00.000Z';
    const contract = {
      customerPhone: '09900000001',
      originName: 'تهران',
      destinationName: 'آنتالیا',
      createdAt,
      updatedAt: '2026-10-03T12:00:00.000Z',
    } as SalesContractSummary;
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            <ContractListContactRouteDate contract={contract} />
          </tr>
        </tbody>
      </table>,
    );
    expect(html).toContain('<bdi dir="ltr">09900000001</bdi>');
    expect(html).not.toContain('تهران');
    expect(html).not.toContain('→');
    expect(html).toContain('آنتالیا');
    expect(html).toContain(
      new Date(createdAt).toLocaleDateString('fa-IR', {
        timeZone: 'Asia/Tehran',
      }),
    );
    expect(html).not.toContain(
      new Date(contract.updatedAt).toLocaleDateString('fa-IR', {
        timeZone: 'Asia/Tehran',
      }),
    );
  });
  it('shows canonical totals beside balances separately per currency without recalculating payments', () => {
    const balances = [
      {
        currencyCode: 'IRR',
        amount: '9007199254740993.25',
        outstanding: '1234.50',
        confirmedPaid: '0',
        pendingFinance: '999',
      },
      {
        currencyCode: 'USD',
        amount: '25.50',
        outstanding: '-1.25',
        confirmedPaid: '0',
        pendingFinance: '999',
      },
    ];
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            <ContractListAmounts contract={{ balances }} />
          </tr>
        </tbody>
      </table>,
    );
    const cells = html.match(/<td\b[^>]*>[\s\S]*?<\/td>/g)!;
    expect(cells).toHaveLength(2);
    expect(cells[0]).toContain(formatMoney(balances[0]!.amount, 'IRR'));
    expect(cells[0]).toContain(formatMoney('25.50', 'USD'));
    expect(cells[1]).toContain(formatMoney('1234.50', 'IRR'));
    expect(cells[1]).toContain(formatMoney('-1.25', 'USD'));
    expect(html).not.toContain(' + ');
    expect(html).not.toContain('999');
  });
  it('shows explicit unknown amounts rather than invented zeroes when no balances exist', () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            <ContractListAmounts contract={{ balances: [] }} />
          </tr>
        </tbody>
      </table>,
    );
    expect(html.match(/—/g)).toHaveLength(2);
    expect(html).not.toContain('ریال');
  });
  it('falls back to an unknown destination without substituting the origin', () => {
    const contract = {
      originName: 'تهران',
      destinationName: null,
      createdAt: '2026-09-01T12:00:00Z',
    } as SalesContractSummary;
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            <ContractListContactRouteDate contract={contract} />
          </tr>
        </tbody>
      </table>,
    );
    expect(html).toContain('<bdi>—</bdi>');
    expect(html).not.toContain('تهران');
  });
  it('places the Excel export beside the contract list with a full-results hint', () => {
    const html = renderToStaticMarkup(<SalesWorkspace />);
    expect(html).toContain('خروجی Excel');
    expect(html).toContain('خروجی همه نتایج فیلترشده، نه فقط این صفحه');
  });
  it('searches tracking references server-side across contracts without a current contract or stale settlement filter', async () => {
    const query = paymentReferenceSearchQuery('  OTHER-CONTRACT-TRACK  ');
    expect(query).toEqual({ search: 'OTHER-CONTRACT-TRACK', page: 1 });
    const api = {
      dashboard: vi.fn().mockResolvedValue({ data: {} }),
      list: vi.fn().mockResolvedValue({
        data: [{ id: 'other-contract' }],
        meta: { total: 1 },
      }),
    };
    const result = await loadSalesWorkspace(api, query);
    expect(api.list).toHaveBeenCalledWith({
      search: 'OTHER-CONTRACT-TRACK',
      page: 1,
      pageSize: 10,
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
      pageSize: 10,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
    expect(api.dashboard).toHaveBeenCalledWith();
  });
  it('shows all contracts in an applied registration-date range while keeping the default list compact', async () => {
    const api = {
      dashboard: vi.fn().mockResolvedValue({ data: {} }),
      list: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    } satisfies Pick<typeof salesApi, 'dashboard' | 'list'>;
    expect(hasContractDateFilter({})).toBe(false);
    expect(
      hasContractDateFilter({
        createdFrom: '2026-09-01',
        createdTo: '2026-09-30',
      }),
    ).toBe(true);
    await loadSalesWorkspace(api, {
      createdFrom: '2026-09-01',
      createdTo: '2026-09-30',
    });
    expect(api.list).toHaveBeenCalledWith({
      createdFrom: '2026-09-01',
      createdTo: '2026-09-30',
      page: 1,
      pageSize: 10_000,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
  });
  it('formats money without lossy floating point conversion or mixing currencies', () => {
    expect(formatMoney('9007199254740993.25', 'IRR')).toBe(
      '۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۳٫۲۵ ﷼',
    );
    expect(formatMoney('-1234.50', 'USD')).toBe('-۱٬۲۳۴٫۵۰ $');
    expect(formatMoney('0', 'IRR')).toBe('۰ ﷼');
  });
  it('exposes labelled server-backed search and settlement controls', () => {
    const html = renderToStaticMarkup(<SalesWorkspace />);
    expect(html).toContain('جست‌وجوی قرارداد');
    expect(html).toContain('وضعیت تسویه');
    expect(html).toContain(
      'شماره قرارداد، نام مشتری، نوتیس یا شماره پیگیری پرداخت',
    );
    expect(html).toContain('از تاریخ مانده قابل دریافت');
    expect(html).toContain('تا تاریخ مانده قابل دریافت');
    expect(html).toContain(
      'بدون فیلتر تاریخ، فقط ۱۰ قراردادِ آخر نمایش داده می‌شود.',
    );
    expect(html).not.toContain('اولین قرارداد سفر را ثبت کنید');
  });
  it('keeps an empty successful contract list separate from unavailable statistics', async () => {
    const api = {
      dashboard: vi.fn().mockRejectedValue(new Error('statistics unavailable')),
      list: vi.fn().mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 10, total: 0 },
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
      pageSize: 10,
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

it('uses finance delivery approval for green rows and removes green on revocation', () => {
  expect(
    contractRowClassName({ customerDocumentDeliveryApproved: true }),
  ).toContain('bg-emerald-100');
  expect(
    contractRowClassName({
      customerDocumentDeliveryApproved: true,
      reservationContractChanged: true,
    }),
  ).not.toContain('bg-amber');
  expect(
    contractRowClassName({ customerDocumentDeliveryApproved: false }),
  ).not.toContain('emerald');
  expect(contractRowClassName({ reservationContractChanged: true })).toContain(
    'bg-amber',
  );
  expect(contractRowClassName({})).toContain('odd:bg-muted');
});
