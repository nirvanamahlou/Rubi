'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { DatePicker } from '@/components/ui/date-picker';
import { accountingApi } from '../api/accounting-api';
import { useFinanceFiscalContext } from '../finance-fiscal-context';
import { AccountingButton as Button } from './accounting-operations';
import { parseBankCsv } from './bank-statement-csv';
import { FinanceSourceReferenceLinks } from './finance-source-references';
type Summary = {
  id: string;
  from: string;
  to: string;
  currency: string;
  opening: string;
  closing: string;
  closedAt: string | null;
  bank: { title: string };
};
type View = {
  statement: Summary;
  rows: {
    id: string;
    seq: number;
    date: string;
    amount: string;
    reference: string;
    description: string;
    lineId: string | null;
  }[];
  lines: {
    id: string;
    journalId: string;
    number: number;
    date: string;
    reference: string | null;
    description: string;
    amount: string;
  }[];
  difference: string;
  bookOpening: string;
  bookClosing: string;
  complete: boolean;
};
type Run = <T>(
  action: string,
  p: Record<string, unknown>,
  version?: number,
) => Promise<T | undefined>;
const day = (s: string) =>
  new Date(s + 'T12:00:00Z').toLocaleDateString('fa-IR');
export function BankReconciliation({
  snapshot,
  run,
  busy,
}: {
  snapshot: AccountingSnapshotV1;
  run: Run;
  busy: boolean;
}) {
  const fiscal = useFinanceFiscalContext(),
    periodId =
      fiscal?.period?.id ?? snapshot.periods.find((p) => p.isDefault)?.id ?? '',
    bookId = snapshot.book.id;
  const [id, setId] = useState(''),
    [bankId, setBank] = useState(''),
    [accountId, setAccount] = useState(''),
    [detailId, setDetail] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [opening, setOpening] = useState(''),
    [closing, setClosing] = useState(''),
    [csv, setCsv] = useState<ReturnType<typeof parseBankCsv> | null>(null),
    [error, setError] = useState(''),
    [lineId, setLine] = useState(''),
    [rowId, setRow] = useState(''),
    [search, setSearch] = useState('');
  const banks = useQuery({
    queryKey: ['recon-banks', bookId, search],
    queryFn: () =>
      accountingApi.analytical<{ rows: { id: string; title: string }[] }>(
        bookId,
        'treasury-instruments',
        { view: 'banks', search },
      ),
  });
  const list = useQuery({
    enabled: !!periodId,
    queryKey: ['recon-list', bookId, periodId],
    queryFn: () =>
      accountingApi.analytical<{ statements: Summary[] }>(
        bookId,
        'bank-reconciliation',
        { periodId },
      ),
  });
  const detail = useQuery({
    enabled: !!id && !!periodId,
    queryKey: ['recon', bookId, periodId, id],
    queryFn: () =>
      accountingApi.analytical<View>(bookId, 'bank-reconciliation', {
        periodId,
        id,
      }),
  });
  const view = detail.data;
  async function act(action: string, p: Record<string, unknown>) {
    const r = await run<{ id: string }>('bank-statement-' + action, {
      ...p,
      periodId,
    });
    if (r) {
      setId(r.id);
      setRow('');
      setLine('');
      await list.refetch();
      if (id === r.id) await detail.refetch();
    }
  }
  return (
    <section className="space-y-3">
      <h3>مغایرت‌گیری بانک</h3>
      <label>
        صورتحساب{' '}
        <select
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setRow('');
            setLine('');
          }}
        >
          <option value="">صورتحساب جدید</option>
          {list.data?.statements.map((r) => (
            <option key={r.id} value={r.id}>
              {r.bank.title} · {day(r.from)} – {day(r.to)}
            </option>
          ))}
        </select>
      </label>
      {(error || list.error || detail.error || banks.error) && (
        <p role="alert">
          {error ||
            list.error?.message ||
            detail.error?.message ||
            banks.error?.message}
        </p>
      )}
      {!periodId && <p role="status">سال مالی تعریف نشده است.</p>}
      {!id ? (
        <form
          className="grid gap-3 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (csv)
              void act('import', {
                bankId,
                accountId,
                detailId,
                from,
                to,
                opening,
                closing,
                rows: csv,
              });
          }}
        >
          <label>
            جستجوی بانک{' '}
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label>
            حساب بانکی{' '}
            <select
              required
              value={bankId}
              onChange={(e) => setBank(e.target.value)}
            >
              <option value="">انتخاب حساب</option>
              {banks.data?.rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            حساب معین بانک{' '}
            <select
              required
              value={accountId}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option value="">انتخاب حساب</option>
              {snapshot.accounts
                .filter((x) => x.active && x.level === 'SUBSIDIARY')
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.code} · {x.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            تفصیلی سطح چهار{' '}
            <select
              value={detailId}
              onChange={(e) => setDetail(e.target.value)}
            >
              <option value="">بدون تفصیلی</option>
              {snapshot.details
                .filter((x) => x.active)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.code} · {x.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            از تاریخ <DatePicker value={from} onChange={setFrom} required />
          </label>
          <label>
            تا تاریخ <DatePicker value={to} onChange={setTo} required />
          </label>
          <label>
            مانده ابتدای صورتحساب{' '}
            <input
              required
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
            />
          </label>
          <label>
            مانده پایان صورتحساب{' '}
            <input
              required
              value={closing}
              onChange={(e) => setClosing(e.target.value)}
            />
          </label>
          <label>
            فایل صورتحساب بانک (CSV){' '}
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                setCsv(null);
                setError('');
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  if (f.size > 100000) throw new Error('فایل بزرگ است.');
                  setCsv(parseBankCsv(await f.text()));
                } catch (x) {
                  setError((x as Error).message);
                }
              }}
            />
          </label>
          <p className="col-span-full">
            ترتیب ستون‌ها: <bdi>date,credit,debit,reference,description</bdi>؛
            تاریخ میلادی با قالب YYYY-MM-DD، واریز در credit و برداشت در debit.
          </p>
          {csv && (
            <p>
              {csv.length} ردیف برای ورود · {csv[0]?.reference} {csv[0]?.amount}
            </p>
          )}
          <Button type="submit" disabled={busy || !periodId || !csv}>
            ثبت صورتحساب
          </Button>
        </form>
      ) : view ? (
        <>
          <p>
            مانده پایان بانک: {view.statement.closing} · مانده پایان دفتر:{' '}
            {view.bookClosing} · اختلاف: {view.difference}{' '}
            {view.statement.currency}
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            <fieldset>
              <legend>گردش صورتحساب بانک</legend>
              {view.rows.map((r) => (
                <label className="block border-b p-1" key={r.id}>
                  <input
                    type="radio"
                    name="bank-row"
                    checked={rowId === r.id}
                    onChange={() => {
                      setRow(r.id);
                      setLine(r.lineId ?? '');
                    }}
                  />{' '}
                  {day(r.date)} · {r.amount} · {r.reference} · {r.description}{' '}
                  {r.lineId ? '✓' : ''}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>گردش قطعی دفتر</legend>
              {view.lines.map((r) => (
                <div key={r.id}>
                  <label>
                    <input
                      type="radio"
                      name="ledger-line"
                      checked={r.id === lineId}
                      onChange={() => setLine(r.id)}
                    />{' '}
                    {day(r.date)} · {r.amount} · {r.reference} · {r.description}
                  </label>
                  <FinanceSourceReferenceLinks
                    references={{
                      contracts: [],
                      journals: [
                        {
                          id: r.journalId,
                          bookId,
                          number: r.number,
                          documentDate: r.date,
                          status: 'POSTED',
                          periodId,
                        },
                      ],
                    }}
                  />
                </div>
              ))}
            </fieldset>
          </div>
          {view.statement.closedAt ? (
            view.complete ? (
              <p>صورتحساب نهایی شده است.</p>
            ) : (
              <p role="alert">
                پس از نهایی‌شدن صورتحساب، گردش دفتر تغییر کرده است. ردیف‌های
                تطبیق‌نشده و اختلاف مانده را بررسی کنید.
              </p>
            )
          ) : (
            <div className="flex gap-2">
              <Button
                disabled={busy || !rowId || !lineId}
                onClick={() => void act('match', { id, rowId, lineId })}
              >
                تطبیق دو ردیف
              </Button>
              <Button
                disabled={
                  busy || !view.rows.find((x) => x.id === rowId)?.lineId
                }
                onClick={() => void act('unmatch', { id, rowId })}
              >
                لغو تطبیق
              </Button>
              <Button
                disabled={busy || !view.complete}
                onClick={() => void act('finalize', { id })}
              >
                نهایی‌کردن مغایرت‌گیری
              </Button>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
