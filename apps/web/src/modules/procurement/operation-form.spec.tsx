import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { ProcurementRequestV1 } from '@nora/contracts';
import type { Bootstrap } from './api';
import { emptyDraft } from './model';
import {
  OperationForm,
  orderAmendmentFields,
  recordLabel,
} from './operation-form';

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
  documents: 'AVAILABLE',
  travel: 'NOT_CONNECTED',
});

describe('Procurement lifecycle operation forms', () => {
  it('loads the selected order currency and supplier instead of draft defaults when amending', () => {
    expect(
      orderAmendmentFields({
        id: 'order-1',
        payload: {
          supplierId: 'supplier-2',
          currencyCode: 'USD',
          expectedAt: '2026-10-20T00:00:00.000Z',
          deliveryLocation: 'شعبه مرکزی',
          trackingCode: 'TRACK-1',
          paymentTerms: '۳۰ روزه',
        },
      }),
    ).toEqual({
      orderId: 'order-1',
      supplierId: 'supplier-2',
      currencyCode: 'USD',
      expectedAt: '2026-10-20T00:00:00.000Z',
      deliveryLocation: 'شعبه مرکزی',
      trackingCode: 'TRACK-1',
      paymentTerms: '۳۰ روزه',
      reason: '',
    });
    expect(orderAmendmentFields({})).toEqual({
      orderId: '',
      supplierId: '',
      currencyCode: '',
      expectedAt: '',
      deliveryLocation: '',
      trackingCode: '',
      paymentTerms: '',
      reason: '',
    });
  });
  it('identifies operational choices using their persisted payload and current status', () => {
    const label = recordLabel({
      status: 'ISSUED',
      payload: { number: 'PO-100', currencyCode: 'USD', totalAmount: '480' },
    });
    expect(label).toContain('PO-100');
    expect(label).toContain('صادرشده');
    expect(label).toContain('480 USD');
  });
  it('offers order tracking and archived document upload alongside the approved selection', () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <OperationForm
          request={request}
          kind="orders"
          bootstrap={bootstrap(['procurement.order.manage'])}
          onChanged={() => undefined}
        />
      </QueryClientProvider>,
    );
    expect(html).toContain('انتخاب ثبت‌شده');
    expect(html).toContain('کد پیگیری');
    expect(html).toContain('بارگذاری فایل سند سفارش');
    expect(html).toContain('اسناد و فایل‌ها');
  });
  it('opens an order edit form prefilled from the persisted order and offers an audited cancellation form', () => {
    const order = {
      id: 'order-1',
      status: 'ISSUED',
      supplierId: 'supplier-2',
      currencyCode: 'USD',
      expectedAt: '2026-10-20T00:00:00.000Z',
      deliveryLocation: 'شعبه مرکزی',
      trackingCode: 'TRACK-1',
      paymentTerms: '۳۰ روزه',
      lines: [
        {
          requestItemId: 'item-1',
          quantity: '12',
          unitPrice: '40',
          discountAmount: '0',
          taxAmount: '0',
          extraCostAmount: '0',
        },
      ],
    };
    const edit = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <OperationForm
          request={request}
          kind="orders"
          initialAction="AMEND_ORDER"
          initialRecord={order}
          bootstrap={bootstrap(['procurement.order.amend'])}
          onChanged={() => undefined}
        />
      </QueryClientProvider>,
    );
    expect(edit).toContain('اصلاح سفارش و ارسال برای تأیید مجدد');
    expect(edit).toContain('TRACK-1');
    expect(edit).toContain('شعبه مرکزی');
    expect(edit).toContain('۳۰ روزه');
    const cancel = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <OperationForm
          request={request}
          kind="orders"
          initialAction="CANCEL_ORDER"
          initialRecord={order}
          bootstrap={bootstrap(['procurement.order.cancel'])}
          onChanged={() => undefined}
        />
      </QueryClientProvider>,
    );
    expect(cancel).toContain('لغو سفارش');
    expect(cancel).toContain('دلیل لغو سفارش');
  });
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

  it('offers direct invoice upload through the Documents archive', () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <OperationForm
          request={request}
          kind="invoices"
          bootstrap={bootstrap(['procurement.invoice.manage'])}
          onChanged={() => undefined}
        />
      </QueryClientProvider>,
    );

    expect(html).toContain('بارگذاری فایل فاکتور');
    expect(html).toContain('اسناد و فایل‌ها');
  });
});
