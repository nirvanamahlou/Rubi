'use client';

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  FinanceContractReadV1,
  FinanceJournalReadV1,
  FinanceSourceReferencesV1,
} from '@nora/contracts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { formatSalesMoney } from '@/components/ui/money-input';
import { currencySymbol } from '@/lib/currency-symbol';
import { useFinanceFiscalContext } from '../finance-fiscal-context';
import { apiRequest } from '../api/finance-inbox-api';
import { ContractFinancialSummaryValues } from './contract-financial-summary';

const states: Record<string, string> = {
  MEMORANDUM: 'یادداشت',
  DRAFT: 'پیش‌نویس',
  PENDING_APPROVAL: 'در انتظار تأیید',
  APPROVED: 'تأییدشده',
  POSTED: 'قطعی',
  CANCELLED: 'لغوشده',
  CONFIRMED: 'تأییدشده',
  PENDING_FINANCE: 'در انتظار مالی',
  REJECTED: 'ردشده',
  VOIDED: 'باطل‌شده',
  CASH: 'نقدی',
  CHECK: 'چک',
  TRANSFER: 'انتقال',
  CARD: 'کارت',
};
const money = (value: string, currency: string) => (
  <bdi>
    {formatSalesMoney(value)} {currencySymbol(currency)}
  </bdi>
);
function ReadResult<T>({
  path,
  children,
}: {
  path: string;
  children: (data: T) => ReactNode;
}) {
  const fiscal = useFinanceFiscalContext();
  const query = useQuery({
    queryKey: ['finance-source-read', fiscal?.key, path],
    queryFn: () => apiRequest<T>(path),
    enabled: !fiscal?.loading,
    staleTime: 0,
  });
  if (query.error) return <p role="alert">{query.error.message}</p>;
  if (!query.data || fiscal?.loading)
    return <p role="status">در حال دریافت اطلاعات…</p>;
  return children(query.data);
}
function Facts({ values }: { values: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {values.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="whitespace-pre-wrap break-words">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
function Rows({
  headers,
  rows,
  highlight,
}: {
  headers: string[];
  rows: ReactNode[][];
  highlight?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-start text-sm">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} className="border p-2 text-start">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              aria-current={i === highlight || undefined}
              className={i === highlight ? 'bg-primary/10' : undefined}
              ref={
                i === highlight
                  ? (node) => node?.scrollIntoView?.({ block: 'nearest' })
                  : undefined
              }
            >
              {row.map((cell, j) => (
                <td key={j} className="border p-2 whitespace-pre-wrap">
                  {cell ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Stored contract, without fetching extra customer identity or changing the active year. */
export function FinanceContractReadView({ id }: { id: string }) {
  return (
    <ReadResult<FinanceContractReadV1>
      path={`/finance/source-contracts/${encodeURIComponent(id)}/read`}
    >
      {({ contract: c }) => (
        <article aria-label="متن قرارداد" className="space-y-5">
          <Facts
            values={[
              ['شماره قرارداد', <bdi key="number">{c.contractNumber}</bdi>],
              ['نسخه قرارداد', String(c.version)],
              ['طرف قرارداد', c.customerNameSnapshot],
              ['وضعیت', states[c.status] ?? c.status],
              ['مبدأ', c.originName],
              ['مقصد', c.destinationName],
              ['تاریخ رفت', c.departureDate],
              ['تاریخ برگشت', c.returnNotBefore],
              ['نام خریدار', c.buyerContact?.name],
              ['تلفن خریدار', c.buyerContact?.phone],
              ['تلفن ثابت', c.buyerContact?.landline],
              ['نشانی', c.buyerContact?.address],
              ['کد پستی', c.buyerContact?.postalCode],
            ]}
          />
          <section className="space-y-2">
            <h3 className="font-bold">مسافران قرارداد</h3>
            <Rows
              headers={['نام', 'تاریخ تولد', 'گروه سنی', 'قیمت توافقی']}
              rows={c.passengersDetail.map((p) => [
                p.displayNameSnapshot,
                p.birthDate,
                p.ageCategory,
                p.agreedPrices?.map((price) => (
                  <div key={price.currencyCode}>
                    {money(price.amount, price.currencyCode)}
                  </div>
                )),
              ])}
            />
          </section>
          <section className="space-y-2">
            <h3 className="font-bold">خدمات قرارداد</h3>
            <Rows
              headers={['عنوان', 'وضعیت']}
              rows={c.servicesDetail.map((s) => [
                s.titleSnapshot,
                states[s.status ?? ''] ?? s.status,
              ])}
            />
          </section>
          {c.ticketSelections.length > 0 && (
            <section className="space-y-2">
              <h3 className="font-bold">بلیت‌های قرارداد</h3>
              <Rows
                headers={[
                  'شماره سرویس',
                  'شرکت حمل‌ونقل',
                  'تاریخ حرکت',
                  'تاریخ ورود',
                  'کلاس',
                  'قیمت',
                ]}
                rows={c.ticketSelections.map((t) => [
                  t.serviceNumberSnapshot,
                  t.carrierNameSnapshot,
                  t.departureAt,
                  t.arrivalAt,
                  t.cabinClassCode,
                  t.quotedPrice &&
                    money(t.quotedPrice.amount, t.quotedPrice.currencyCode),
                ])}
              />
            </section>
          )}
          {c.hotelSelection && (
            <section className="space-y-2">
              <h3 className="font-bold">اقامت قرارداد</h3>
              <Rows
                headers={['هتل', 'تاریخ ورود', 'تاریخ خروج', 'تعداد اتاق']}
                rows={[
                  c.hotelSelection,
                  ...(c.hotelSelection.additionalStays ?? []),
                ].map((h) => [
                  h.hotelNameSnapshot,
                  h.checkInDate,
                  h.checkOutDate,
                  h.rooms?.length ??
                    ('roomCount' in h && typeof h.roomCount === 'number'
                      ? h.roomCount
                      : '—'),
                ])}
              />
            </section>
          )}
          <section className="space-y-2">
            <h3 className="font-bold">اجزای قیمت قرارداد</h3>
            <Rows
              headers={['عنوان', 'مبلغ']}
              rows={c.priceComponents.map((p) => [
                p.title,
                money(p.amount, p.currencyCode),
              ])}
            />
          </section>
          <ContractFinancialSummaryValues balances={[...c.balances]} />
          {c.paymentTerms && (
            <section className="space-y-2">
              <h3 className="font-bold">شرایط پرداخت قرارداد</h3>
              <p>{states[c.paymentTerms.mode] ?? c.paymentTerms.mode}</p>
              <Rows
                headers={['ارز', 'پیش‌پرداخت', 'تعداد ماه', 'اولین سررسید']}
                rows={c.paymentTerms.plans.map((p) => [
                  currencySymbol(p.currencyCode),
                  money(p.downPayment, p.currencyCode),
                  p.months,
                  p.firstDueDate,
                ])}
              />
            </section>
          )}
          <section className="space-y-2">
            <h3 className="font-bold">دریافت‌های قرارداد</h3>
            <Rows
              headers={[
                'مبلغ',
                'سررسید',
                'روش',
                'شماره پیگیری',
                'وضعیت',
                'توضیحات',
              ]}
              rows={c.payments.map((p) => [
                money(p.amount, p.currencyCode),
                p.dueAt,
                states[p.method] ?? p.method,
                p.paymentReference,
                states[p.status] ?? p.status,
                p.description,
              ])}
            />
          </section>
          {c.pricingNotes && (
            <Facts values={[['یادداشت قیمت‌گذاری', c.pricingNotes]]} />
          )}
        </article>
      )}
    </ReadResult>
  );
}

export function FinanceJournalReadView({
  bookId,
  id,
  focusPosition,
  periodId,
}: {
  bookId: string;
  id: string;
  focusPosition?: number;
  periodId?: string;
}) {
  return (
    <ReadResult<FinanceJournalReadV1>
      path={`/finance/accounting/books/${encodeURIComponent(bookId)}/journals/${encodeURIComponent(id)}/read${periodId ? `?${new URLSearchParams({ periodId })}` : ''}`}
    >
      {(j) => (
        <article aria-label="متن سند حسابداری" className="space-y-4">
          <Facts
            values={[
              [
                'شماره سند',
                j.number === null
                  ? 'شماره قطعی تخصیص نیافته'
                  : String(j.number),
              ],
              ['دفتر کل', j.bookTitle],
              ['شماره فرعی', j.auxiliaryNumber],
              ['سال مالی', j.periodTitle],
              ['تاریخ سند', j.documentDate],
              ['وضعیت', states[j.status] ?? j.status],
              ['مرجع ثبت‌شده', j.reference],
              ['شرح سند', j.description],
            ]}
          />
          <Rows
            headers={[
              'ردیف',
              'حساب',
              'تفصیلی‌ها',
              'شرح',
              'بدهکار',
              'بستانکار',
              'ارز',
              'مبلغ ارزی',
              'نرخ',
            ]}
            highlight={j.lines.findIndex(
              (line) => line.position === focusPosition,
            )}
            rows={j.lines.map((l) => [
              l.position,
              l.account ? `${l.account.code} — ${l.account.title}` : '—',
              l.details.map((d) => (
                <div key={d.level}>
                  سطح {d.level} · {d.code} — {d.title}
                </div>
              )),
              l.description,
              <bdi key="debit">{formatSalesMoney(l.debit)}</bdi>,
              <bdi key="credit">{formatSalesMoney(l.credit)}</bdi>,
              l.currency ? currencySymbol(l.currency) : '—',
              l.foreignAmount,
              l.rate,
            ])}
          />
          <Facts
            values={[
              ['جمع بدهکار', money(j.debit, j.baseCurrency)],
              ['جمع بستانکار', money(j.credit, j.baseCurrency)],
            ]}
          />
        </article>
      )}
    </ReadResult>
  );
}

export function FinanceSourceReferenceLinks({
  references,
}: {
  references?: FinanceSourceReferencesV1 | undefined;
}) {
  const [target, setTarget] = useState<{
    kind: 'contract' | 'journal';
    id: string;
    bookId?: string;
  } | null>(null);
  if (!references) return null;
  return (
    <div className="relative z-10 flex flex-wrap gap-2">
      {references.contracts.map((c) => (
        <button
          type="button"
          key={c.id}
          aria-label={`مشاهده قرارداد ${c.number}`}
          className="font-semibold text-primary underline"
          onClick={() => setTarget({ kind: 'contract', id: c.id })}
        >
          قرارداد <bdi>{c.number}</bdi>
        </button>
      ))}
      {references.journals.map((j) => (
        <button
          type="button"
          key={j.id}
          aria-label={`مشاهده سند ${j.number === null ? (j.auxiliaryNumber ?? 'بدون شماره قطعی') : j.number}`}
          className="font-semibold text-primary underline"
          onClick={() =>
            setTarget({ kind: 'journal', id: j.id, bookId: j.bookId })
          }
        >
          سند {j.number === null ? 'بدون شماره قطعی' : <bdi>{j.number}</bdi>}
          {j.documentDate ? (
            <small className="ms-1 font-normal">
              <bdi>({j.documentDate})</bdi>
            </small>
          ) : null}
          {j.number === null && j.auxiliaryNumber ? (
            <span>
              {' '}
              · شماره فرعی <bdi>{j.auxiliaryNumber}</bdi>
            </span>
          ) : null}
        </button>
      ))}
      <Dialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
      >
        <DialogContent
          dir="rtl"
          className="max-h-[90dvh] max-w-6xl overflow-y-auto"
        >
          <DialogTitle>
            {target?.kind === 'contract' ? 'مشاهده قرارداد' : 'مشاهده سند'}
          </DialogTitle>
          <DialogDescription>اطلاعات ذخیره‌شدهٔ رکورد مرتبط</DialogDescription>
          {target &&
            (target.kind === 'contract' ? (
              <FinanceContractReadView id={target.id} />
            ) : (
              <FinanceJournalReadView bookId={target.bookId!} id={target.id} />
            ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
