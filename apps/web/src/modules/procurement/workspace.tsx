'use client';

export function ProcurementWorkspace() {
  return (
    <div className="-mx-4 min-h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-border bg-[#f3f6fc] sm:-mx-6 lg:-mx-8">
      <iframe
        title="خرید و تأمین"
        src="/procurement-optimized.html"
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
