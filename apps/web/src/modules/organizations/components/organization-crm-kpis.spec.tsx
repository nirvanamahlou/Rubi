import type { B2bCrmConnectionsV1 } from '@nora/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useDossierBranch: vi.fn(),
  useOrganizationCrmConnections: vi.fn(),
}));

vi.mock('./use-dossier-branch', () => ({
  useDossierBranch: mocks.useDossierBranch,
}));
vi.mock('./use-organization-crm-connections', () => ({
  useOrganizationCrmConnections: mocks.useOrganizationCrmConnections,
}));
vi.mock('./organization-sales-documents', () => ({
  OrganizationSalesDocuments: () => null,
}));

import { OrganizationCrmKpis } from './organization-crm-kpis';

const data = {
  version: 1,
  organizationId: 'organization-a',
  branchId: 'branch-a',
  customers: [{ id: 'customer-a', displayName: 'Agency', status: 'active' }],
  contracts: [
    {
      id: 'contract-a',
      contractNumber: 'SC-100',
      customerId: 'customer-a',
      customerNameSnapshot: 'Agency',
      status: 'CONFIRMED',
      settlementStatus: 'UNPAID',
      reservationStatus: 'ACCEPTED',
      balances: [
        {
          amount: '100',
          currencyCode: 'IRR',
          confirmedPaid: '0',
          pendingFinance: '0',
          outstanding: '100',
        },
      ],
      updatedAt: '2026-10-03T00:00:00.000Z',
    },
  ],
  payments: [],
  reservations: [
    {
      id: 'reservation-a',
      contractId: 'contract-a',
      contractNumber: 'SC-100',
      customerNameSnapshot: 'Agency',
      passengerCount: 1,
      services: ['FLIGHT'],
      status: 'NEW',
      receivedAt: '2026-10-03T00:00:00.000Z',
    },
  ],
  financeExposure: { status: 'UNAVAILABLE', reason: 'NO_EXPOSURE_SNAPSHOT' },
  unavailableSources: {},
  observedAt: '2026-10-03T00:00:00.000Z',
} satisfies B2bCrmConnectionsV1;

function renderKpis(snapshot: B2bCrmConnectionsV1) {
  mocks.useOrganizationCrmConnections.mockReturnValue({
    data: snapshot,
    loading: false,
    error: '',
  });
  return renderToStaticMarkup(
    <OrganizationCrmKpis organizationId="organization-a" />,
  );
}

function metricValue(markup: string, label: string) {
  const value = markup.match(
    new RegExp(`<small>${label}</small><strong>([^<]*)</strong>`),
  )?.[1];
  expect(value).toBeDefined();
  return value;
}

describe('organization CRM KPI source availability', () => {
  beforeEach(() => {
    mocks.useDossierBranch.mockReturnValue({
      branchId: 'branch-a',
      setBranchId: vi.fn(),
      branches: [{ id: 'branch-a', name: 'Branch A' }],
      sessionError: '',
      sessionContextKey: 'session-a',
    });
  });

  it('does not present denied, failed or incomplete sources as concrete values', () => {
    const markup = renderKpis({
      ...data,
      unavailableSources: {
        CUSTOMERS: 'مشتریان در دسترس نیستند.',
        SALES: 'قراردادها در دسترس نیستند.',
        RESERVATIONS: 'رزرواسیون ناقص است.',
      },
    });

    expect(metricValue(markup, 'مشتری سازمانی مرتبط')).toBe('—');
    expect(metricValue(markup, 'قرارداد فروش مرتبط')).toBe('—');
    expect(metricValue(markup, 'سفارش باز')).toBe('—');
    expect(metricValue(markup, 'مانده قراردادهای فروش')).toBe('—');
    expect(markup).toContain('مشتریان در دسترس نیستند.');
    expect(markup).toContain('قراردادها در دسترس نیستند.');
    expect(markup).toContain('رزرواسیون ناقص است.');
  });

  it('distinguishes a ready empty source from an unavailable source', () => {
    const markup = renderKpis({
      ...data,
      customers: [],
      contracts: [],
      reservations: [],
    });

    expect(metricValue(markup, 'مشتری سازمانی مرتبط')).toBe('۰');
    expect(metricValue(markup, 'قرارداد فروش مرتبط')).toBe('۰');
    expect(metricValue(markup, 'سفارش باز')).toBe('۰');
    expect(metricValue(markup, 'مانده قراردادهای فروش')).toBe('۰');
  });

  it('keeps a valid Sales balance when only payment detail is unavailable', () => {
    const markup = renderKpis({
      ...data,
      unavailableSources: {
        SALES_PAYMENTS: 'جزئیات پرداخت در دسترس نیست.',
      },
    });

    expect(metricValue(markup, 'مانده قراردادهای فروش')).toBe('۱۰۰ IRR');
    expect(markup).toContain('جزئیات پرداخت در دسترس نیست.');
  });
});
