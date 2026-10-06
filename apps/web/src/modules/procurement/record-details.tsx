'use client';
import type { ReactNode } from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/overlays';
import { formatProcurementRecordValue } from './presentation';

const recordLabels: Record<string, string> = {
  title: 'عنوان درخواست',
  name: 'نام',
  code: 'شناسه',
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
  purchaseType: 'دسته خرید',
  category: 'دسته درخواست',
  needReason: 'شرح نیاز',
  requiredAt: 'موعد موردنیاز',
  priority: 'اولویت',
  urgent: 'خرید اضطراری',
  urgencyReason: 'دلیل فوریت',
  estimatedAmount: 'مبلغ برآورد',
  unknownEstimateReason: 'دلیل نامشخص بودن مبلغ',
  deliveryLocation: 'محل تحویل',
  notes: 'یادداشت',
  branchId: 'شناسه شعبه',
  unitId: 'شناسه واحد سازمانی',
  requesterEmployeeId: 'شناسه کارمند درخواست‌کننده',
  requesterUserId: 'شناسه کاربر درخواست‌کننده',
  ownerUserId: 'شناسه مسئول پیگیری',
  collaborationStatus: 'وضعیت همکاری',
  isActive: 'فعال',
  address: 'نشانی',
  primaryPhoneMasked: 'شماره تماس اصلی',
  serviceCodes: 'خدمات قابل ارائه',
  organizationId: 'شناسه سازمان',
  reference: 'مرجع تأمین‌کننده',
  quotation: 'پیشنهاد منتخب',
  primaryPhone: 'شماره تماس اصلی',
  createdByUserId: 'ثبت‌کننده',
  requestId: 'شناسه درخواست',
  selectedByUserId: 'انتخاب‌کننده',
};
export function recordData(record: Record<string, unknown>) {
  return {
    ...(typeof record.data === 'object' && record.data !== null
      ? record.data
      : {}),
    ...record,
  } as Record<string, unknown>;
}
export function RecordCard({
  record,
  showPreviewAction = false,
}: {
  record: Record<string, unknown>;
  showPreviewAction?: boolean;
}) {
  const data = recordData(record);
  const draft =
    typeof record.draft === 'object' && record.draft !== null
      ? (record.draft as Record<string, unknown>)
      : null;
  const entries = Object.entries(data).filter(
    ([key, value]) =>
      key in recordLabels &&
      !(key === 'supplierId' && data.supplierName) &&
      value !== null &&
      typeof value !== 'object',
  );
  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
      {showPreviewAction && (
        <div className="flex justify-end">
          <RecordPreviewButton record={record} />
        </div>
      )}
      <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt className="text-muted-foreground">{recordLabels[key]}</dt>
            <dd className="mt-1 break-words font-medium">
              {formatProcurementRecordValue(key, value)}
            </dd>
          </div>
        ))}
      </dl>
      {!entries.length && <p className="text-sm">رکورد ثبت‌شده</p>}
      <DocumentLinks documents={data.documents ?? draft?.documents} />
      {(() => {
        const lines = Array.isArray(record.lines)
          ? record.lines
          : Array.isArray(draft?.items)
            ? draft.items
            : [];
        return lines.length ? (
          <details className="rounded-xl bg-muted/30 p-3">
            <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              اقلام و مبالغ ({lines.length.toLocaleString('fa-IR')} ردیف)
            </summary>
            <div className="mt-3 space-y-3">
              {(lines as Record<string, unknown>[]).map((line, index) => (
                <RecordCard key={String(line.id ?? index)} record={line} />
              ))}
            </div>
          </details>
        ) : null;
      })()}
    </div>
  );
}

export function RecordPreviewButton({
  record,
  title,
  children,
  className,
  variant = 'outline',
}: {
  record: Record<string, unknown>;
  title?: string;
  children?: ReactNode;
  className?: string;
  variant?: 'outline' | 'ghost';
}) {
  const data = recordData(record);
  const label = String(
    title ??
      data.title ??
      data.number ??
      data.invoiceNumber ??
      data.name ??
      'رکورد خرید',
  );
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          size={children ? 'sm' : 'icon'}
          variant={variant}
          className={className}
          aria-label={`${children ? 'جزئیات' : 'مشاهده'} ${label}`}
          title={`مشاهده ${label}`}
        >
          {children ?? <Eye aria-hidden="true" className="size-4" />}
          {!children ? <span className="sr-only">مشاهده</span> : null}
        </Button>
      </DialogTrigger>
      <DialogContent
        dir="rtl"
        className="max-h-[90vh] max-w-4xl overflow-y-auto"
      >
        <DialogTitle className="pe-8">{label}</DialogTitle>
        <DialogDescription>
          جزئیات ذخیره‌شدهٔ این پرونده، اقلام و پیوند اسناد
        </DialogDescription>
        <div className="mt-4">
          <RecordCard record={record} />
        </div>
      </DialogContent>
    </Dialog>
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
