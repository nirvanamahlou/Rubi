import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { ProcurementRequestV1 } from '@nora/contracts';
import type { Bootstrap } from './api';
import { emptyDraft } from './model';
import { OperationForm } from './operation-form';

const request: ProcurementRequestV1 = {
  id: 'c1524f14-1b48-4ce4-b276-c2e2be0379db',
  number: 'PR-1405-901',
  version: 1,
  status: 'SOURCING',
  requesterUserId: 'requester-1',
  requesterEmployeeId: null,
  ownerUserId: null,
  createdAt: '2026-09-16T10:00:00.000Z',
  updatedAt: '2026-09-16T10:00:00.000Z',
  draft: {
    ...emptyDraft(),
    branchId: 'branch-1',
    title: 'تجهیزات شبکه شعبه غرب',
    items: [
      {
        id: 'item-1',
        kind: 'GOODS',
        description: 'سوییچ شبکه',
        specification: '',
        quantity: '12',
        unit: 'عدد',
        period: '',
        acceptanceCriteria: '',
      },
    ],
  },
};

const bootstrap = (permissions: Bootstrap['permissions']): Bootstrap => ({
  permissions,
  branches: [{ id: 'branch-1', label: 'شعبه مرکزی' }],
  currencies: [{ id: 'irr', code: 'IRR', name: 'ریال ایران' }],
  requester: null,
  policy: 'CONFIGURED',
  finance: 'CONNECTED',
  documents: 'CONNECTED',
  travel: 'NOT_CONNECTED',
});

describe('Procurement lifecycle operation forms', () => {
  it('makes the receiver form available and explains versioned corrections', () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <OperationForm
          request={request}
          kind="receipts"
          bootstrap={bootstrap([
            'procurement.receipt.manage',
            'procurement.acceptance.manage',
          ])}
          onChanged={() => undefined}
        />
      </QueryClientProvider>,
    );

    expect(html).toContain('ثبت رسید کالا');
    expect(html).toContain('سفارش مرجع');
    expect(html).toContain('ویرایش سوابق عملیاتی به‌صورت نسخه یا اصلاح جبرانی');
  });

  it('explains the required operational role instead of leaving a blank lifecycle section', () => {
    const html = renderToStaticMarkup(
      <OperationForm
        request={request}
        kind="invoices"
        bootstrap={bootstrap([])}
        onChanged={() => undefined}
      />,
    );

    expect(html).toContain('ثبت و ویرایش این مرحله');
    expect(html).toContain('کارشناس تأمین و سفارش');
  });
});
