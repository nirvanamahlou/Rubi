import { describe, expect, it } from 'vitest';
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
