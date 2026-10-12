'use client';
import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListTree, Coins, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AccountingLineV1, AccountingSnapshotV1 } from '@nora/contracts';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { DocumentIconAction } from './accounting-document-filter';
import { accountingApi } from '../api/accounting-api';

type Figures = {
  page?: number;
  pageSize?: number;
  total?: number;
  totals?: { debit: string; credit: string; balance: string };
  rows: {
    id?: string;
    reference?: string | null;
    number?: number | null;
    documentDate?: string;
    description?: string;
    periodId?: string;
    currency?: string;
    debit: string;
    credit: string;
    balance: string;
  }[];
};
export function AccountingJournalFigures({
  book,
  row,
  periodId,
}: {
  book: AccountingSnapshotV1;
  row: AccountingLineV1 | undefined;
  periodId: string | undefined;
}) {
  const [kind, setKind] = useState<
    'document-turnover' | 'document-fx-balance' | null
  >(null);
  const [chooseLevel, setChooseLevel] = useState(false);
  const [level, setLevel] = useState(3);
  const [page, setPage] = useState(1);
  const account = book.accounts.find(
    (account) => account.id === row?.accountId,
  );
  const query = useQuery({
    queryKey: [
      'accounting',
      'document-figures',
      book.book.id,
      kind,
      row?.accountId,
      row?.detail4Id,
      row?.detail5Id,
      row?.detail6Id,
      periodId,
      level,
      page,
    ],
    enabled:
      !!kind && !!account && (kind !== 'document-turnover' || !!periodId),
    queryFn: () =>
      accountingApi.analytical<Figures>(book.book.id, kind!, {
        accountId: account!.id,
        level: String(level),
        page: String(page),
        ...(periodId ? { periodId } : {}),
        ...Object.fromEntries(
          [4, 5, 6]
            .filter((n) => n <= level)
            .map((n) => [
              `detail${n}Id`,
              String(row?.[`detail${n}Id` as 'detail4Id'] ?? ''),
            ]),
        ),
      }),
  });
  const periodTitle = (id: string | undefined) => {
    const period = book.periods.find((period) => period.id === id);
    return (
      book.configurations.find((config) => config.id === period?.fiscalYearId)
        ?.title ??
      period?.startDate ??
      ''
    );
  };
  const open = (next: NonNullable<typeof kind>, selectedLevel: number) => {
    setLevel(selectedLevel);
    setPage(1);
    setChooseLevel(false);
    setKind(next);
  };
  return (
    <>
      <div className="relative">
        <DocumentIconAction
          label="گردش"
          shortcut="Alt+T"
          disabled={!account || !periodId}
          onClick={() => setChooseLevel((value) => !value)}
        >
          <ListTree className="size-4" />
        </DocumentIconAction>
        {chooseLevel ? (
          <div
            role="menu"
            aria-label="سطح گردش حساب"
            className="absolute bottom-full z-30 mb-1 min-w-32 rounded border bg-surface p-1 shadow-lg"
          >
            {[3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                role="menuitem"
                disabled={
                  n > 3 &&
                  [4, 5, 6].some(
                    (d) => d <= n && !row?.[`detail${d}Id` as 'detail4Id'],
                  )
                }
                className="block w-full rounded px-3 py-2 text-right text-sm hover:bg-muted disabled:opacity-40"
                onClick={() => open('document-turnover', n)}
              >
                {n === 3 ? 'معین' : `سطح ${n}`}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <DocumentIconAction
        label="تراز ارزی"
        shortcut="Ctrl+Shift+Q"
        disabled={!account || account.attributes.multiCurrency !== true}
        onClick={() =>
          open(
            'document-fx-balance',
            [4, 5, 6].reduce(
              (current, n) =>
                current === n - 1 && row?.[`detail${n}Id` as 'detail4Id']
                  ? n
                  : current,
              3,
            ),
          )
        }
      >
        <Coins className="size-4" />
      </DocumentIconAction>
      <Dialog
        open={!!kind}
        onOpenChange={(value) => {
          if (!value) setKind(null);
        }}
      >
        <DialogContent
          className="max-h-[85vh] max-w-6xl overflow-auto"
          data-document-shortcut-scope
        >
          <DialogTitle>
            {kind === 'document-turnover' ? 'گردش حساب' : 'تراز ارزی'}
          </DialogTitle>
          {query.error ? (
            <p role="alert" className="text-destructive">
              {query.error.message}
            </p>
          ) : null}
          <div
            aria-busy={query.isFetching}
            className="overflow-auto rounded border"
          >
            <table className="w-full min-w-[40rem] text-xs">
              <thead className="bg-muted/40">
                <tr>
                  {(kind === 'document-turnover'
                    ? [
                        'شماره عطف',
                        'شماره سند',
                        'تاریخ سند',
                        'شرح',
                        'بدهکار',
                        'بستانکار',
                        'مانده',
                      ]
                    : ['ارز', 'بدهکار', 'بستانکار', 'مانده']
                  ).map((label) => (
                    <th key={label} className="border p-2 text-right">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data?.rows.map((item, index) => (
                  <Fragment
                    key={item.id ?? `${item.periodId}:${item.currency}`}
                  >
                    {kind === 'document-fx-balance' &&
                    (index === 0 ||
                      query.data?.rows[index - 1]?.periodId !==
                        item.periodId) ? (
                      <tr
                        key={`period:${item.periodId}`}
                        className="bg-muted/20"
                      >
                        <td colSpan={4} className="border p-2">
                          دوره مالی: {periodTitle(item.periodId)}
                        </td>
                      </tr>
                    ) : null}
                    <tr key={item.id ?? `${item.periodId}:${item.currency}`}>
                      {(kind === 'document-turnover'
                        ? [
                            item.reference ?? '',
                            item.number?.toString() ?? '',
                            item.documentDate ?? '',
                            item.description ?? '',
                            item.debit,
                            item.credit,
                            item.balance,
                          ]
                        : [
                            item.currency ?? '',
                            item.debit,
                            item.credit,
                            item.balance,
                          ]
                      ).map((value, n) => (
                        <td key={n} className="border p-2">
                          {value}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                ))}
              </tbody>
              {query.data?.totals ? (
                <tfoot>
                  <tr>
                    <td colSpan={4} className="border p-2">
                      مجموع
                    </td>
                    {[
                      query.data.totals.debit,
                      query.data.totals.credit,
                      query.data.totals.balance,
                    ].map((value, n) => (
                      <td key={n} className="border p-2">
                        {value}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              ) : null}
            </table>
            {!query.isFetching && !query.data?.rows.length ? (
              <p className="p-4 text-sm text-muted-foreground">
                سطری برای نمایش وجود ندارد.
              </p>
            ) : null}
          </div>
          {kind === 'document-turnover' ? (
            <div className="flex items-center justify-end gap-2">
              <DocumentIconAction
                label="قبلی"
                shortcut="Alt+Right"
                disabled={query.isFetching || page <= 1}
                onClick={() => setPage((n) => n - 1)}
              >
                <ChevronRight className="size-4" />
              </DocumentIconAction>
              <span className="text-xs">صفحه {page}</span>
              <DocumentIconAction
                label="بعدی"
                shortcut="Alt+Left"
                disabled={
                  query.isFetching || page * 50 >= (query.data?.total ?? 0)
                }
                onClick={() => setPage((n) => n + 1)}
              >
                <ChevronLeft className="size-4" />
              </DocumentIconAction>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
