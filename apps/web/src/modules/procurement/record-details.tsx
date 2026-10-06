'use client';
import { Button } from '@/components/ui/button';
import { formatProcurementRecordValue } from './presentation';

const recordLabels: Record<string, string> = {
  number: 'شماره',
  status: 'وضعیت',
  action: 'عملیات',
  reason: 'دلیل',
  createdAt: 'زمان ثبت',
  updatedAt: 'آخرین تغییر',
  amount: 'مبلغ',
  totalAmount: 'مبلغ کل',
  currencyCode: 'ارز',
  supplierId: 'تأمین‌کننده',
  supplierName: 'نام تأمین‌کننده',
  orderId: 'سفارش',
  invoiceNumber: 'شماره فاکتور',
  dueAt: 'سررسید',
  expectedAt: 'موعد تحویل',
  version: 'نسخه',
  quantity: 'مقدار',
  description: 'شرح',
  deliveryAt: 'تاریخ تحویل',
  paymentTerms: 'شرایط پرداخت',
  warranty: 'ضمانت',
  qualityNote: 'ارزیابی کیفیت',
  validUntil: 'اعتبار پیشنهاد',
  quotedAt: 'تاریخ پیشنهاد',
  acceptedQuantity: 'مقدار پذیرفته‌شده',
  rejectedQuantity: 'مقدار ردشده',
  unitPrice: 'قیمت واحد',
  taxAmount: 'مالیات',
  discountAmount: 'تخفیف',
  extraCostAmount: 'هزینه جانبی',
  resolution: 'نتیجه رسیدگی',
  evidence: 'شواهد پذیرش',
  receivedAt: 'تاریخ دریافت',
  acceptedAt: 'تاریخ پذیرش',
  returnedAt: 'تاریخ مرجوعی',
  receivedDelta: 'تغییر مقدار دریافت',
  acceptedDelta: 'تغییر مقدار پذیرفته‌شده',
  rejectedDelta: 'تغییر مقدار ردشده',
  disposition: 'مبدأ مقدار مرجوعی',
  trackingCode: 'کد پیگیری',
};
export function recordData(record: Record<string, unknown>) {
  return {
    ...(typeof record.data === 'object' && record.data !== null
      ? record.data
      : {}),
    ...record,
  } as Record<string, unknown>;
}
export function RecordCard({ record }: { record: Record<string, unknown> }) {
  const entries = Object.entries(recordData(record)).filter(
    ([key, value]) =>
      key in recordLabels &&
      !(key === 'supplierId' && recordData(record).supplierName) &&
      value !== null &&
      typeof value !== 'object',
  );
  return (
    <div className="rounded-xl border border-border p-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt className="text-muted-foreground">{recordLabels[key]}</dt>
            <dd className="mt-1 break-words">
              {formatProcurementRecordValue(key, value)}
            </dd>
          </div>
        ))}
      </dl>
      {!entries.length && <p className="text-sm">رکورد ثبت‌شده</p>}
      <DocumentLinks documents={recordData(record).documents} />
      {Array.isArray(record.lines) && record.lines.length > 0 && (
        <details className="mt-4 rounded-xl bg-muted/30 p-3">
          <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            اقلام و مبالغ ({record.lines.length.toLocaleString('fa-IR')} ردیف)
          </summary>
          <div className="mt-3 space-y-3">
            {(record.lines as Record<string, unknown>[]).map((line, index) => (
              <RecordCard key={String(line.id ?? index)} record={line} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
export function DocumentLinks({ documents }: { documents: unknown }) {
  if (!Array.isArray(documents)) return null;
  const references = documents.filter(
    (value): value is { id: string; versionId: string } =>
      value !== null &&
      typeof value === 'object' &&
      typeof value.id === 'string' &&
      typeof value.versionId === 'string',
  );
  if (!references.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        مدرک در آرشیو اسناد باز می‌شود؛ نسخه مرجع این پرونده کنار هر پیوند درج
        شده است.
      </p>
      {references.map((reference, index) => (
        <div
          key={`${reference.id}-${reference.versionId}`}
          className="flex flex-wrap items-center gap-2"
        >
          <Button asChild variant="outline" size="sm">
            <a
              href={`/documents?document=${encodeURIComponent(reference.id)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              مشاهده مدرک {(index + 1).toLocaleString('fa-IR')} (زبانه جدید)
            </a>
          </Button>
          <span className="break-all text-xs text-muted-foreground">
            نسخه مرجع: {reference.versionId}
          </span>
        </div>
      ))}
    </div>
  );
}
