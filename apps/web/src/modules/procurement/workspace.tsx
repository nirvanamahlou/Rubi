'use client';

import { useEffect, useRef } from 'react';

const procurementViews = new Set([
  'home',
  'requests',
  'approvals',
  'suppliers',
  'quotes',
  'orders',
  'receipts',
  'invoices',
  'travel',
  'contracts',
  'settings',
]);

export function ProcurementWorkspace() {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const syncFrameFromAddress = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedView = params.get('section') ?? 'home';
      const view = procurementViews.has(requestedView) ? requestedView : 'home';
      const kind = params.get('kind');
      const id = params.get('record');

      frameRef.current?.contentWindow?.postMessage(
        {
          type: 'procurement:set-location',
          view,
          selected: kind && id ? { kind, id } : null,
        },
        window.location.origin,
      );
    };

    const updateAddress = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin
        || event.source !== frameRef.current?.contentWindow
        || event.data?.type !== 'procurement:navigate'
        || !procurementViews.has(event.data.view)
      ) return;

      const url = new URL(window.location.href);
      url.searchParams.set('section', event.data.view);
      if (event.data.selected?.kind && event.data.selected?.id) {
        url.searchParams.set('kind', event.data.selected.kind);
        url.searchParams.set('record', event.data.selected.id);
      } else {
        url.searchParams.delete('kind');
        url.searchParams.delete('record');
      }

      const nextAddress = `${url.pathname}${url.search}${url.hash}`;
      const currentAddress = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextAddress !== currentAddress) window.history.pushState(window.history.state, '', nextAddress);
    };

    window.addEventListener('message', updateAddress);
    window.addEventListener('popstate', syncFrameFromAddress);
    return () => {
      window.removeEventListener('message', updateAddress);
      window.removeEventListener('popstate', syncFrameFromAddress);
    };
  }, []);

  const syncFrameFromAddress = () => {
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get('section') ?? 'home';
    const view = procurementViews.has(requestedView) ? requestedView : 'home';
    const kind = params.get('kind');
    const id = params.get('record');
    frameRef.current?.contentWindow?.postMessage(
      { type: 'procurement:set-location', view, selected: kind && id ? { kind, id } : null },
      window.location.origin,
    );
  };

  return (
    <div className="-mx-4 min-h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-border bg-[#f3f6fc] sm:-mx-6 lg:-mx-8">
      <iframe
        ref={frameRef}
        title="خرید و تأمین"
        src="/procurement-optimized.html"
        onLoad={syncFrameFromAddress}
        className="h-[calc(100vh-8rem)] min-h-[760px] w-full border-0"
      />
    </div>
  );
}

export function QuotationComparison({
  records,
}: {
  records: Array<Record<string, unknown>>;
}) {
  const currencies = new Set(records.map((row) => String(row.currencyCode)));
  return (
    <div className="space-y-3">
      {currencies.size > 1 && (
        <div role="alert">بدون تصویر نرخ ارز معتبر، رتبه‌بندی بین ارزها انجام نمی‌شود.</div>
      )}
      <div className="overflow-x-auto">
        <table>
          <caption>مقایسه پیشنهادهای این صفحه</caption>
          <thead>
            <tr>
              {['تأمین‌کننده', 'مبلغ و ارز', 'کیفیت', 'شرایط پرداخت'].map((label) => (
                <th key={label} scope="col">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const data = typeof record.data === 'object' && record.data !== null
                ? record.data as Record<string, unknown>
                : {};
              return (
                <tr key={String(record.id)}>
                  <td>{String(data.supplierName ?? record.supplierId ?? '—')}</td>
                  <td>{String(data.totalAmount ?? record.totalAmount ?? '—')} {String(data.currencyCode ?? record.currencyCode ?? '')}</td>
                  <td>{String(data.qualityNote ?? 'ثبت نشده')}</td>
                  <td>{String(data.paymentTerms ?? 'ثبت نشده')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
