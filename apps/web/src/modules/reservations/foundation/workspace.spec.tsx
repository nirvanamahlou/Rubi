import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  accessibleRows,
  dashboard,
  defaultQuery,
  queryRows,
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
      'manifests',
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
  const timeline = [
    {
      id: 'event-test',
      requestId: 'test-request',
      actorLabel: 'Test auditor',
      actionLabel: 'Test audit event',
      occurredAt: now,
      outcome: 'ALLOWED' as const,
    },
  ];
  const html = renderToStaticMarkup(
    <ReservationOperationsWorkspace
      state="SUCCESS"
      rows={[row()]}
      access={access}
      operations={operations}
      initialSection="hotels"
    />,
  );
  expect(html).toContain('Test hotel operation');
  expect(html).not.toContain('Outside branch operation');
  const denied = renderToStaticMarkup(
    <ReservationOperationsWorkspace
      state="SUCCESS"
      rows={[row()]}
      access={access}
      timeline={timeline}
      initialSection="timeline"
    />,
  );
  expect(denied).not.toContain('Test audit event');
  const allowed = renderToStaticMarkup(
    <ReservationOperationsWorkspace
      state="SUCCESS"
      rows={[row()]}
      access={{
        ...access,
        permissions: [...access.permissions, 'reservations.audit.read'],
      }}
      timeline={timeline}
      initialSection="timeline"
    />,
  );
  expect(allowed).toContain('Test audit event');
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
