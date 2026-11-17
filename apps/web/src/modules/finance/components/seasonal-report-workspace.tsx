'use client';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  AccountingPeriodV1,
  SeasonalPreview,
  SeasonalRow,
  SeasonalLayout,
} from '@nora/contracts';
import Link from '@/i18n/link';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { accountingApi } from '../api/accounting-api';
import { completionJournalHref } from '../accounting-completion-routes';
import { AccountingDate } from './accounting-date';
import { FinanceContractReadView } from './finance-source-references';

export function SeasonalReportWorkspace({
  bookId,
  period,
  canManage,
  canFinalize,
}: {
  bookId: string;
  period: AccountingPeriodV1;
  canManage: boolean;
  canFinalize: boolean;
}) {
  const [from, setFrom] = useState(period.startDate),
    [to, setTo] = useState(period.endDate);
  const [layout, setLayout] = useState<SeasonalLayout>('CURRENCY_REGION');
  const [savedId, setSavedId] = useState('');
  const [contract, setContract] = useState('');
  const query = { periodId: period.id, from, to, layout };
  const enabled =
    !!from &&
    !!to &&
    from <= to &&
    from >= period.startDate &&
    to <= period.endDate;
  const preview = useQuery({
    queryKey: ['seasonal-preview', bookId, query],
    queryFn: () =>
      accountingApi.analytical<SeasonalPreview>(
        bookId,
        'seasonal-report',
        query,
      ),
    enabled,
  });
  const saved = useQuery({
    queryKey: ['seasonal-snapshot', bookId, period.id, savedId],
    queryFn: () =>
      accountingApi.analytical<{ rows: SeasonalRow[] }>(
        bookId,
        'seasonal-report',
        { ...query, snapshotId: savedId },
      ),
    enabled: !!savedId,
  });
  const action = useMutation({
    mutationFn: ({
      name,
      data,
    }: {
      name: string;
      data: Record<string, unknown>;
    }) =>
      accountingApi.command<{ id?: string }>(bookId, name, {
        key: crypto.randomUUID(),
        payload: { ...query, ...data },
      }),
    onSuccess: async (result, vars) => {
      if (vars.name === 'seasonal-finalize' && result.id) setSavedId(result.id);
      await preview.refetch();
    },
  });
  const rows = savedId ? saved.data?.rows : preview.data?.rows;
  const missing = rows?.filter((row) => row.missing.length) ?? [];
  const regions = (preview.data?.regionOptions ?? []).map((r) => ({
    value: r.id,
    label: r.code + ' — ' + r.title,
  }));
  return (
    <section className="space-y-4 rounded-md border p-4">
      <h2 className="font-bold">گزارش خرید و فروش فصلی</h2>
      <p>
        پیش‌نمایش داخلی قراردادهای فروش و فاکتورهای خرید دارای سند قطعی در دفتر
        و بازه انتخاب‌شده.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          از تاریخ
          <DatePicker
            disabled={action.isPending}
            value={from}
            onChange={(v) => {
              setFrom(v);
              setSavedId('');
              setContract('');
            }}
          />
        </label>
        <label>
          تا تاریخ
          <DatePicker
            disabled={action.isPending}
            value={to}
            onChange={(v) => {
              setTo(v);
              setSavedId('');
              setContract('');
            }}
          />
        </label>
        <label>
          تفکیک گزارش
          <select
            className="w-full rounded border p-1"
            disabled={action.isPending}
            value={layout}
            onChange={(e) => {
              setLayout(e.target.value as SeasonalLayout);
              setSavedId('');
              setContract('');
            }}
          >
            <option value="CURRENCY_REGION">ارز و منطقه</option>
            <option value="CURRENCY">ارز</option>
            <option value="REGION">منطقه جغرافیایی</option>
          </select>
        </label>
      </div>
      {!enabled && <p role="alert">بازه گزارش باید داخل یک دوره مالی باشد.</p>}
      {(preview.isError || saved.isError || action.isError) && (
        <p role="alert">
          {(preview.error ?? saved.error ?? action.error)?.message}
        </p>
      )}
      {enabled && preview.isPending && <p role="status">در حال بارگذاری…</p>}
      {missing.length > 0 && (
        <p role="status">
          تعداد ردیف‌های نیازمند تکمیل نگاشت: {missing.length} ·{' '}
          <Link
            href={`/finance/accounting/tax-accounting/vat/quarterly-mappings?bookId=${bookId}`}
          >
            نگاشت اطلاعات فصلی
          </Link>
        </p>
      )}
      {savedId && (
        <div className="flex gap-3">
          <b>نسخه نهایی داخلی</b>
          <button onClick={() => setSavedId('')}>بازگشت به پیش‌نمایش</button>
        </div>
      )}
      {rows && (
        <div className="overflow-auto">
          <table className="w-full text-start">
            <thead>
              <tr>
                {[
                  'شماره سند',
                  'تاریخ',
                  'نوع',
                  'مرجع',
                  'مبلغ',
                  'ارز',
                  ...(layout !== 'REGION' ? ['معادل رسمی ارز'] : []),
                  ...(layout !== 'CURRENCY'
                    ? ['منطقه جغرافیایی', 'معادل رسمی منطقه']
                    : []),
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-t" key={row.journalId}>
                  <td>
                    <Link href={completionJournalHref(bookId, row.journalId)}>
                      {row.number ?? 'مشاهده سند'}
                    </Link>
                  </td>
                  <td>
                    <AccountingDate value={row.date} />
                  </td>
                  <td>{row.contractId ? 'فروش' : 'خرید'}</td>
                  <td>
                    {row.contractId ? (
                      <button
                        className="underline"
                        onClick={() => setContract(row.contractId!)}
                      >
                        {row.reference ?? 'مشاهده قرارداد'}
                      </button>
                    ) : (
                      (row.reference ?? '—')
                    )}
                  </td>
                  <td>
                    <bdi>{row.amount}</bdi>
                  </td>
                  <td>{row.currency}</td>
                  {layout !== 'REGION' && (
                    <td>
                      <Official value={row.currencyTarget} />
                    </td>
                  )}
                  {layout !== 'CURRENCY' && (
                    <>
                      <td>
                        {savedId || !canManage ? (
                          (row.region ?? 'تعیین نشده')
                        ) : (
                          <SearchCombobox
                            label="منطقه معامله"
                            value={row.regionId ?? ''}
                            placeholder="تعیین نشده"
                            options={[
                              { value: '', label: 'تعیین نشده' },
                              ...regions,
                            ]}
                            disabled={action.isPending}
                            onValueChange={(id) =>
                              action.mutate({
                                name: 'seasonal-region',
                                data: {
                                  journalId: row.journalId,
                                  previousRegionId: row.regionId,
                                  regionId: id || null,
                                },
                              })
                            }
                          />
                        )}
                      </td>
                      <td>
                        <Official value={row.regionTarget} />
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p>برای این بازه ردیفی وجود ندارد.</p>}
        </div>
      )}
      {contract && (
        <section className="rounded border p-3">
          <button onClick={() => setContract('')}>بستن قرارداد</button>
          <FinanceContractReadView id={contract} />
        </section>
      )}
      {canFinalize && !savedId && (
        <button
          className="rounded border px-3 py-1 disabled:opacity-50"
          disabled={
            !enabled ||
            !rows?.length ||
            !!missing.length ||
            action.isPending ||
            preview.isFetching
          }
          onClick={() =>
            action.mutate({
              name: 'seasonal-finalize',
              data: { digest: preview.data?.digest },
            })
          }
        >
          نهایی‌کردن نسخه داخلی گزارش
        </button>
      )}
      {!!preview.data?.history.length && (
        <div className="space-x-2">
          <b>نسخه‌های نهایی این بازه</b>
          {preview.data.history.map((h) => (
            <button
              key={h.id}
              className="rounded border px-2"
              onClick={() => {
                setSavedId(h.id);
                setContract('');
              }}
            >
              <time dateTime={h.approvedAt}>
                {new Date(h.approvedAt).toLocaleString('fa-IR')}
              </time>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
function Official({ value }: { value: SeasonalRow['currencyTarget'] }) {
  return value ? (
    <span title={value.version}>
      <bdi>{value.code}</bdi> — {value.title}
    </span>
  ) : (
    <>تعیین نشده</>
  );
}
