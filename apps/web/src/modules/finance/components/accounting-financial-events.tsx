'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AccountingSnapshotV1, AccountingCommandV1 } from '@nora/contracts';
import { SearchCombobox } from '@/components/ui/search-combobox';
import Link from '@/i18n/link';
import { AccountingButton as Button } from './accounting-operations';
import { apiRequest } from '../api/finance-inbox-api';

type Event = {
  id: string; kind: string; source: string; requestId: string; reference: string | null;
  amount: string; currency: string; occurredAt: string; lastError: string | null;
  journal: { id: string; bookId: string; status: string } | null;
};
const labels: Record<string, string> = {
  CUSTOMER_RECEIPT: 'دریافت قرارداد', SUPPLIER_PAYMENT: 'پرداخت فاکتور خرید',
  TICKET_PAYMENT: 'پرداخت خرید بلیت', RESERVATION_PAYMENT: 'پرداخت رزرواسیون',
  PAYROLL_PAYMENT: 'پرداخت حقوق', REFUND_PAYMENT: 'استرداد وجه',
  COMMISSION_PAYMENT: 'پرداخت کارمزد', CHECK_PAYMENT: 'پرداخت چک', ADJUSTMENT_PAYMENT: 'پرداخت اصلاحی',
};
export function AccountingFinancialEvents({ book, run, busy }: {
  book: AccountingSnapshotV1; busy: boolean;
  run: <T = unknown>(action: string, payload: AccountingCommandV1['payload'], version?: number) => Promise<T | undefined>;
}) {
  const [selected, setSelected] = useState<Event | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const query = useQuery({
    queryKey: ['accounting', 'financial-events', book.book.id],
    queryFn: () => apiRequest<{ items: Event[] }>(`/finance/accounting/books/${book.book.id}/financial-events`),
    refetchInterval: 30_000,
  });
  const options = (rows: { id: string; title: string; code?: string }[]) => rows.map(r => ({ value: r.id, label: `${r.code ?? ''} ${r.title}` }));
  const submit = async (rule: boolean) => {
    if (!selected) return;
    const result = await run(rule ? 'financial-rule-save' : 'financial-event-journal', { eventId: selected.id, ...mapping });
    if (result) {
      setNotice(rule ? 'قاعده برای رویدادهای جدید همین طرف حساب، ارز و حساب پرداخت ذخیره شد. برای این رویداد، ایجاد پیش‌نویس را بزنید.' : 'پیش‌نویس ایجاد شد؛ تأیید و ثبت نهایی از فهرست اسناد انجام می‌شود.');
      if (!rule) setSelected(null);
      await query.refetch();
    }
  };
  return <section className="space-y-4 rounded-xl border p-4" aria-label="رویدادهای مالی و ثبت حسابداری">
    <div className="flex items-center justify-between gap-3"><h3 className="font-bold">رویدادهای مالی و ثبت حسابداری</h3><Button variant="outline" onClick={() => void query.refetch()}>به‌روزرسانی رویدادها</Button></div>
    <p className="text-sm text-muted-foreground">دریافت‌ها و پرداخت‌های تأییدشده، از زمان فعال‌سازی این قابلیت. صدور خودکار فقط پیش‌نویس می‌سازد؛ تأیید سند با حسابدار است.</p>
    {notice && <p role="status">{notice}</p>}
    {query.error && <p role="alert" className="text-destructive">{query.error.message}</p>}
    {query.isPending ? <p role="status">در حال بارگذاری…</p> : !query.data?.items.length ? <p>رویداد مالی جدیدی ثبت نشده است.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['عملیات', 'تاریخ', 'مبلغ', 'مرجع', 'وضعیت حسابداری', 'اقدام'].map(x => <th key={x} className="p-2 text-start">{x}</th>)}</tr></thead><tbody>
      {query.data.items.map(event => <tr key={event.id} className="border-t"><td className="p-2">{labels[event.kind] ?? 'پرداخت مالی'}</td><td className="p-2">{new Date(event.occurredAt).toLocaleDateString('fa-IR')}</td><td className="p-2">{event.amount} {event.currency}</td><td className="p-2">{event.reference || event.requestId}</td><td className="p-2">{event.journal ? (event.journal.status === 'POSTED' ? 'ثبت نهایی' : event.journal.status === 'CANCELLED' ? 'سند لغوشده؛ نیازمند بررسی' : 'سند ایجاد شده') : event.lastError || 'در انتظار صدور سند'}</td><td className="p-2">{event.journal ? <Link href={`/finance/accounting/general-ledger/documents/list?bookId=${event.journal.bookId}&journalId=${event.journal.id}`}>مشاهده سند</Link> : <Button permission="finance.journal.create" onClick={() => { setSelected(event); setMapping({}); setNotice(''); }}>تنظیم و ایجاد سند</Button>}</td></tr>)}
    </tbody></table></div>}
    {selected && <form className="space-y-4 rounded-xl bg-muted/30 p-4" onSubmit={e => { e.preventDefault(); void submit(false); }}>
      <h4 className="font-bold">سند {labels[selected.kind] ?? 'پرداخت مالی'} · {selected.amount} {selected.currency}</h4>
      <p className="text-sm">تاریخ سند از تاریخ عملیات و دوره از دورهٔ باز همان تاریخ تعیین می‌شود. دریافت پیش از ارائه خدمت را به حساب پیش‌دریافت تخصیص دهید؛ دریافت وجه به‌تنهایی درآمد نیست.</p>
      <SearchCombobox label="نوع سند رویداد" value={mapping.typeId ?? ''} onValueChange={value => setMapping(m => ({ ...m, typeId: value }))} options={options(book.configurations.filter(c => c.kind === 'voucher-types' && c.active))} />
      <div className="grid gap-4 md:grid-cols-2">{(['debit', 'credit'] as const).map(side => <div className="space-y-3" key={side}>
        <SearchCombobox label={side === 'debit' ? 'حساب بدهکار رویداد' : 'حساب بستانکار رویداد'} value={mapping[`${side}AccountId`] ?? ''} onValueChange={value => setMapping(m => ({ ...m, [`${side}AccountId`]: value }))} options={options(book.accounts.filter(a => a.active && a.level === 'SUBSIDIARY'))} />
        {[4, 5, 6].map(level => <SearchCombobox key={level} label={`تفصیلی ${level} ${side === 'debit' ? 'بدهکار' : 'بستانکار'}`} value={mapping[`${side}Detail${level}Id`] ?? ''} onValueChange={value => setMapping(m => ({ ...m, [`${side}Detail${level}Id`]: value }))} options={options(book.details.filter(d => d.active))} />)}
      </div>)}</div>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy} permission="finance.journal.create">ایجاد پیش‌نویس رویداد</Button><Button type="button" disabled={busy} permission="finance.account.manage" onClick={() => void submit(true)}>ذخیره قاعده برای رویدادهای بعدی</Button><Button type="button" variant="outline" onClick={() => setSelected(null)}>بستن فرم</Button></div>
    </form>}
  </section>;
}
