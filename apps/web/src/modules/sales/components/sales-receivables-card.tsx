'use client';

import { useEffect, useState } from 'react';
import { Filter, RotateCcw, WalletCards } from 'lucide-react';
import type {
  SalesReceivables,
  SalesReceivablesQuery,
  SalesContractListQuery,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Card, Skeleton } from '@/components/ui/surfaces';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { salesApi } from '../api/client';
import { SalesThemedSelect } from './sales-themed-select';

export function SalesReceivablesCard({
  listQuery = {},
  onApply,
  refreshVersion,
  formatAmount,
}: {
  listQuery?: SalesContractListQuery;
  onApply?: (query: SalesContractListQuery) => void;
  refreshVersion: unknown;
  formatAmount: (amount: string, currencyCode: string) => string;
}) {
  const [draft, setDraft] = useState<SalesReceivablesQuery>({
    dateBasis:
      listQuery.travelFrom || listQuery.travelTo ? 'TRAVEL' : 'CONTRACT',
    from: listQuery.createdFrom || listQuery.travelFrom,
    to: listQuery.createdTo || listQuery.travelTo,
    customerType: listQuery.customerType ?? 'ALL',
    originId: listQuery.originId,
    destinationId: listQuery.destinationId,
    agencyCustomerId: listQuery.agencyCustomerId,
    search: listQuery.search,
    settlementStatus: listQuery.settlementStatus,
  });
  const [query, setQuery] = useState(draft);
  const [data, setData] = useState<SalesReceivables['data'] | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      setBusy(true);
      setError('');
      void salesApi
        .receivables(query)
        .then((result) => {
          if (live) setData(result.data);
        })
        .catch((reason: unknown) => {
          if (live) {
            setData(null);
            setError(
              reason instanceof Error
                ? reason.message
                : 'دریافت مانده قابل دریافت ناموفق بود.',
            );
          }
        })
        .finally(() => {
          if (live) setBusy(false);
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      live = false;
    };
  }, [query, refreshVersion]);
  function apply(next: SalesReceivablesQuery) {
    setQuery(next);
    const result: SalesContractListQuery = { page: 1 };
    if (next.search?.trim()) result.search = next.search.trim();
    if (next.settlementStatus) result.settlementStatus = next.settlementStatus;
    if (next.originId) result.originId = next.originId;
    if (next.destinationId) result.destinationId = next.destinationId;
    if (next.customerType) result.customerType = next.customerType;
    if (next.agencyCustomerId) result.agencyCustomerId = next.agencyCustomerId;
    if (next.from)
      result[next.dateBasis === 'TRAVEL' ? 'travelFrom' : 'createdFrom'] =
        next.from;
    if (next.to)
      result[next.dateBasis === 'TRAVEL' ? 'travelTo' : 'createdTo'] = next.to;
    onApply?.(result);
  }
  const invalid = Boolean(draft.from && draft.to && draft.from > draft.to);
  return (
    <Card className="relative overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-br from-primary/10 via-surface to-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-black">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <WalletCards className="size-5" />
          </span>
          <span>قراردادها</span> / <span>مانده قابل دریافت</span>
        </h2>
        {!busy && data ? (
          <span className="rounded-full border border-primary/15 bg-surface px-3 py-1 text-xs text-muted-foreground">
            {data.contractCount.toLocaleString('fa-IR')} قرارداد
          </span>
        ) : null}
      </div>
      <form
        className="mt-4 grid gap-3 rounded-2xl border border-border/70 bg-surface/80 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid) apply({ ...draft });
        }}
      >
        <FormField label="جست‌وجوی قرارداد">
          <input
            aria-label="جست‌وجوی قرارداد"
            placeholder="شماره قرارداد، نام مشتری، نوتیس یا شماره پیگیری پرداخت…"
            maxLength={160}
            value={draft.search ?? ''}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
            className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
          />
        </FormField>
        <FormField label="وضعیت تسویه">
          <SalesThemedSelect
            label="وضعیت تسویه"
            value={draft.settlementStatus ?? ''}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                settlementStatus: value
                  ? (value as SalesReceivablesQuery['settlementStatus'])
                  : undefined,
              }))
            }
            options={[
              { value: '', label: 'همه وضعیت‌های تسویه' },
              { value: 'UNPAID', label: 'تسویه نشده' },
              { value: 'PARTIALLY_SETTLED', label: 'تسویه ناقص' },
              { value: 'SETTLED', label: 'تسویه شده' },
              { value: 'OVERPAID', label: 'بستانکار' },
            ]}
          />
        </FormField>
        <FormField label="مبنای تاریخ">
          <SalesThemedSelect
            label="مبنای تاریخ مانده"
            value={draft.dateBasis ?? 'CONTRACT'}
            options={[
              { value: 'CONTRACT', label: 'تاریخ قرارداد' },
              { value: 'TRAVEL', label: 'تاریخ سفر' },
            ]}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                dateBasis: value as SalesReceivablesQuery['dateBasis'],
              }))
            }
          />
        </FormField>
        <FormField label="مسیر">
          <SearchCombobox
            label="مسیر مانده قابل دریافت"
            value={
              draft.originId && draft.destinationId
                ? `${draft.originId}:${draft.destinationId}`
                : ''
            }
            options={[
              { value: '', label: 'همه مسیرها' },
              ...(data?.routes ?? []).map((route) => ({
                value: `${route.originId}:${route.destinationId}`,
                label: route.label,
              })),
            ]}
            onValueChange={(value) => {
              const [originId, destinationId] = value.split(':');
              setDraft((current) => ({
                ...current,
                originId: originId || undefined,
                destinationId: destinationId || undefined,
              }));
            }}
          />
        </FormField>
        <FormField label="از تاریخ">
          <DatePicker
            aria-label="از تاریخ مانده قابل دریافت"
            value={draft.from ?? ''}
            onChange={(from) =>
              setDraft((current) => ({ ...current, from: from || undefined }))
            }
          />
        </FormField>
        <FormField label="تا تاریخ">
          <DatePicker
            aria-label="تا تاریخ مانده قابل دریافت"
            value={draft.to ?? ''}
            onChange={(to) =>
              setDraft((current) => ({ ...current, to: to || undefined }))
            }
          />
        </FormField>
        <FormField label="نوع مشتری">
          <SalesThemedSelect
            label="نوع مشتری مانده"
            value={draft.customerType ?? 'ALL'}
            options={[
              { value: 'ALL', label: 'همه مشتریان' },
              { value: 'AGENCY', label: 'آژانس' },
              { value: 'IN_PERSON', label: 'مسافر حضوری' },
            ]}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                customerType: value as SalesReceivablesQuery['customerType'],
                agencyCustomerId: undefined,
              }))
            }
          />
        </FormField>
        {draft.customerType === 'AGENCY' ? (
          <FormField label="آژانس">
            <SearchCombobox
              label="آژانس مانده قابل دریافت"
              value={draft.agencyCustomerId ?? ''}
              options={[
                { value: '', label: 'همه آژانس‌ها' },
                ...(data?.agencies ?? []).map((agency) => ({
                  value: agency.id,
                  label: agency.name,
                })),
              ]}
              onValueChange={(agencyCustomerId) =>
                setDraft((current) => ({
                  ...current,
                  agencyCustomerId: agencyCustomerId || undefined,
                }))
              }
            />
          </FormField>
        ) : null}
        {invalid ? (
          <p
            role="alert"
            className="text-xs text-red-600 sm:col-span-2 lg:col-span-3 xl:col-span-5"
          >
            تاریخ شروع باید قبل از تاریخ پایان باشد.
          </p>
        ) : null}
        <div className="flex items-center gap-2 border-t border-border/60 pt-3 sm:col-span-2 lg:col-span-3 xl:col-span-5">
          <Button type="submit" size="sm" disabled={invalid || busy}>
            <Filter className="size-4" />
            اعمال فیلتر
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const cleared: SalesReceivablesQuery = {
                dateBasis: 'CONTRACT',
                customerType: 'ALL',
              };
              setDraft(cleared);
              apply(cleared);
            }}
          >
            <RotateCcw className="size-4" />
            پاک‌کردن فیلترها
          </Button>
        </div>
      </form>
      <div className="mt-4" aria-live="polite" aria-busy={busy}>
        {busy ? (
          <Skeleton className="h-16 rounded-xl" />
        ) : error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              {query.dateBasis === 'TRAVEL'
                ? 'بر اساس تاریخ سفر'
                : 'بر اساس تاریخ قرارداد'}
              {query.from || query.to
                ? ` · ${query.from ?? '…'} — ${query.to ?? '…'}`
                : ' · همه تاریخ‌ها'}
            </p>
            <div className="flex flex-wrap gap-2">
              {data?.balances.length ? (
                data.balances.map((balance) => (
                  <span
                    key={balance.currencyCode}
                    className="rounded-xl border border-primary/15 bg-surface px-4 py-3 text-xl font-black tabular-nums shadow-sm"
                  >
                    {formatAmount(balance.amount, balance.currencyCode)}
                  </span>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  مانده‌ای برای این فیلترها ثبت نشده است.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
