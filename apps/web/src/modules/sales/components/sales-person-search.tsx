'use client';
import { useEffect, useRef, useState } from 'react';
import type { CustomerSummary } from '@nora/contracts';
import { salesPeopleApi as customersApi } from '@/modules/customers/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { Alert } from '@/components/ui/surfaces';

export function salesPersonSearchQuery(
  search: string,
  purpose: 'customer' | 'passenger',
  page = 1,
) {
  return {
    search: search.trim(),
    kind: 'person' as const,
    status: 'active' as const,
    role: purpose,
    branchId: 'all',
    createdFrom: null,
    createdTo: null,
    updatedFrom: null,
    updatedTo: null,
    sortBy: 'displayName' as const,
    sortDirection: 'asc' as const,
    page,
    pageSize: 10,
  };
}

export function SalesPersonSearch({
  purpose,
  selectedIds,
  onSelect,
  onCancel,
  query,
}: {
  purpose: 'customer' | 'passenger';
  query?: string;
  selectedIds: readonly string[];
  onSelect: (person: CustomerSummary) => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [items, setItems] = useState<readonly CustomerSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const lookup = async (nextPage: number, query: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setItems([]);
    try {
      const result = await customersApi.list(
        salesPersonSearchQuery(query, purpose, nextPage),
      );
      setItems(result.data);
      setTotal(result.meta.total);
      setPage(nextPage);
      setSubmitted(query);
      setSearched(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'جست‌وجو انجام نشد.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    if (query === undefined) return;
    let active = true;
    const timer = setTimeout(() => {
      setItems([]);
      setError('');
      setSearched(false);
      if (!query.trim()) {
        setBusy(false);
        setSubmitted(query);
        return;
      }
      setBusy(true);
      void customersApi
        .list(salesPersonSearchQuery(query, purpose))
        .then((result) => {
          if (!active) return;
          setItems(result.data);
          setTotal(result.meta.total);
          setPage(1);
          setSubmitted(query);
          setSearched(true);
        })
        .catch((reason) => {
          if (active) {
            setSubmitted(query);
            setError(
              reason instanceof Error ? reason.message : 'جست‌وجو انجام نشد.',
            );
          }
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, purpose]);
  return (
    <section
      className="grid gap-3 rounded-xl border border-border bg-muted/20 p-3"
      aria-label={purpose === 'customer' ? 'جست‌وجوی مشتری' : 'جست‌وجوی مسافر'}
    >
      <div className="flex flex-wrap gap-2">
        {query === undefined ? (
          <Input
            className="min-w-40 flex-1"
            aria-label="نام، کد ملی یا شماره تماس"
            placeholder="نام، کد ملی یا شماره تماس"
            value={search}
            disabled={busy}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void lookup(1, search);
              }
            }}
          />
        ) : null}
        {query === undefined ? (
          <Button
            type="button"
            loading={busy}
            onClick={() => void lookup(1, query ?? search)}
          >
            جست‌وجو
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onCancel}>
          بستن
        </Button>
      </div>
      {error ? (
        <Alert tone="error" title="جست‌وجو ناموفق بود" description={error} />
      ) : null}
      {!busy && searched && !error && !items.length ? (
        <p role="status" className="text-sm text-muted-foreground">
          موردی پیدا نشد؛ می‌توانید فرد جدید ثبت کنید.
        </p>
      ) : null}
      <div className="max-h-72 overflow-y-auto divide-y divide-border">
        {(query !== undefined && query !== submitted ? [] : items).map(
          (person) => (
            <div
              key={person.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="font-bold break-words">{person.displayName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  کد ملی: <bdi>{person.maskedNationalId ?? 'ثبت نشده'}</bdi> ·
                  تماس: <bdi>{person.maskedPrimaryContact ?? 'ثبت نشده'}</bdi>
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={busy || selectedIds.includes(person.id)}
                onClick={() => onSelect(person)}
              >
                {selectedIds.includes(person.id)
                  ? 'انتخاب‌شده'
                  : purpose === 'customer'
                    ? 'انتخاب مشتری'
                    : 'افزودن مسافر'}
              </Button>
            </div>
          ),
        )}
      </div>
      {query === undefined && searched && !error && total > 10 ? (
        <div className="flex items-center justify-between text-xs">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || page === 1}
            onClick={() => void lookup(page - 1, submitted)}
          >
            قبلی
          </Button>
          <span>
            صفحه {page} از {Math.ceil(total / 10)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || page * 10 >= total}
            onClick={() => void lookup(page + 1, submitted)}
          >
            بعدی
          </Button>
        </div>
      ) : null}
    </section>
  );
}
