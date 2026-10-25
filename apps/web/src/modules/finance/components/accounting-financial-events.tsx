'use client';
import { useState } from 'react';
import { AccountingWorkflowsPanel } from './accounting-workflows-panel';
import { ReceiptAllocationPanel } from './receipt-allocation-panel';
import { useQuery } from '@tanstack/react-query';
import type {
  AccountingSnapshotV1,
  AccountingFinancialEventV1,
  AccountingFinancialEventPageV1,
  AccountingCommandV1,
} from '@nora/contracts';
import { accountingFinancialEventLabels as labels } from '@nora/contracts';
import { Input, Textarea } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchCombobox } from '@/components/ui/search-combobox';
import Link from '@/i18n/link';
import { AccountingButton as Button } from './accounting-operations';
import { apiRequest, FinanceInboxApiError } from '../api/finance-inbox-api';

type Event = AccountingFinancialEventV1;
const allocationKind = (kind: string) =>
  kind === 'RECEIPT_ALLOCATION' || kind === 'RECEIPT_ALLOCATION_REVERSAL';

export function AccountingFinancialEvents({
  book,
  run,
  busy,
}: {
  book: AccountingSnapshotV1;
  busy: boolean;
  run: <T = unknown>(
    action: string,
    payload: AccountingCommandV1['payload'],
    version?: number,
  ) => Promise<T | undefined>;
}) {
  const [selected, setSelected] = useState<Event | null>(null);
  const [allocationEventId, setAllocationEventId] = useState<string | null>(
    null,
  );
  const derivedSelected = !!selected && allocationKind(selected.kind);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [cursor, setCursor] = useState('');
  const [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: ['accounting', 'financial-events', book.book.id, cursor, pending],
    queryFn: () =>
      apiRequest<AccountingFinancialEventPageV1>(
        `/finance/accounting/books/${book.book.id}/financial-events?${new URLSearchParams({ ...(cursor ? { before: cursor } : {}), ...(pending ? { pending: 'true' } : {}) })}`,
      ),
    refetchInterval: 30_000,
  });
  const reconciliation = useQuery({
    queryKey: ['accounting', 'financial-events-reconciliation', book.book.id],
    queryFn: () =>
      apiRequest<{
        rows: {
          kind: string;
          currency: string;
          state: string;
          count: number;
          amount: string;
        }[];
      }>(
        `/finance/accounting/books/${book.book.id}/financial-events/reconciliation`,
      ),
    refetchInterval: 30_000,
  });
  const states: Record<string, string> = {
    UNLINKED: 'بدون سند',
    DRAFT: 'پیش‌نویس',
    SUBMITTED: 'در انتظار تأیید',
    PENDING_APPROVAL: 'در انتظار تأیید',
    APPROVED: 'تأییدشده',
    POSTED: 'ثبت نهایی',
    CANCELLED: 'لغوشده',
    REVERSED: 'برگشت‌خورده؛ نیازمند تطبیق',
    OTHER_BOOK: 'ثبت در دفتر دیگر',
  };
  const denied = [query.error, reconciliation.error].some(
    (error) =>
      error instanceof FinanceInboxApiError &&
      [401, 403, 404].includes(error.status),
  );
  if (denied)
    return (
      <section>
        <p role="alert">
          دسترسی به اطلاعات این دفتر در دسترس نیست؛ صفحه را دوباره بارگذاری
          کنید.
        </p>
      </section>
    );
  const options = (rows: { id: string; title: string; code?: string }[]) =>
    rows.map((r) => ({ value: r.id, label: `${r.code ?? ''} ${r.title}` }));
  const submit = async (rule: boolean) => {
    if (!selected) return;
    const result = await run(
      rule ? 'financial-rule-save' : 'financial-event-journal',
      {
        eventId: selected.id,
        ...(derivedSelected
          ? {
              documentDate: mapping.documentDate ?? '',
              periodId: mapping.periodId ?? '',
              latePostingReason: mapping.latePostingReason ?? '',
            }
          : mapping),
        ...(!rule && selected.journal ? { rebuild: true } : {}),
      },
      !rule ? selected.journal?.version : undefined,
    );
    if (result) {
      setNotice(
        rule
          ? 'قاعده برای رویدادهای جدید همین طرف حساب، ارز و حساب پرداخت ذخیره شد. برای این رویداد، ایجاد پیش‌نویس را بزنید.'
          : 'پیش‌نویس ایجاد شد؛ تأیید و ثبت نهایی از فهرست اسناد انجام می‌شود.',
      );
      if (!rule) setSelected(null);
      await query.refetch();
    }
  };
  return (
    <section
      className="space-y-4 rounded-xl border p-4"
      aria-label="رویدادهای مالی و ثبت حسابداری"
    >
      <AccountingWorkflowsPanel
        key={book.book.id}
        book={book}
        run={run}
        busy={busy}
      />
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold">رویدادهای مالی و ثبت حسابداری</h3>
        <Button variant="outline" onClick={() => void query.refetch()}>
          به‌روزرسانی رویدادها
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        دریافت‌ها و پرداخت‌های تأییدشده، از زمان فعال‌سازی این قابلیت. صدور
        خودکار فقط پیش‌نویس می‌سازد؛ تأیید سند با حسابدار است.
      </p>
      {notice && <p role="status">{notice}</p>}
      <details className="rounded-xl border p-3">
        <summary>گزارش تطبیق عملیات و حسابداری به تفکیک ارز</summary>
        {reconciliation.error ? (
          <p role="alert">{reconciliation.error.message}</p>
        ) : reconciliation.isPending ? (
          <p role="status">در حال بارگذاری گزارش…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['عملیات', 'ارز', 'وضعیت', 'تعداد', 'مجموع مبلغ مبدأ'].map(
                    (x) => (
                      <th key={x} className="p-2 text-start">
                        {x}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {reconciliation.data?.rows.map((r) => (
                  <tr key={`${r.kind}:${r.currency}:${r.state}`}>
                    <td className="p-2">{labels[r.kind] ?? 'عملیات مالی'}</td>
                    <td className="p-2">{r.currency}</td>
                    <td className="p-2">
                      {states[r.state] ?? 'در حال رسیدگی'}
                    </td>
                    <td className="p-2">{r.count}</td>
                    <td className="p-2">{r.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          disabled={busy}
          checked={pending}
          onChange={(e) => {
            setPending(e.target.checked);
            setCursor('');
            setSelected(null);
          }}
        />
        فقط رویدادهای بدون سند
      </label>
      {query.error && (
        <p role="alert" className="text-destructive">
          {query.error.message}
        </p>
      )}
      {query.isPending ? (
        <p role="status">در حال بارگذاری…</p>
      ) : !query.data?.items.length ? (
        <p>رویداد مالی جدیدی ثبت نشده است.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {[
                  'عملیات',
                  'تاریخ',
                  'مبلغ',
                  'مرجع',
                  'وضعیت حسابداری',
                  'اقدام',
                ].map((x) => (
                  <th key={x} className="p-2 text-start">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((event) => (
                <tr key={event.id} className="border-t">
                  <td className="p-2">{labels[event.kind] ?? 'پرداخت مالی'}</td>
                  <td className="p-2">
                    {new Date(event.occurredAt).toLocaleDateString('fa-IR', {
                      timeZone: 'Asia/Tehran',
                    })}
                  </td>
                  <td className="p-2">
                    {event.amount} {event.currency}
                  </td>
                  <td className="p-2">{event.reference || event.requestId}</td>
                  <td className="p-2">
                    {event.journal
                      ? event.journal.status === 'POSTED'
                        ? 'ثبت نهایی'
                        : event.journal.status === 'CANCELLED'
                          ? 'سند لغوشده؛ نیازمند بررسی'
                          : 'سند ایجاد شده'
                      : event.lastError || 'در انتظار صدور سند'}
                  </td>
                  <td className="p-2">
                    {event.journal ? (
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/finance/accounting/general-ledger/documents/list?bookId=${event.journal.bookId}&journalId=${event.journal.id}`}
                        >
                          مشاهده سند
                        </Link>
                        {event.journal.status === 'DRAFT' &&
                        event.journal.bookId === book.book.id &&
                        event.journal.version ? (
                          <Button
                            permission="finance.journal.create"
                            disabled={busy}
                            onClick={() => {
                              setSelected(event);
                              setMapping({});
                              setNotice('');
                            }}
                          >
                            اصلاح پیش‌نویس از مبدأ
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <Button
                        permission="finance.journal.create"
                        onClick={() => {
                          setSelected(event);
                          setMapping({});
                          setNotice('');
                        }}
                      >
                        تنظیم و ایجاد سند
                      </Button>
                    )}
                    {event.source === 'SALES' &&
                      (event.kind === 'CUSTOMER_RECEIPT' ||
                        (allocationKind(event.kind) && event.basisEventId)) && (
                        <Button
                          permission="finance.journal.read"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            setAllocationEventId(event.basisEventId ?? event.id)
                          }
                        >
                          تخصیص‌های دریافت
                        </Button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={!cursor}
          onClick={() => {
            setCursor('');
            setSelected(null);
          }}
        >
          ابتدای رویدادها
        </Button>
        <Button
          variant="outline"
          disabled={!query.data?.nextCursor}
          onClick={() => {
            setCursor(query.data?.nextCursor ?? '');
            setSelected(null);
          }}
        >
          رویدادهای بعدی
        </Button>
      </div>
      {book.configurations.some(
        (c) => c.kind === 'financial-event-rules' && c.active,
      ) ? (
        <details className="rounded-xl border p-3">
          <summary>قواعد فعال صدور خودکار پیش‌نویس</summary>
          <ul className="space-y-2">
            {book.configurations
              .filter((c) => c.kind === 'financial-event-rules' && c.active)
              .map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span>{c.title}</span>
                  <Button
                    permission="finance.account.manage"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        'financial-rule-disable',
                        { id: c.id },
                        c.version,
                      )
                    }
                  >
                    غیرفعال‌کردن قاعده
                  </Button>
                </li>
              ))}
          </ul>
        </details>
      ) : null}
      {allocationEventId && (
        <ReceiptAllocationPanel
          key={allocationEventId}
          eventId={allocationEventId}
          onClose={() => setAllocationEventId(null)}
          onChanged={() => {
            void query.refetch();
            void reconciliation.refetch();
          }}
        />
      )}
      {selected && (
        <form
          className="space-y-4 rounded-xl bg-muted/30 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(false);
          }}
        >
          <h4 className="font-bold">
            سند {labels[selected.kind] ?? 'پرداخت مالی'} · {selected.amount}{' '}
            {selected.currency}
          </h4>
          <p className="text-sm">
            تاریخ پیش‌فرض ثبت، تاریخ عملیات و دوره پیش‌فرض، دوره باز همان تاریخ
            است. دریافت پیش از ارائه خدمت را به حساب پیش‌دریافت تخصیص دهید؛
            دریافت وجه به‌تنهایی درآمد نیست.
          </p>
          {!derivedSelected && (
            <SearchCombobox
              label="نوع سند رویداد"
              value={mapping.typeId ?? ''}
              onValueChange={(value) =>
                setMapping((m) => ({ ...m, typeId: value }))
              }
              options={options(
                book.configurations.filter(
                  (c) => c.kind === 'voucher-types' && c.active,
                ),
              )}
            />
          )}
          {derivedSelected && (
            <p>
              حساب، تفصیلی، نوع سند و نرخ حمل‌شده از دریافت اصلی حفظ می‌شوند؛
              مبلغ دفتری این تخصیص {selected.carryingAmount}{' '}
              {selected.carryingCurrency} است.
            </p>
          )}
          <details className="rounded-xl border p-3">
            <summary>ثبت در دوره یا تاریخی متفاوت از عملیات</summary>
            <p className="text-sm">
              زمان اصلی عملیات حفظ می‌شود. تاریخ ثبت باید در دوره باز باشد و
              تغییر آن با علت و تأیید مستقل سند انجام می‌شود.
            </p>
            <DatePicker
              aria-label="تاریخ ثبت حسابداری رویداد"
              value={mapping.documentDate ?? ''}
              onChange={(value) =>
                setMapping((m) => ({ ...m, documentDate: value }))
              }
            />
            <SearchCombobox
              label="دوره ثبت رویداد"
              value={mapping.periodId ?? ''}
              onValueChange={(value) =>
                setMapping((m) => ({ ...m, periodId: value }))
              }
              options={book.periods
                .filter((p) => p.status === 'OPEN')
                .map((p) => ({
                  value: p.id,
                  label: `${p.startDate} — ${p.endDate}`,
                }))}
            />
            <label>
              علت ثبت در تاریخ متفاوت
              <Textarea
                maxLength={500}
                value={mapping.latePostingReason ?? ''}
                onChange={(e) =>
                  setMapping((m) => ({
                    ...m,
                    latePostingReason: e.target.value,
                  }))
                }
              />
            </label>
          </details>
          {!derivedSelected && selected.currency !== book.book.baseCurrency ? (
            <SearchCombobox
              label="نرخ مصوب مبنای رویداد (در صورت چند نرخ)"
              value={mapping.fxSnapshotId ?? ''}
              onValueChange={(value) =>
                setMapping((m) => ({ ...m, fxSnapshotId: value }))
              }
              options={book.fxRates
                .filter(
                  (r) =>
                    r.status === 'APPROVED' &&
                    r.currency === selected.currency &&
                    r.validFrom <= selected.occurredAt &&
                    r.validTo >= selected.occurredAt,
                )
                .map((r) => ({
                  value: r.id,
                  label: `${r.currency} · ${r.rate} · ${r.source}`,
                }))}
            />
          ) : null}
          {!derivedSelected && (
            <>
              <label className="block">
                عنوان قاعده (برای ذخیره خودکار)
                <Input
                  maxLength={160}
                  value={mapping.title ?? ''}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, title: e.target.value }))
                  }
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                {(['debit', 'credit'] as const).map((side) => (
                  <div className="space-y-3" key={side}>
                    <SearchCombobox
                      label={
                        side === 'debit'
                          ? 'حساب بدهکار رویداد'
                          : 'حساب بستانکار رویداد'
                      }
                      value={mapping[`${side}AccountId`] ?? ''}
                      onValueChange={(value) =>
                        setMapping((m) => ({
                          ...m,
                          [`${side}AccountId`]: value,
                        }))
                      }
                      options={options(
                        book.accounts.filter(
                          (a) => a.active && a.level === 'SUBSIDIARY',
                        ),
                      )}
                    />
                    {[4, 5, 6].map((level) => (
                      <SearchCombobox
                        key={level}
                        label={`تفصیلی ${level} ${side === 'debit' ? 'بدهکار' : 'بستانکار'}`}
                        value={mapping[`${side}Detail${level}Id`] ?? ''}
                        onValueChange={(value) =>
                          setMapping((m) => ({
                            ...m,
                            [`${side}Detail${level}Id`]: value,
                          }))
                        }
                        options={options(book.details.filter((d) => d.active))}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={busy}
              permission="finance.journal.create"
            >
              {selected.journal
                ? 'بازسازی پیش‌نویس از مبدأ'
                : 'ایجاد پیش‌نویس رویداد'}
            </Button>
            {!derivedSelected && (
              <Button
                type="button"
                disabled={busy}
                permission="finance.account.manage"
                onClick={() => void submit(true)}
              >
                ذخیره قاعده برای رویدادهای بعدی
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelected(null)}
            >
              بستن فرم
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
