import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  accessibleRows,
  dashboard,
  defaultQuery,
  queryRows,
  reservationWindowQuery,
  sections,
  type RequestView,
  type ViewAccess,
  type ViewState,
} from './model';
import { ReservationOperationsWorkspace } from './workspace';
const now = '2026-09-08T09:00:00.000Z';
const access: ViewAccess = {
  authenticated: true,
  permissions: ['reservations.read'],
  branchIds: ['test-a'],
};
function row(id = 'test-request'): RequestView {
  return {
    id,
    contractNumber: `TEST-${id}`,
    branchId: 'test-a',
    branchName: 'Test branch',
    issuerName: 'Test issuer',
    customerName: 'Synthetic customer',
    salesCounter: 'Synthetic counter',
    assignee: null,
    passengerNames: ['Synthetic passenger'],
    services: ['FLIGHT', 'HOTEL'],
    priority: 'NORMAL',
    deadline: '2026-09-08T09:30:00.000Z',
    createdAt: now,
    status: 'NEW',
    issues: [{ id: 'document-test', issuedAt: now }],
  };
}
describe('reservations workspace access and states', () => {
  it('keeps natural numeric order across scripts, status updates, refreshes and legacy sort preferences', () => {
    const rows = [
      { ...row('ten'), contractNumber: '۱۰', status: 'COMPLETED' as const },
      { ...row('two'), contractNumber: '٢' },
      { ...row('one'), contractNumber: '1' },
    ];
    for (const sort of [
      'contract',
      'newest',
      'oldest',
      'priority',
      'deadline',
    ] as const) {
      const result = queryRows(rows, { ...defaultQuery, sort, pageSize: 2 });
      expect(result.filteredRows.map((r) => r.id)).toEqual([
        'one',
        'two',
        'ten',
      ]);
      expect(result.rows.map((r) => r.id)).toEqual(['one', 'two']);
      expect(
        queryRows([...rows].reverse(), {
          ...defaultQuery,
          sort,
          pageSize: 2,
          page: 2,
        }).rows.map((r) => r.id),
      ).toEqual(['ten']);
    }
    expect(rows.map((r) => r.id)).toEqual(['ten', 'two', 'one']);
    expect(
      queryRows(
        [
          { ...row('b'), contractNumber: 'SC-2026-10' },
          { ...row('a'), contractNumber: 'SC-2026-2' },
        ],
        defaultQuery,
      ).rows.map((r) => r.id),
    ).toEqual(['a', 'b']);
    expect(
      queryRows(
        [
          { ...row('b'), contractNumber: '2' },
          { ...row('a'), contractNumber: '۲' },
        ],
        defaultQuery,
      ).rows.map((r) => r.id),
    ).toEqual(['a', 'b']);
  });
  it('orders contract numbers before pagination despite reversed receipt dates and urgency', () => {
    const oldest = {
      ...row('old'),
      contractNumber: '120001',
      createdAt: '2026-09-01T09:00:00Z',
      receivedAt: '2026-09-08T09:00:00Z',
    };
    const newest = {
      ...row('new'),
      contractNumber: '120003',
      createdAt: '2026-09-07T09:00:00Z',
      receivedAt: '2026-09-07T09:00:00Z',
      priority: 'URGENT' as const,
      deadline: '2026-09-07T10:00:00Z',
    };
    const middle = {
      ...row('middle'),
      contractNumber: '120002',
      createdAt: '2026-09-04T09:00:00Z',
    };
    const source = [newest, oldest, middle];
    expect(defaultQuery.sort).toBe('contract');
    const first = queryRows(source, { ...defaultQuery, pageSize: 2 });
    expect(first.filteredRows.map((r) => r.id)).toEqual([
      'old',
      'middle',
      'new',
    ]);
    expect(first.rows.map((r) => r.id)).toEqual(['old', 'middle']);
    expect(
      queryRows(source, { ...defaultQuery, pageSize: 2, page: 2 }).rows.map(
        (r) => r.id,
      ),
    ).toEqual(['new']);
    expect(source.map((r) => r.id)).toEqual(['new', 'old', 'middle']);
  });
  it('appends newly created contracts after existing rows and breaks equal dates consistently', () => {
    const initial = [row('b'), row('a')];
    expect(queryRows(initial, defaultQuery).rows.map((r) => r.id)).toEqual([
      'a',
      'b',
    ]);
    const refreshed = [
      { ...row('c'), createdAt: '2026-09-09T09:00:00Z' },
      ...initial,
    ];
    expect(queryRows(refreshed, defaultQuery).rows.map((r) => r.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(
      queryRows(refreshed, { ...defaultQuery, sort: 'newest' }).rows.map(
        (r) => r.id,
      ),
    ).toEqual(['a', 'b', 'c']);
  });
  it('does not show a standalone bottom history button for a selected contract', () => {
    const html = renderToStaticMarkup(
      <ReservationOperationsWorkspace
        state="SUCCESS"
        rows={[
          { ...row(), contractId: '10000000-0000-4000-8000-000000000001' },
        ]}
        access={access}
        now={now}
        initialSection="inbox"
      />,
    );
    expect(html).not.toContain('سوابق اصلاح قرارداد');
    expect(html).toContain('توضیحات');
    const source = readFileSync(
      new URL('./workspace.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('<ContractCorrectionDeepLink />');
    expect(source).not.toContain('ContractCorrectionHistoryButton');
  });
  it('marks corrected contracts only with a red caption below the contract number', () => {
    const html = renderToStaticMarkup(
      <ReservationOperationsWorkspace
        state="SUCCESS"
        rows={[{ ...row(), correctedAt: now }]}
        access={access}
        now={now}
        initialSection="inbox"
      />,
    );
    expect(html).toContain('data-corrected="true"');
    expect(html).toContain('اصلاح‌شده');
    const css = readFileSync(
      new URL('./workspace.module.css', import.meta.url),
      'utf8',
    );
    expect(html).toMatch(
      /TEST-test-request<small class="[^"]*correctedLabel[^"]*">اصلاح‌شده<\/small>/,
    );
    expect(css).not.toContain("tr[data-corrected='true']");
    expect(css).toMatch(/\.correctedLabel\s*\{[^}]*color: #dc2626/);
  });
  it.each([
    'LOADING',
    'EMPTY',
    'ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'CONFLICT',
    'NOT_CONFIGURED',
  ] as ViewState[])('does not disclose data in %s', (state) => {
    const html = renderToStaticMarkup(
      <ReservationOperationsWorkspace
        state={state}
        rows={[row()]}
        access={access}
        now={now}
        initialSection="inbox"
      />,
    );
    expect(html).not.toContain('Synthetic customer');
    expect(html).toContain('dir="rtl"');
  });
  it('defaults to deny-by-default even with success data', () => {
    const html = renderToStaticMarkup(
      <ReservationOperationsWorkspace
        state="SUCCESS"
        rows={[row()]}
        initialSection="inbox"
      />,
    );
    expect(html).toContain('ورود به حساب لازم است');
    expect(html).not.toContain('Synthetic customer');
  });
  it('shows scoped successful data and hides other branches', () => {
    const rows = [
      row(),
      {
        ...row('other'),
        branchId: 'other-branch',
        customerName: 'Other branch customer',
      },
    ];
    const html = renderToStaticMarkup(
      <ReservationOperationsWorkspace
        state="SUCCESS"
        rows={rows}
        access={access}
        now={now}
        initialSection="inbox"
      />,
    );
    expect(html).toContain('Synthetic customer');
    expect(html).not.toContain('Other branch customer');
    expect(accessibleRows(rows, { ...access, permissions: [] })).toEqual([]);
  });
  it('preview never grants data access and unconnected sections cannot issue or send', () => {
    for (const [section] of sections) {
      const html = renderToStaticMarkup(
        <ReservationOperationsWorkspace
          preview
          state="SUCCESS"
          rows={[row()]}
          access={access}
          now={now}
          initialSection={section}
        />,
      );
      expect(html).toContain('پیش‌نمایش ساختار');
      expect(html).not.toContain('Synthetic customer');
      expect(html).toContain('در انتظار اتصال');
    }
  });
  it('renders all service panes with disabled mutation buttons', () => {
    for (const section of [
      'tickets',
      'hotels',
      'vouchers',
      'insurance',
      'costs',
    ] as const) {
      const html = renderToStaticMarkup(
        <ReservationOperationsWorkspace
          access={access}
          initialSection={section}
        />,
      );
      expect(html).toMatch(/<button[^>]*disabled=""/);
      expect(html).not.toMatch(/href=".*\.(pdf|xlsx)"/);
    }
  });
  it('filters, sorts and clamps pagination without mutating source rows', () => {
    const rows = [
      row('b'),
      { ...row('a'), priority: 'URGENT' as const },
      { ...row('c'), status: 'ERROR' as const },
    ];
    const result = queryRows(rows, {
      ...defaultQuery,
      status: 'NEW',
      sort: 'priority',
      pageSize: 1,
    });
    expect(result.total).toBe(2);
    expect(result.rows[0]?.id).toBe('a');
    expect(rows[0]?.id).toBe('b');
    expect(
      queryRows(rows, { ...defaultQuery, search: 'TEST-c' }).rows[0]?.id,
    ).toBe('c');
    expect(
      queryRows(rows, { ...defaultQuery, service: 'INSURANCE' }).total,
    ).toBe(0);
    expect(queryRows(rows, { ...defaultQuery, page: Infinity }).page).toBe(1);
    expect(queryRows(rows, { ...defaultQuery, page: 900 }).page).toBe(1);
  });
  it('places contract operations below the scrollable inbox table', () => {
    const html = renderToStaticMarkup(
      <ReservationOperationsWorkspace
        state="SUCCESS"
        rows={[row()]}
        access={access}
        now={now}
        initialSection="inbox"
      />,
    );
    expect(html.indexOf('جدول درخواست‌های رزرواسیون')).toBeGreaterThan(-1);
    expect(html.indexOf('عملیات قرارداد انتخاب‌شده')).toBeGreaterThan(
      html.indexOf('جدول درخواست‌های رزرواسیون'),
    );
    expect(html).not.toContain('صفحه ۱ از');
  });
  it('selects the first visible contract for all operations by default', () => {
    const html = renderToStaticMarkup(
      <ReservationOperationsWorkspace
        state="SUCCESS"
        rows={[row('first'), row('second')]}
        access={access}
        now={now}
        initialSection="inbox"
      />,
    );
    expect(html).toContain('قرارداد انتخاب‌شده');
    expect(html).toContain('TEST-first');
    expect(html).toContain('aria-selected="true"');
    expect(html).not.toContain('قراردادی انتخاب نشده');
  });
  it('limits an unfiltered inbox to the previous calendar month through today', () => {
    const rows = [
      { ...row('recent'), createdAt: '2026-08-08T09:00:00.000Z' },
      { ...row('old'), createdAt: '2026-08-07T09:00:00.000Z' },
      { ...row('future'), createdAt: '2026-09-09T09:00:00.000Z' },
    ];
    const defaultWindow = queryRows(
      rows,
      reservationWindowQuery(defaultQuery, now),
    );
    expect(defaultWindow.total).toBe(1);
    expect(defaultWindow.rows[0]?.id).toBe('recent');

    const explicitRange = queryRows(
      rows,
      reservationWindowQuery(
        {
          ...defaultQuery,
          fromDate: '2026-08-01',
          toDate: '2026-08-07',
        },
        now,
      ),
    );
    expect(explicitRange.total).toBe(1);
    expect(explicitRange.rows[0]?.id).toBe('old');
  });
  it('counts daily unique documents once and excludes completed items from SLA', () => {
    const rows = [row('a'), { ...row('b'), status: 'COMPLETED' as const }];
    expect(dashboard(rows, now)).toMatchObject({ issuedToday: 1, nearSla: 1 });
  });
});

it('protects operation and audit projections independently of visible customer rows', () => {
  const operations = [
    {
      id: 'op-test',
      requestId: 'test-request',
      section: 'hotels' as const,
      title: 'Test hotel operation',
      statusLabel: 'Sent',
      fields: [],
    },
    {
      id: 'op-other',
      requestId: 'other-request',
      section: 'hotels' as const,
      title: 'Outside branch operation',
      statusLabel: 'Sent',
      fields: [],
    },
  ];
  const html = renderToStaticMarkup(
    <ReservationOperationsWorkspace
      state="SUCCESS"
      rows={[row()]}
      now={now}
      access={access}
      operations={operations}
      initialSection="hotels"
    />,
  );
  expect(html).toContain('Test hotel operation');
  expect(html).not.toContain('Outside branch operation');
  expect(html).not.toContain('رویدادهای درخواست');
});

it('renders workflow colors with readable statuses and accessible arrival alert', () => {
  const states = [
    'NEW',
    'WAITING_SUPPLIER',
    'SUPPLIER_CONFIRMED',
    'VOUCHER_ISSUED',
    'CANCELLED',
  ] as const;
  const html = renderToStaticMarkup(
    <ReservationOperationsWorkspace
      state="SUCCESS"
      rows={states.map((status) => ({ ...row(status), status }))}
      access={access}
      now={now}
      initialSection="inbox"
      newRequestCount={2}
    />,
  );
  for (const tone of ['pink', 'lightGray', 'darkGray', 'red'])
    expect(html).toContain(`data-tone="${tone}"`);
  for (const label of ['واچر صادرشده', 'آماده صدور واچر هتل', 'ابطال‌شده'])
    expect(html).toContain(label);
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain('درخواست جدید به');
  const denied = renderToStaticMarkup(
    <ReservationOperationsWorkspace
      state="SUCCESS"
      rows={[row()]}
      newRequestCount={2}
    />,
  );
  expect(denied).not.toContain('درخواست جدید به');
});

it('does not render generic reservation operation cards on the MANIFEST pane', () => {
  const html = renderToStaticMarkup(
    <ReservationOperationsWorkspace
      state="SUCCESS"
      rows={[row()]}
      access={access}
      initialSection="manifests"
      operations={[
        {
          id: 'manifest-operation',
          requestId: 'test-request',
          section: 'manifests',
          title: 'فرم رزواسیون داخلی',
          statusLabel: 'پیش‌نویس',
          fields: [{ label: 'شماره قرارداد', value: 'TEST-001' }],
        },
      ]}
    />,
  );
  expect(html).toContain('MANIFEST بلیط‌ها');
  expect(html).not.toContain('فرم رزواسیون داخلی');
  expect(html).not.toContain('TEST-001');
  expect(html).not.toContain('قرارداد انتخاب‌شده');
  expect(html).not.toContain('عملیات قرارداد انتخاب‌شده');
});

describe('reservation search submission and filter combinations', () => {
  it('provides an accessible submit button and reset in the inbox filter form', () => {
    const html = renderToStaticMarkup(
      <ReservationOperationsWorkspace
        state="SUCCESS"
        rows={[row()]}
        access={access}
        now={now}
        initialSection="inbox"
      />,
    );
    expect(html).toMatch(/<form[^>]*aria-label="جستجوی درخواست‌های رزواسیون"/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>جستجو<\/button>/);
    expect(html).toContain('پاک‌کردن فیلترها');
  });
  it('combines normalized search, status, service and date bounds', () => {
    const target = {
      ...row('match'),
      contractNumber: 'SC-2026-000123',
      customerName: 'علی کریمی',
      hotelName: 'ROYAL WINGS',
      destination: 'Antalya',
    };
    const rows = [
      target,
      { ...target, id: 'status', status: 'ERROR' as const },
      {
        ...target,
        id: 'service',
        services: ['BUS'] as RequestView['services'],
      },
      { ...target, id: 'date', createdAt: '2026-08-01T00:00:00.000Z' },
    ];
    for (const search of [
      '۰۰۰۱۲۳',
      '٠٠٠١٢٣',
      'علي كريمي',
      'royal wings',
      'ANTALYA',
    ]) {
      expect(
        queryRows(rows, {
          ...defaultQuery,
          search,
          status: 'NEW',
          service: 'HOTEL',
          fromDate: '2026-09-08',
          toDate: '2026-09-08',
        }).filteredRows.map((r) => r.id),
      ).toEqual(['match']);
    }
    expect(
      queryRows(rows, {
        ...defaultQuery,
        fromDate: '2026-09-09',
        toDate: '2026-09-08',
      }).dateError,
    ).toBeTruthy();
  });
  it('respects the selected date basis within the default one-month window', () => {
    const rows = [
      {
        ...row('travel'),
        createdAt: '2026-07-01T00:00:00.000Z',
        travelDate: '2026-09-08',
        receivedAt: '2026-09-08T09:00:00.000Z',
      },
    ];
    for (const dateBasis of ['receivedAt', 'travelDate'] as const) {
      const query = reservationWindowQuery({ ...defaultQuery, dateBasis }, now);
      expect(query.dateBasis).toBe(dateBasis);
      expect(queryRows(rows, query).filteredRows.map((r) => r.id)).toEqual([
        'travel',
      ]);
    }
    expect(
      queryRows(rows, reservationWindowQuery(defaultQuery, now)).total,
    ).toBe(0);
  });
});

it('marks only the second cell of noted requests, including the initially selected row', () => {
  const css = readFileSync(
    new URL('./workspace.module.css', import.meta.url),
    'utf8',
  );
  const ordinary = css.match(/\.requestTable td \{([^}]+)\}/)![1]!;
  const noted = css.match(
    /\.requestTable tbody tr td\[data-has-note='true'\] \{([^}]+)\}/,
  )![1]!;
  expect(ordinary).toContain('height: 32px');
  expect(ordinary).toContain('line-height: 20px');
  expect(ordinary).toContain('white-space: nowrap');
  expect(noted).not.toMatch(/(?:height|line-height|padding|white-space):/);
  const html = renderToStaticMarkup(
    <ReservationOperationsWorkspace
      state="SUCCESS"
      rows={[{ ...row('noted'), hasNotes: true }, row('plain')]}
      access={access}
      now={now}
      initialSection="inbox"
    />,
  );
  expect(html.match(/data-has-note="true"/g)).toHaveLength(1);
  expect(html).toMatch(
    /<tr[^>]*data-selected="true"[\s\S]*?<td[^>]*data-has-note="false"[\s\S]*?<td[^>]*data-has-note="true"/,
  );
  expect(html).toContain('دارای یادداشت در توضیحات');
});

it('keeps correction history but restores status colors after a reservation operation', () => {
  const html = renderToStaticMarkup(
    <ReservationOperationsWorkspace
      state="SUCCESS"
      rows={[{ ...row(), correctedAt: now, salesCorrectionPending: false }]}
      access={access}
      now={now}
      initialSection="inbox"
    />,
  );
  expect(html).toContain('data-corrected="false"');
  expect(html).not.toContain('data-corrected="true"');
});

it('shows an in-place inbox refresh action and retains the queue during a refresh error', () => {
  const html = renderToStaticMarkup(
    <ReservationOperationsWorkspace
      state="SUCCESS"
      rows={[row()]}
      access={access}
      now={now}
      initialSection="inbox"
      onRefresh={() => undefined}
      refreshError="Refresh failed"
    />,
  );
  expect(html).toContain('دریافت اطلاعات');
  expect(html).toContain('Refresh failed');
  expect(html).toContain('TEST-test-request');
  expect(html).not.toContain('window.location.reload');
  const busy = renderToStaticMarkup(
    <ReservationOperationsWorkspace
      state="SUCCESS"
      rows={[row()]}
      access={access}
      now={now}
      initialSection="inbox"
      onRefresh={() => undefined}
      refreshing
    />,
  );
  expect(busy).toContain('در حال دریافت اطلاعات…');
  expect(busy).toMatch(/<button[^>]*disabled=""[^>]*>/);
});
