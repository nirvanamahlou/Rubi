'use client';
import { useEffect, useState } from 'react';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { procurementApi } from './api';
import { selectClass } from './draft-form';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { Alert } from '@/components/ui/surfaces';
import { ProcurementSelect } from './procurement-select';
export function procurementOwnerQuery(branchId: string, search = '', page = 1) {
  return queryOptions({
    queryKey: ['procurement', 'owners', branchId, search, page],
    queryFn: () => procurementApi.owners(branchId, search, page),
    enabled: Boolean(branchId),
    retry: false,
  });
}
export function ProcurementOwnerPicker({
  branchId,
  value,
  onChange,
  label = 'مسئول خرید',
  initialOption,
  compact = false,
  showHints = true,
}: {
  branchId: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  initialOption?: { id: string; label: string };
  compact?: boolean;
  showHints?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{
    id: string;
    label: string;
  } | null>(initialOption ?? null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery(procurementOwnerQuery(branchId, debounced, page));
  return (
    <div
      className={
        compact
          ? 'grid min-w-0 items-start gap-4 sm:grid-cols-2'
          : 'min-w-64 space-y-2'
      }
    >
      <FormField
        id="proc-owner-search"
        label={compact ? `جست‌وجوی ${label}` : `جست‌وجوی ${label} واجد دسترسی`}
      >
        <Input
          id="proc-owner-search"
          value={search}
          maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
        />
      </FormField>
      <FormField id="proc-owner" label={label}>
        <ProcurementSelect
          id="proc-owner"
          className={selectClass}
          value={value}
          disabled={!branchId || query.isPending || query.isError}
          onChange={(event) => {
            const row = query.data?.items.find(
              (item) => item.id === event.target.value,
            );
            setSelected(row ?? null);
            onChange(event.target.value);
          }}
        >
          <option value="">
            {!branchId
              ? 'ابتدا شعبه را انتخاب کنید'
              : query.isPending
                ? 'در حال دریافت…'
                : 'انتخاب مسئول'}
          </option>
          {selected &&
            !query.data?.items.some((item) => item.id === selected.id) && (
              <option value={selected.id}>{selected.label}</option>
            )}
          {query.data?.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </ProcurementSelect>
      </FormField>
      {query.isError && (
        <div className={compact ? 'sm:col-span-2' : undefined}>
          <Alert
            tone="error"
            title="مسئولان دریافت نشدند"
            description={
              query.error instanceof Error
                ? query.error.message
                : 'دریافت ناموفق بود'
            }
          >
            <Button
              type="button"
              variant="ghost"
              onClick={() => void query.refetch()}
            >
              تلاش دوباره
            </Button>
          </Alert>
        </div>
      )}
      {showHints && !branchId ? (
        <p className="text-xs text-muted-foreground" role="status">
          ابتدا شعبه را انتخاب کنید.
        </p>
      ) : (
        query.data &&
        !query.data.items.length && (
          <p className="text-xs text-muted-foreground">
            مسئول واجد شرایطی در این صفحه پیدا نشد.
          </p>
        )
      )}
      {(page > 1 || query.data?.hasMore) && (
        <div className={`flex gap-2 ${compact ? 'sm:col-span-2' : ''}`}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={query.isFetching || page <= 1}
            onClick={() => setPage(page - 1)}
          >
            قبلی
          </Button>
          <span className="self-center text-xs">
            {page.toLocaleString('fa-IR')}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={query.isFetching || !query.data?.hasMore}
            onClick={() => setPage(page + 1)}
          >
            بعدی
          </Button>
        </div>
      )}
    </div>
  );
}
