'use client';

import type { HrDirectoryResponse } from '@nora/contracts';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { selectableAssigneeOptions } from './assignee-options';

export function AssigneePicker({
  name,
  initial = '',
  branchId,
}: {
  name: string;
  initial?: string;
  branchId?: string;
}) {
  const [selected, setSelected] = useState(initial);
  const [selectedLabel, setSelectedLabel] = useState(
    initial ? 'مسئول انتخاب‌شده فعلی' : '',
  );
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [response, setResponse] = useState<HrDirectoryResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set('search', search.trim());
        if (branchId) params.set('branchId', branchId);
        const base = getPublicApiBaseUrl();
        if (!base) throw new Error('نشانی سرویس تنظیم نشده است.');
        const result = await fetch(`${base}/hr/directory?${params}`, {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!result.ok)
          throw new Error(
            result.status === 403
              ? 'دسترسی به فهرست کارکنان ندارید؛ مسئول فعلی حفظ می‌شود.'
              : 'فهرست کارکنان دریافت نشد.',
          );
        const data = (await result.json()) as HrDirectoryResponse;
        if (controller.signal.aborted) return;
        setResponse(data);
        setError('');
      } catch (cause) {
        if (controller.signal.aborted) return;
        setResponse(null);
        setError(cause instanceof Error ? cause.message : 'دریافت ناموفق بود.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, search, branchId, retry]);

  const employees = response?.employees ?? [];
  const options = selectableAssigneeOptions(employees);

  return (
    <SearchCombobox
      name={name}
      label="مسئول پاسخ‌گویی"
      placeholder="نام، کد پرسنلی یا واحد کارمند"
      className="h-11 w-full rounded-xl border border-input bg-surface px-3"
      value={selected}
      selectedLabel={selected ? selectedLabel : undefined}
      options={options}
      remote
      loading={loading}
      error={error || undefined}
      onOpenChange={(next) => {
        setOpen(next);
        setLoading(next);
      }}
      onSearchChange={(query) => {
        setSearch(query);
        setResponse(null);
        setError('');
        setLoading(true);
      }}
      onValueChange={(value) => {
        const employee = employees.find((item) => item.userId === value);
        if (!employee) return;
        setSelected(value);
        setSelectedLabel(`${employee.name} — ${employee.unit}`);
      }}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-2 py-1 text-xs text-muted-foreground">
          {error ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setLoading(true);
                setRetry((value) => value + 1);
              }}
            >
              تلاش دوباره
            </Button>
          ) : response?.hasMore ? (
            <span>برای موارد بیشتر نام دقیق‌تر را جست‌وجو کنید.</span>
          ) : response?.employees.some((employee) => !employee.userId) ? (
            <span>کارکنان بدون حساب متصل قابل انتخاب نیستند.</span>
          ) : null}
          {selected ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSelected('');
                setSelectedLabel('');
              }}
            >
              حذف مسئول
            </Button>
          ) : null}
        </div>
      }
    />
  );
}
