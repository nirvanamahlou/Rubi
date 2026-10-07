import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Bootstrap } from './api';
import { PurchaseOrdersSection, OrderOperation } from './orders-section';

describe('Persisted purchase order table', () => {
  it('chooses a purchase request for a new order rather than an existing order', () => {
    const client = new QueryClient();
    client.setQueryData(['procurement', 'order-requests', 1, ''], {
      items: [
        {
          id: 'approved-request',
          status: 'APPROVED',
          draft: { title: 'درخواست خرید میز اداری' },
        },
        {
          id: 'draft-request',
          status: 'DRAFT',
          draft: { title: 'پیش‌نویس تأییدنشده' },
        },
      ],
      page: 1,
      hasMore: false,
    });
    const bootstrap: Bootstrap = {
      branches: [],
      currencies: [],
      requester: null,
      documents: 'UNAVAILABLE',
      finance: 'NOT_CONNECTED',
      travel: 'NOT_CONNECTED',
      policy: 'POLICY_NOT_CONFIGURED',
      permissions: [],
    };
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <OrderOperation
          action="ORDER_FORM"
          initialRequestId="approved-request"
          bootstrap={bootstrap}
          onChanged={() => undefined}
        />
      </QueryClientProvider>,
    );
    expect(html).toContain('درخواست خرید میز اداری');
    expect(html).toContain('درخواست خرید');
    expect(html).not.toContain('پیش‌نویس تأییدنشده');
    expect(html).not.toContain('سفارش مرجع');
  });
  it('renders full titles, supplier identity and accessible icon actions on each saved order', () => {
    const client = new QueryClient();
    const title =
      'خرید تجهیزات شبکه برای ساختمان مرکزی و شعبه غرب با عنوان کامل';
    client.setQueryData(['procurement', 'orders-table', '', '', '', '', 1], {
      items: [
        {
          id: 'order-1',
          requestId: 'request-1',
          requestTitle: title,
          supplierId: 'supplier-1',
          currencyCode: 'IRR',
          totalAmount: '150000',
          status: 'ISSUED',
          data: { supplier: { label: 'تأمین‌کننده شبکه' } },
        },
      ],
      page: 1,
      hasMore: false,
    });
    client.setQueryData(['procurement', 'approved-for-orders', 1], {
      items: [
        {
          id: 'approved-1',
          status: 'APPROVED',
          draft: { title: 'درخواست تأییدشده جدید' },
        },
      ],
      page: 1,
      hasMore: false,
    });
    const bootstrap: Bootstrap = {
      branches: [],
      currencies: [],
      requester: null,
      documents: 'UNAVAILABLE',
      finance: 'NOT_CONNECTED',
      travel: 'NOT_CONNECTED',
      policy: 'POLICY_NOT_CONFIGURED',
      permissions: [
        'procurement.order.manage',
        'procurement.quote.manage',
        'procurement.quote.select',
        'procurement.order.amend',
        'procurement.order.cancel',
        'procurement.discrepancy.manage',
        'procurement.return.manage',
      ],
    };
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <PurchaseOrdersSection bootstrap={bootstrap} />
      </QueryClientProvider>,
    );
    expect(html).toContain('<table');
    expect(html).toContain(title);
    expect(html).toContain('تأمین‌کننده شبکه');
    for (const label of [
      'مشاهده سفارش',
      'ویرایش سفارش',
      'حذف سفارش',
      'ثبت مغایرت',
      'ثبت مرجوعی',
    ])
      expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain('سفارش جدید');
    expect(html).toContain('درخواست تأییدشده جدید');
    expect(html).toContain('ثبت سفارش');
    expect(html).not.toContain('پیش‌نمایش فرم');
  });
});
