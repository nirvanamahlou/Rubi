'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  accountReviewAxes,
  type AccountingSnapshotV1,
  type AccountReviewAxis,
  type AccountReviewLine,
  type AccountReviewResult,
  type AccountReviewRow,
} from '@nora/contracts';
import { Input } from '@/components/ui/form-controls';
import { formatCalendarValue } from '@/components/ui/date-picker.utils';
import { useSystemPreferences } from '@/components/system-preferences-provider';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { accountingApi } from '../api/accounting-api';
import { exportAccountingRows } from '../accounting-view-export';
import {
  addReviewSelection,
  readReviewAxis,
  readReviewFilters,
  readReviewScope,
  reviewLabels,
  reviewStatuses,
  type ReviewScope,
} from '../accounting-review-navigation';
import { AccountingAccountReviewFilters } from './accounting-account-review-filters';
import { AccountingDate } from './accounting-date';
import { AccountingButton as Button } from './accounting-operations';
import { FinanceJournalReadView } from './finance-source-references';

const statusLabel = (value: string) =>
  reviewStatuses[value as keyof typeof reviewStatuses] ?? value;

const amountColumns = [
  ['opening', 'مانده اول دوره گزارش'],
  ['debit', 'گردش بدهکار'],
  ['credit', 'گردش بستانکار'],
  ['balanceDebit', 'مانده بدهکار'],
  ['balanceCredit', 'مانده بستانکار'],
] as const;

const fxColumns = [
  ['foreignOpening', 'مانده ارزی اول دوره'],
  ['foreignDebit', 'گردش ارزی بدهکار'],
  ['foreignCredit', 'گردش ارزی بستانکار'],
  ['foreignBalance', 'مانده ارزی پایان دوره'],
] as const;

const movementColumns: readonly (readonly [keyof AccountReviewLine, string])[] =
  [
    ['number', 'شماره سند'],
    ['position', 'شماره ردیف'],
    ['reference', 'شماره عطف'],
    ['secondaryNumber', 'شماره فرعی'],
    ['date', 'تاریخ'],
    ['status', 'وضعیت سند'],
    ['journalDescription', 'شرح سربرگ'],
    ['description', 'شرح'],
    ['accountCode', 'کد حساب معین'],
    ['accountTitle', 'عنوان معین'],
    ['detail4', 'تفصیلی سطح چهار'],
    ['detail5', 'تفصیلی سطح پنج'],
    ['detail6', 'تفصیلی سطح شش'],
    ['debit', 'بدهکار'],
    ['credit', 'بستانکار'],
    ['runningBalance', 'مانده در خط'],
    ['currency', 'ارز'],
    ['foreignAmount', 'مبلغ ارزی'],
    ['rate', 'نرخ ارز'],
    ['trackingNumber', 'شماره پیگیری'],
    ['trackingDate', 'تاریخ پیگیری'],
  ];

const tableClass = 'w-full whitespace-nowrap text-sm';
const cellClass = 'border-b px-3 py-2 text-start';
const selectClass = 'rounded border bg-background px-2 py-2 text-sm';

export function AccountingAccountBrowser({
  book,
  activePeriodId,
}: {
  book: AccountingSnapshotV1;
  activePeriodId?: string | undefined;
}) {
  const urlParams = useSearchParams();
  const bookmarkedBook = urlParams.get('reviewBook');
  const bookmarkedPeriod = urlParams.get('reviewActivePeriod');
  const belongsToContext =
    (!bookmarkedBook || bookmarkedBook === book.book.id) &&
    (!bookmarkedPeriod || bookmarkedPeriod === activePeriodId);
  const params = belongsToContext ? urlParams : new URLSearchParams();
  const privileges = useAccessPermissions();
  const preferences = useSystemPreferences();
  const canExport = privileges?.includes('finance.export');
  const [rowSelection, setRowSelection] = useState<{
    query: string;
    key: string;
  } | null>(null);
  const [showClassification, setShowClassification] = useState(false);
  const [showRunning, setShowRunning] = useState(true);
  const [byType, setByType] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const scope = readReviewScope(params.get('reviewScope'));
  const axis = readReviewAxis(params.get('reviewAxis')) ?? 'GROUP';
  const periodParam = params.get('reviewPeriod');
  const periodId =
    activePeriodId ??
    book.periods.find((p) => p.id === periodParam)?.id ??
    book.periods.find((p) => p.isDefault)?.id ??
    book.periods[0]?.id ??
    '';
  const groupType = axis === 'DETAIL' ? (params.get('reviewType') ?? '') : '';
  const applied = readReviewFilters(params.get('reviewFilters'));
  const search = params.get('reviewSearch') ?? '';
  const lineSearch = params.get('reviewLineSearch') ?? '';
  const sort = params.get('reviewSort') ?? 'code';
  const proposedPage = Number(params.get('reviewPage') ?? 1);
  const page =
    Number.isSafeInteger(proposedPage) && proposedPage >= 1 ? proposedPage : 1;
  const lines = scope.length > 0 && params.get('reviewView') === 'lines';
  const journalId = lines ? params.get('reviewJournal') : null;
  const position = Number(params.get('reviewPosition') ?? 0);
  const detailTypes = book.configurations.filter(
    (item) => item.kind === 'detail-types',
  );
  const axisLabel =
    detailTypes.find((item) => item.id === groupType)?.title ??
    reviewLabels[axis];
  const showClassColumn =
    showClassification && axis.startsWith('DETAIL') && axis !== 'DETAIL_TYPE';
  const apiFilters = Object.fromEntries(
    Object.entries(applied).filter(([key]) => key !== 'mode'),
  );
  const request = {
    ...apiFilters,
    axis,
    periodId,
    page: String(page),
    groupDetailTypeId: groupType,
    search,
    sort,
    lineSearch: lines ? lineSearch : '',
    scope: JSON.stringify(
      scope.map(({ axis, key, typeId, trackingDate }) => ({
        axis,
        key,
        typeId,
        trackingDate,
      })),
    ),
    view: lines ? 'lines' : 'summary',
  };
  const fingerprint = JSON.stringify(request);
  const query = useQuery({
    queryKey: ['accounting', 'account-browser', book.book.id, request],
    enabled: !!periodId && !journalId,
    queryFn: () =>
      accountingApi.analytical<AccountReviewResult>(
        book.book.id,
        'account-browser',
        request,
      ),
    retry: false,
  });
  const picked =
    rowSelection?.query === fingerprint
      ? query.data?.rows.find((row) => row.key === rowSelection.key)
      : undefined;

  function navigate(values: Record<string, string>) {
    const url = new URL(window.location.href);
    if (!belongsToContext) {
      for (const key of Array.from(url.searchParams.keys()))
        if (key.startsWith('review')) url.searchParams.delete(key);
    }
    url.searchParams.set('reviewBook', book.book.id);
    if (activePeriodId)
      url.searchParams.set('reviewActivePeriod', activePeriodId);
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.pushState(null, '', url);
    setExportError('');
  }

  const currencyNames = new Intl.DisplayNames(
    [preferences.language === 'en' ? 'en' : 'fa'],
    { type: 'currency', fallback: 'code' },
  );
  const rowTitle = (row: AccountReviewRow) =>
    axis === 'CURRENCY' && /^[A-Z]{3}$/.test(row.code)
      ? (currencyNames.of(row.code) ?? row.title)
      : row.title;

  function selection(row: AccountReviewRow): ReviewScope {
    return {
      axis,
      key: axis === 'TRACKING' ? row.code : row.key,
      ...(groupType ? { typeId: groupType } : {}),
      ...(axis === 'TRACKING' ? { trackingDate: row.trackingDate } : {}),
      label: [
        row.code === rowTitle(row) ? '' : row.code,
        rowTitle(row),
        row.trackingDate,
      ]
        .filter(Boolean)
        .join(' ـ '),
    };
  }

  function summary(
    nextAxis: AccountReviewAxis,
    nextScope: ReviewScope[],
    typeId = '',
  ) {
    navigate({
      reviewScope: JSON.stringify(nextScope),
      reviewAxis: nextAxis,
      reviewType: typeId,
      reviewView: '',
      reviewPage: '',
      reviewSearch: '',
      reviewLineSearch: '',
      reviewJournal: '',
      reviewPosition: '',
    });
  }

  function openMovement(row: AccountReviewRow) {
    const next = addReviewSelection(scope, selection(row));
    if (next.length > 10) return;
    navigate({
      reviewScope: JSON.stringify(next),
      reviewView: 'lines',
      reviewSummaryDepth: String(scope.length),
      reviewSummaryPage: String(page),
      reviewPage: '',
      reviewLineSearch: '',
    });
  }

  function openJournal(row: AccountReviewLine) {
    navigate({
      reviewJournal: row.journalId,
      reviewPosition: String(row.position),
    });
  }

  function backToSummary() {
    const depth = Number(params.get('reviewSummaryDepth') ?? 0);
    navigate({
      reviewScope: JSON.stringify(scope.slice(0, depth)),
      reviewPage: params.get('reviewSummaryPage') ?? '',
      reviewView: '',
      reviewJournal: '',
      reviewPosition: '',
      reviewLineSearch: '',
    });
  }

  function breakdown(nextAxis: AccountReviewAxis) {
    if (!picked) return;
    const next = addReviewSelection(scope, selection(picked));
    if (next.length <= 10) summary(nextAxis, next);
  }

  const summaryHeaders = [
    axis === 'TRACKING' ? 'شماره پیگیری' : axis === 'CURRENCY' ? 'ارز' : 'کد',
    axis === 'TRACKING'
      ? 'تاریخ پیگیری'
      : axis === 'CURRENCY'
        ? 'عنوان ارز'
        : 'عنوان',
    ...(showClassColumn ? ['شماره طبقه بندی'] : []),
    ...amountColumns.map(([, label]) => label),
    ...(axis === 'CURRENCY' ? fxColumns.map(([, label]) => label) : []),
  ];
  const visibleMovementColumns = movementColumns.filter(
    ([key]) => showRunning || key !== 'runningBalance',
  );
  function summaryRow(row: AccountReviewRow) {
    return [
      row.code,
      axis === 'TRACKING'
        ? row.trackingDate
          ? formatCalendarValue(
              row.trackingDate,
              preferences.calendar,
              false,
              preferences.language === 'en',
            )
          : '—'
        : rowTitle(row),
      ...(showClassColumn ? [row.classificationNumber ?? ''] : []),
      ...amountColumns.map(([key]) => row[key]),
      ...(axis === 'CURRENCY' ? fxColumns.map(([key]) => row[key] ?? '') : []),
    ];
  }
  function movementCell(row: AccountReviewLine, key: keyof AccountReviewLine) {
    const value = row[key];
    if (key === 'status') return statusLabel(row.status);
    if ((key === 'date' || key === 'trackingDate') && value)
      return formatCalendarValue(
        String(value),
        preferences.calendar,
        false,
        preferences.language === 'en',
      );
    return value === null ? '' : String(value);
  }

  async function download(format: 'xlsx' | 'pdf') {
    if (exporting || !query.data) return;
    setExporting(true);
    setExportError('');
    try {
      const data =
        format === 'xlsx'
          ? await accountingApi.analytical<AccountReviewResult>(
              book.book.id,
              'account-browser',
              { ...request, export: 'true' },
            )
          : query.data;
      const date = (value: string) =>
        formatCalendarValue(
          value,
          preferences.calendar,
          false,
          preferences.language === 'en',
        );
      const rows = lines
        ? data.lines.map((row) =>
            visibleMovementColumns.map(([key]) => movementCell(row, key)),
          )
        : data.rows.map(summaryRow);
      const result = await exportAccountingRows(
        [
          [
            lines ? 'ریز گردش' : 'مرور حساب‌ها',
            book.book.title,
            lines ? '' : axisLabel,
          ],
          [
            'از تاریخ',
            date(data.from),
            'تا تاریخ',
            date(data.to),
            'ارز پایه',
            book.book.baseCurrency,
          ],
          [
            'وضعیت سند',
            applied.statuses.split(',').map(statusLabel).join('، '),
          ],
          ...scope.map((item) => [reviewLabels[item.axis], item.label]),
          lines
            ? visibleMovementColumns.map(([, label]) => label)
            : summaryHeaders,
          ...rows,
        ],
        format,
      );
      window.setTimeout(() => URL.revokeObjectURL(result.url), 10000);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'ساخت خروجی ناموفق بود.',
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <section dir="rtl" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">
          {journalId ? 'مشاهده سند' : lines ? 'ریز گردش' : 'مرور حساب‌ها'}
        </h2>
        <span className="text-sm text-muted-foreground">
          {book.book.title} · {book.book.baseCurrency}
        </span>
      </header>
      {scope.length > 0 && (
        <nav
          aria-label="مسیر گزارش"
          className="flex flex-wrap items-center gap-2"
        >
          <Button type="button" onClick={() => summary('GROUP', [])}>
            همه حساب‌ها
          </Button>
          {scope.map((item, index) => (
            <Button
              type="button"
              key={`${item.axis}:${item.key}:${item.typeId ?? ''}:${item.trackingDate ?? ''}`}
              onClick={() =>
                summary(item.axis, scope.slice(0, index), item.typeId)
              }
            >
              {reviewLabels[item.axis]} · {item.label}
            </Button>
          ))}
        </nav>
      )}
      {journalId ? (
        <>
          <Button
            type="button"
            onClick={() => navigate({ reviewJournal: '', reviewPosition: '' })}
          >
            بازگشت به ریز گردش
          </Button>
          <FinanceJournalReadView
            bookId={book.book.id}
            id={journalId}
            focusPosition={position}
            periodId={periodId}
          />
        </>
      ) : (
        <>
          {!lines && (
            <AccountingAccountReviewFilters
              key={`${periodId}:${params.get('reviewFilters') ?? ''}`}
              book={book}
              periodId={periodId}
              activePeriodId={activePeriodId}
              applied={applied}
              onApply={(filters, id) =>
                navigate({
                  reviewFilters: JSON.stringify(filters),
                  reviewPeriod: id,
                  reviewPage: '',
                })
              }
            />
          )}
          {!lines ? (
            <>
              <div
                role="group"
                aria-label="سطوح حساب"
                className="flex flex-wrap gap-2 border-b pb-3"
              >
                {accountReviewAxes
                  .filter(
                    (value) =>
                      !byType ||
                      !['DETAIL4', 'DETAIL5', 'DETAIL6'].includes(value),
                  )
                  .map((value) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={axis === value && !groupType}
                      className="rounded border px-3 py-2 text-sm aria-pressed:border-primary aria-pressed:bg-primary/10"
                      onClick={() => summary(value, scope)}
                    >
                      {reviewLabels[value]}
                    </button>
                  ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={byType || !!groupType}
                    onChange={(event) => {
                      setByType(event.target.checked);
                      if (!event.target.checked && groupType)
                        summary('DETAIL', scope);
                      if (
                        event.target.checked &&
                        ['DETAIL4', 'DETAIL5', 'DETAIL6'].includes(axis)
                      )
                        summary('DETAIL_TYPE', scope);
                    }}
                  />
                  مرور بر اساس نوع تفصیلی
                </label>
                {(byType || groupType) && (
                  <select
                    className={selectClass}
                    aria-label="مرور بر اساس نوع تفصیلی"
                    value={groupType}
                    onChange={(event) =>
                      summary(
                        event.target.value ? 'DETAIL' : 'DETAIL_TYPE',
                        scope,
                        event.target.value,
                      )
                    }
                  >
                    <option value="">همه نوع‌های تفصیلی</option>
                    {detailTypes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                )}
                {axis.startsWith('DETAIL') && axis !== 'DETAIL_TYPE' && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={showClassification}
                      onChange={(event) =>
                        setShowClassification(event.target.checked)
                      }
                    />
                    نمایش ستون شماره طبقه بندی
                  </label>
                )}
                <form
                  className="flex gap-2"
                  key={search}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const term = String(
                      new FormData(event.currentTarget).get('search') ?? '',
                    ).trim();
                    navigate({ reviewSearch: term, reviewPage: '' });
                  }}
                >
                  <Input
                    name="search"
                    aria-label="جستجوی کد یا عنوان"
                    defaultValue={search}
                    maxLength={160}
                  />
                  <Button type="submit">جستجو</Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={backToSummary}>
                بازگشت به فهرست
              </Button>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showRunning}
                  onChange={(event) => setShowRunning(event.target.checked)}
                />
                نمایش مانده در خط
              </label>
              {query.data?.opening !== null &&
                query.data?.opening !== undefined && (
                  <span>
                    مانده اول دوره گزارش <bdi>{query.data.opening}</bdi>
                  </span>
                )}
              <form
                className="flex gap-2"
                key={lineSearch}
                onSubmit={(event) => {
                  event.preventDefault();
                  const term = String(
                    new FormData(event.currentTarget).get('search') ?? '',
                  ).trim();
                  navigate({ reviewLineSearch: term, reviewPage: '' });
                }}
              >
                <Input
                  name="search"
                  aria-label="جستجوی ریز گردش"
                  defaultValue={lineSearch}
                  maxLength={160}
                />
                <Button type="submit">جستجو</Button>
              </form>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 border-y py-2">
            {!lines && (
              <>
                <Button
                  type="button"
                  disabled={!picked || scope.length >= 10}
                  onClick={() => picked && openMovement(picked)}
                >
                  مشاهده گردش
                </Button>
                <select
                  aria-label="ریزکاوی بر اساس"
                  className={selectClass}
                  disabled={!picked || scope.length >= 10}
                  value=""
                  onChange={(event) => {
                    const target = readReviewAxis(event.target.value);
                    if (target) breakdown(target);
                  }}
                >
                  <option value="">ریزکاوی بر اساس</option>
                  {accountReviewAxes
                    .filter((value) => value !== axis)
                    .map((value) => (
                      <option key={value} value={value}>
                        {reviewLabels[value]}
                      </option>
                    ))}
                </select>
                <Button
                  type="button"
                  disabled={!picked || scope.length >= 10}
                  onClick={() => breakdown('CURRENCY')}
                >
                  اطلاعات ارزی
                </Button>
                {picked && (
                  <span className="text-sm">
                    {picked.code} · {picked.title}
                  </span>
                )}
                <select
                  className={selectClass}
                  aria-label="مرتب‌سازی گزارش"
                  value={sort}
                  onChange={(event) =>
                    navigate({ reviewSort: event.target.value, reviewPage: '' })
                  }
                >
                  <option value="code">کد</option>
                  <option value="title">عنوان</option>
                  <option value="debit">گردش بدهکار</option>
                  <option value="credit">گردش بستانکار</option>
                  <option value="balance">مانده پایان</option>
                </select>
              </>
            )}
            <Button
              type="button"
              disabled={query.isFetching || !periodId}
              onClick={() => void query.refetch()}
            >
              به‌روزرسانی
            </Button>
            {canExport && (
              <>
                <Button
                  type="button"
                  disabled={
                    exporting ||
                    !query.data ||
                    !(query.data.rows.length || query.data.lines.length)
                  }
                  onClick={() => void download('xlsx')}
                >
                  خروجی Excel
                </Button>
                <Button
                  type="button"
                  disabled={
                    exporting ||
                    !query.data ||
                    !(query.data.rows.length || query.data.lines.length)
                  }
                  onClick={() => void download('pdf')}
                >
                  چاپ صفحه
                </Button>
              </>
            )}
          </div>
          {applied.statuses !== 'POSTED' && (
            <p className="text-sm font-medium">
              {applied.statuses.split(',').map(statusLabel).join('، ')}
            </p>
          )}
          {!periodId && <p>دوره مالی گزارش را انتخاب کنید.</p>}
          {exportError && <p role="alert">{exportError}</p>}
          {query.isFetching && <p role="status">در حال دریافت گزارش…</p>}
          {query.error && <p role="alert">{query.error.message}</p>}
          {query.data && (
            <>
              <div className="overflow-x-auto rounded border">
                <table className={tableClass}>
                  <thead className="bg-muted">
                    <tr>
                      {(lines
                        ? visibleMovementColumns.map(([, label]) => label)
                        : [...summaryHeaders, 'عملیات']
                      ).map((label) => (
                        <th key={label} scope="col" className={cellClass}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lines
                      ? query.data.lines.map((row) => (
                          <tr
                            key={row.id}
                            className="even:bg-muted/20 hover:bg-muted/40"
                            onDoubleClick={() => openJournal(row)}
                          >
                            {visibleMovementColumns.map(([key]) => (
                              <td key={key} className={cellClass}>
                                {key === 'number' ? (
                                  <button
                                    type="button"
                                    className="text-primary underline"
                                    onClick={() => openJournal(row)}
                                  >
                                    {row.number ?? 'مشاهده سند'}
                                  </button>
                                ) : key === 'date' || key === 'trackingDate' ? (
                                  row[key] ? (
                                    <AccountingDate value={row[key]} />
                                  ) : (
                                    '—'
                                  )
                                ) : (
                                  movementCell(row, key) || '—'
                                )}
                              </td>
                            ))}
                          </tr>
                        ))
                      : query.data.rows.map((row) => (
                          <tr
                            key={row.key}
                            data-selected={picked?.key === row.key}
                            className="cursor-pointer even:bg-muted/20 hover:bg-muted/40 data-[selected=true]:bg-primary/10"
                            onClick={() =>
                              setRowSelection({
                                query: fingerprint,
                                key: row.key,
                              })
                            }
                            onDoubleClick={() => openMovement(row)}
                          >
                            {summaryRow(row).map((value, index) => (
                              <td className={cellClass} key={index}>
                                {index === 1 ? (
                                  <button
                                    type="button"
                                    className="text-start font-medium hover:underline"
                                    aria-pressed={picked?.key === row.key}
                                    onClick={() =>
                                      setRowSelection({
                                        query: fingerprint,
                                        key: row.key,
                                      })
                                    }
                                  >
                                    {value}
                                  </button>
                                ) : (
                                  <bdi>{value || '—'}</bdi>
                                )}
                              </td>
                            ))}
                            <td className={cellClass}>
                              <Button
                                type="button"
                                disabled={scope.length >= 10}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openMovement(row);
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
              {!(query.data.rows.length || query.data.lines.length) && (
                <p>سطری برای نمایش وجود ندارد.</p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => navigate({ reviewPage: String(page - 1) })}
                >
                  صفحه قبل
                </Button>
                <span>{page}</span>
                <Button
                  type="button"
                  disabled={!query.data.hasNext}
                  onClick={() => navigate({ reviewPage: String(page + 1) })}
                >
                  صفحه بعد
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
