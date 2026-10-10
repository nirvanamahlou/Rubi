import type { B2bCrmConnectionsV1 } from '@nora/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { OrganizationSalesDocuments } from './organization-sales-documents';

const connections = {
  version: 1,
  organizationId: 'organization-a',
  branchId: 'branch-a',
  customers: [],
  contracts: [
    {
      id: 'contract-a',
      contractNumber: 'SC-100',
      customerId: 'customer-a',
      customerNameSnapshot: 'Agency',
      status: 'CONFIRMED',
      settlementStatus: 'UNPAID',
      reservationStatus: 'ACCEPTED',
      balances: [],
      updatedAt: '2026-10-03T00:00:00.000Z',
    },
  ],
  payments: [],
  reservations: [],
  financeExposure: { status: 'UNAVAILABLE', reason: 'NO_EXPOSURE_SNAPSHOT' },
  unavailableSources: {},
  observedAt: '2026-10-03T00:00:00.000Z',
} satisfies B2bCrmConnectionsV1;

describe('organization Sales artifacts', () => {
  it('renders all three owner actions only for a canonical CRM contract', () => {
    const html = renderToStaticMarkup(
      <OrganizationSalesDocuments
        organizationId="organization-a"
        branchId="branch-a"
        sessionContextKey="session-a"
        connections={connections}
      />,
    );
    expect(html).toContain('SC-100');
    expect(html).toContain('خروجی قرارداد / PDF');
    expect(html).toContain('مدارک مسافر · تأیید مالی');
    expect(html).toContain('رسیدهای پرداخت');
    expect(html).not.toContain('آپلود رسید');
  });

  it('shows an unavailable Sales source instead of a zero-artifact claim', () => {
    const html = renderToStaticMarkup(
      <OrganizationSalesDocuments
        organizationId="organization-a"
        branchId="branch-a"
        sessionContextKey="session-a"
        connections={{
          ...connections,
          contracts: [],
          unavailableSources: { SALES: 'مجوز فروش موجود نیست.' },
        }}
      />,
    );
    expect(html).toContain('قراردادهای فروش در دسترس نیست');
    expect(html).toContain('مجوز فروش موجود نیست.');
    expect(html).not.toContain('ثبت نشده است');
  });
});
