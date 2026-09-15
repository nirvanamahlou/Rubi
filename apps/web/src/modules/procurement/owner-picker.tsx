'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { procurementApi } from './api';
import { selectClass } from './draft-form';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { Alert } from '@/components/ui/surfaces';
export function ProcurementOwnerPicker({
  branchId,
  value,
  onChange,
}: {
  branchId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{
    id: string;
    label: string;
  } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: ['procurement', 'owners', branchId, debounced, page],
    queryFn: () => procurementApi.owners(branchId, debounced, page),
    retry: false,
  });
  return (
    <div className="min-w-64 space-y-2">
      <FormField id="proc-owner-search" label="جست‌وجوی مسئول واجد دسترسی">
        <Input
          id="proc-owner-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </FormField>
      <FormField id="proc-owner" label="مسئول خرید">
        <select
          id="proc-owner"
          className={selectClass}
          value={value}
          disabled={query.isPending || query.isError}
          onChange={(event) => {
            const row = query.data?.items.find(
              (item) => item.id === event.target.value,
            );
            setSelected(row ?? null);
            onChange(event.target.value);
          }}
        >
          <option value="">
            {query.isPending ? 'در حال دریافت…' : 'انتخاب مسئول'}
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
        </select>
      </FormField>
      {query.isError && (
        <Alert
          tone="error"
          title="مسئولان دریافت نشدند"
          description={
            query.error instanceof Error
              ? query.error.message
              : 'دریافت ناموفق بود'
          }
        >
          <Button variant="ghost" onClick={() => void query.refetch()}>
            تلاش دوباره
          </Button>
        </Alert>
      )}
      {query.data && !query.data.items.length && (
        <p className="text-xs text-muted-foreground">
          مسئول واجد شرایطی در این صفحه پیدا نشد.
        </p>
      )}
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          قبلی
        </Button>
        <span className="self-center text-xs">
          {page.toLocaleString('fa-IR')}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={!query.data?.hasMore}
          onClick={() => setPage(page + 1)}
        >
          بعدی
        </Button>
      </div>
    </div>
  );
}
