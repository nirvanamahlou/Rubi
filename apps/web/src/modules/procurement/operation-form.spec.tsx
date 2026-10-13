import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { ProcurementRequestV1 } from '@nora/contracts';
import type { Bootstrap } from './api';
import { emptyDraft } from './model';
import {
  OperationForm,
  orderAmendmentFields,
  orderAmendmentDocuments,
  recordLabel,
  validateOrderFollowUp,
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
  it('rejects incomplete follow-ups with actionable field messages and accepts a receipt-backed return', () => {
    const fields = {
      orderId: 'order',
      receiptItemId: 'receipt',
      quantity: '0.25',
      returnedAt: '2026-10-07T00:00:00.000Z',
      reason: 'آسیب کالا',
    };
    const documents = [{ id: 'document', versionId: 'version' }];
    expect(validateOrderFollowUp('RETURN', fields, documents)).toBe('');
    expect(
      validateOrderFollowUp(
        'RETURN',
        { ...fields, receiptItemId: '' },
        documents,
      ),
    ).toContain('ردیف رسید');
    for (const quantity of ['0', '0.0000', '-1', 'abc', '0.00001', '01'])
      expect(
        validateOrderFollowUp('RETURN', { ...fields, quantity }, documents),
      ).toContain('مقدار مرجوعی');
    expect(
      validateOrderFollowUp('RETURN', { ...fields, returnedAt: '' }, documents),
    ).toContain('تاریخ مرجوعی');
    expect(
      validateOrderFollowUp('RETURN', { ...fields, reason: ' ' }, documents),
    ).toContain('توضیحات');
    expect(validateOrderFollowUp('RETURN', fields, [])).toContain(
      'مدرک مرجوعی',
    );
    expect(
      validateOrderFollowUp(
        'DISCREPANCY',
        { orderId: 'order', description: 'کسری کالا' },
        [],
      ),
    ).toBe('');
    expect(validateOrderFollowUp('DISCREPANCY', {}, [])).toContain('سفارش');
    expect(
      validateOrderFollowUp(
        'DISCREPANCY',
        { orderId: 'order', description: ' ' },
        [],
      ),
    ).toContain('شرح مغایرت');
  });
  it('restores selected order attachments without substituting request attachments', () => {
    expect(
      orderAmendmentDocuments({
        data: { documents: [{ id: 'invoice', versionId: 'invoice-version' }] },
      }),
    ).toEqual([{ id: 'invoice', versionId: 'invoice-version' }]);
    expect(orderAmendmentDocuments({})).toEqual([]);
  });
  it('shows the consolidated order form with price, warranty, dates and archived upload', () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <OperationForm
          request={request}
          kind="orders"
          initialAction="ORDER_FORM"
          bootstrap={bootstrap([
            'procurement.order.manage',
            'procurement.quote.manage',
            'procurement.quote.select',
          ])}
          onChanged={() => undefined}
        />
      </QueryClientProvider>,
    );
    for (const text of [
      'تأمین‌کننده',
      'موعد تحویل',
      'محل تحویل',
      'شرایط پرداخت',
      'ضمانت',
      'ارز',
      'کد پیگیری',
      'بارگذاری فایل سند سفارش',
      'اعتبار قیمت',
    ])
      expect(html).toContain(text);
    expect(html).not.toContain('انتخاب ثبت‌شده');
    expect(html).toContain('قیمت واحد');
    expect(html).toContain('value="12"');
    expect(html).not.toContain('id="proc-operation"');
  });
  it('opens order-bound discrepancy and return forms with their required dates', () => {
    const render = (
      action: string,
      kind: string,
      permission: Bootstrap['permissions'][number],
    ) =>
      renderToStaticMarkup(
        <QueryClientProvider client={new QueryClient()}>
          <OperationForm
            request={request}
            kind={kind}
            initialAction={action}
            initialRecord={{ id: 'order-1' }}
            bootstrap={bootstrap([permission])}
            onChanged={() => undefined}
          />
        </QueryClientProvider>,
      );
    const discrepancy = render(
      'DISCREPANCY',
      'discrepancies',
      'procurement.discrepancy.manage',
    );
    expect(discrepancy).toContain('تاریخ مغایرت');
    expect(discrepancy).toContain('نوع مغایرت');
    expect(discrepancy).not.toContain('سفارش مرجع');
    const returned = render('RETURN', 'returns', 'procurement.return.manage');
    for (const text of ['مقدار مرجوعی', 'تاریخ مرجوعی', 'مبدأ مقدار مرجوعی'])
      expect(returned).toContain(text);
    expect(returned).toContain('بارگذاری فایل مدرک مرجوعی');
    expect(returned).toContain('انتخاب فایل مدرک مرجوعی');
    expect(returned).toContain('aria-required="true"');
  });
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
      warranty: '',
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
      warranty: '',
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
          bootstrap={bootstrap([
            'procurement.order.amend',
            'procurement.order.cancel',
            'procurement.order.issue',
          ])}
          onChanged={() => undefined}
        />
      </QueryClientProvider>,
    );
    expect(edit).toContain('اصلاح سفارش و ارسال برای تأیید مجدد');
    expect(edit).toContain('TRACK-1');
    expect(edit).toContain('بارگذاری فایل فاکتور');
    expect(edit).toContain('انتخاب فایل فاکتور');
    expect(edit).not.toContain('id="proc-operation"');
    expect(edit).not.toContain('سفارش مرجع');
    expect(edit).not.toContain('تأمین‌کننده جدید یا فعلی');
    expect(edit).not.toContain('id="operation-currencyCode"');
    expect(edit).not.toContain('افزودن ردیف');
    expect(edit).not.toContain('حذف ردیف');
    expect(edit).toMatch(/id="op-line-0"[^>]*disabled/);
    expect(edit).toContain('readOnly');
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
  it('keeps receiver selection without redundant help copy', () => {
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
    expect(html).not.toContain(
      'ویرایش سوابق عملیاتی به‌صورت نسخه یا اصلاح جبرانی',
    );
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
