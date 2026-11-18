'use client';
import { accountingDetailLevels } from '@nora/contracts';
import { chartDetailLevelTitles } from '../accounting-chart-form';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import Link from '@/i18n/link';
import { FormField } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { accountingApi } from '../api/accounting-api';
import { completionJournalHref } from '../accounting-completion-routes';
import { AccountingDate } from './accounting-date';
import { AccountingButton as Button } from './accounting-operations';

const axes: readonly (readonly [string, string])[] = [
  ['GROUP', 'گروه حساب'],
  ['GENERAL', 'حساب کل'],
  ['SUBSIDIARY', 'حساب معین'],
  ...accountingDetailLevels.map(
    (level) =>
      [`DETAIL${level}`, `تفصیلی ${chartDetailLevelTitles[level]}`] as const,
  ),
  ['DETAIL', 'حساب تفصیلی (همه سطوح)'],
  ['CURRENCY', 'ارز'],
  ['TRACKING', 'پیگیری'],
];
type Filter = {
  periodId: string;
  from: string;
  to: string;
  minAmount: string;
  maxAmount: string;
  typeId: string;
  traceableOnly: boolean;
  currencyOnly: boolean;
  accountIds: string[];
};
type Result = {
  hasNext: boolean;
  rows: {
    key: string;
    code: string;
    title: string;
    opening: string;
    debit: string;
    credit: string;
    balance: string;
  }[];
  lines: {
    id: string;
    journalId: string;
    number: number;
    date: string;
    description: string;
    debit: string;
    credit: string;
  }[];
};
export function AccountingAccountBrowser({
  book,
}: {
  book: AccountingSnapshotV1;
}) {
  const [form, setForm] = useState<Filter>({
    periodId: book.periods[0]?.id ?? '',
    from: '',
    to: '',
    minAmount: '',
    maxAmount: '',
    typeId: '',
    traceableOnly: false,
    currencyOnly: false,
    accountIds: [],
  });
  const [applied, setApplied] = useState(form);
  const [axis, setAxis] = useState('GROUP'),
    [search, setSearch] = useState(''),
    [term, setTerm] = useState('');
  const [detailType, setDetailType] = useState('');
  const [selected, setSelected] = useState<{
    key: string;
    title: string;
  } | null>(null);
  const [page, setPage] = useState(1),
    [groupPage, setGroupPage] = useState(1);
  const [accountSearch, setAccountSearch] = useState('');
  const change = <K extends keyof Filter>(key: K, value: Filter[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const reset = () => {
    setSelected(null);
    setGroupPage(1);
    setPage(1);
  };
  const params = {
    ...applied,
    accountIds: applied.accountIds.join(','),
    traceableOnly: String(applied.traceableOnly),
    currencyOnly: String(applied.currencyOnly),
    axis,
    detailTypeId: axis.startsWith('DETAIL') ? detailType : '',
    search: term,
    selectedKey: selected?.key ?? '',
    page: String(selected ? page : groupPage),
  };
  const report = useQuery({
    queryKey: ['accounting', 'account-browser', book.book.id, params],
    enabled: !!applied.periodId,
    queryFn: () =>
      accountingApi.analytical<Result>(book.book.id, 'account-browser', params),
    retry: false,
  });
  const accounts = book.accounts.filter((row) =>
    (row.code + ' ' + row.title).includes(accountSearch.trim()),
  );
  return (
    <section className="space-y-4" dir="rtl">
      <h2 className="text-lg font-black">مرور حساب‌ها</h2>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(form);
          setTerm(search.trim());
          reset();
        }}
      >
        <fieldset className="grid gap-3 border p-3 sm:grid-cols-3">
          <legend>فیلتر اسناد</legend>
          <FormField label="دوره مالی">
            <SearchCombobox
              label="دوره مالی"
              value={form.periodId}
              onValueChange={(val) => change('periodId', val)}
              options={book.periods.map((p) => ({
                value: p.id,
                label:
                  book.configurations.find((c) => c.id === p.fiscalYearId)
                    ?.title ?? p.startDate,
              }))}
            />
          </FormField>
          <FormField label="از تاریخ">
            <DatePicker
              aria-label="از تاریخ"
              value={form.from}
              onChange={(val) => change('from', val)}
            />
          </FormField>
          <FormField label="تا تاریخ">
            <DatePicker
              aria-label="تا تاریخ"
              value={form.to}
              onChange={(val) => change('to', val)}
            />
          </FormField>
          <FormField label="حداقل مبلغ سند">
            <input
              value={form.minAmount}
              inputMode="decimal"
              onChange={(e) => change('minAmount', e.target.value)}
            />
          </FormField>
          <FormField label="حداکثر مبلغ سند">
            <input
              value={form.maxAmount}
              inputMode="decimal"
              onChange={(e) => change('maxAmount', e.target.value)}
            />
          </FormField>
          <FormField label="نوع سند">
            <SearchCombobox
              label="نوع سند"
              value={form.typeId}
              onValueChange={(val) => change('typeId', val)}
              options={[
                { value: '', label: 'همه' },
                ...book.configurations
                  .filter((c) => c.kind === 'voucher-types')
                  .map((c) => ({ value: c.id, label: c.title })),
              ]}
            />
          </FormField>
          <label>
            <input
              type="checkbox"
              checked={form.traceableOnly}
              onChange={(e) => change('traceableOnly', e.target.checked)}
            />{' '}
            فقط معین‌های دارای ویژگی پیگیری
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.currencyOnly}
              onChange={(e) => change('currencyOnly', e.target.checked)}
            />{' '}
            فقط مشاهده اسناد ارزی
          </label>
        </fieldset>
        <details className="border p-2">
          <summary>انتخاب حساب‌ها ({form.accountIds.length})</summary>
          <input
            aria-label="جستجوی حساب"
            placeholder="کد یا عنوان حساب"
            value={accountSearch}
            onChange={(e) => setAccountSearch(e.target.value)}
          />
          <div className="grid max-h-48 overflow-auto sm:grid-cols-2">
            {accounts.map((a) => (
              <label key={a.id}>
                <input
                  type="checkbox"
                  checked={form.accountIds.includes(a.id)}
                  onChange={(e) =>
                    change(
                      'accountIds',
                      e.target.checked
                        ? [...form.accountIds, a.id]
                        : form.accountIds.filter((id) => id !== a.id),
                    )
                  }
                />{' '}
                {a.code} ـ {a.title}
              </label>
            ))}
          </div>
        </details>
        <FormField label="جستجوی کد یا عنوان">
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </FormField>
        <Button type="submit" disabled={!form.periodId}>
          اعمال فیلتر
        </Button>
      </form>
      <div
        role="tablist"
        aria-label="سطوح حساب"
        className="flex flex-wrap border-b"
      >
        {axes.map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={axis === value}
            className="px-3 py-2 aria-selected:border-b-2 aria-selected:border-primary"
            onClick={() => {
              setAxis(value);
              reset();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {axis.startsWith('DETAIL') && (
        <FormField label="نوع تفصیلی">
          <SearchCombobox
            label="نوع تفصیلی"
            value={detailType}
            onValueChange={(val) => {
              setDetailType(val);
              reset();
            }}
            options={[
              { value: '', label: 'همه' },
              ...book.configurations
                .filter((c) => c.kind === 'detail-types')
                .map((c) => ({ value: c.id, label: c.title })),
            ]}
          />
        </FormField>
      )}
      {selected && (
        <div className="flex items-center gap-3">
          <strong>{selected.title}</strong>
          <Button onClick={() => setSelected(null)}>بازگشت به فهرست</Button>
        </div>
      )}
      {report.isFetching && <p role="status">در حال دریافت گزارش…</p>}
      {report.error && <p role="alert">{report.error.message}</p>}
      {report.data && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <thead>
                <tr>
                  {(selected
                    ? ['شماره سند', 'تاریخ', 'شرح', 'بدهکار', 'بستانکار']
                    : [
                        'کد',
                        'عنوان',
                        'مانده اول دوره گزارش',
                        'بدهکار',
                        'بستانکار',
                        'مانده پایان',
                        'گردش حساب',
                      ]
                  ).map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected
                  ? report.data.lines.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <Link
                            className="text-primary underline"
                            href={completionJournalHref(
                              book.book.id,
                              l.journalId,
                            )}
                          >
                            {l.number}
                          </Link>
                        </td>
                        <td>
                          <AccountingDate value={l.date} />
                        </td>
                        <td>{l.description}</td>
                        <td>{l.debit}</td>
                        <td>{l.credit}</td>
                      </tr>
                    ))
                  : report.data.rows.map((r) => (
                      <tr key={r.key}>
                        <td>{r.code}</td>
                        <td>{r.title}</td>
                        <td>{r.opening}</td>
                        <td>{r.debit}</td>
                        <td>{r.credit}</td>
                        <td>{r.balance}</td>
                        <td>
                          <Button
                            onClick={() => {
                              setSelected(r);
                              setPage(1);
                            }}
                          >
                            مشاهده گردش
                          </Button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {!(report.data.rows.length + report.data.lines.length) && (
            <p>سطری برای نمایش وجود ندارد.</p>
          )}
          <div className="flex gap-2">
            <Button
              disabled={(selected ? page : groupPage) <= 1}
              onClick={() => (selected ? setPage : setGroupPage)((p) => p - 1)}
            >
              صفحه قبل
            </Button>
            <Button
              disabled={!report.data.hasNext}
              onClick={() => (selected ? setPage : setGroupPage)((p) => p + 1)}
            >
              صفحه بعد
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
