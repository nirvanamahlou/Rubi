'use client';

import { AffairsSelect } from './affairs-select';
import { useEffect, useState } from 'react';
import type { HrDirectoryResponse } from '@rubi/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { Input } from '@/components/ui/form-controls';
import { Button } from '@/components/ui/button';
import { assigneeOptions } from './assignee-options';

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
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<HrDirectoryResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ search, page: String(page) });
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
        setResponse((await result.json()) as HrDirectoryResponse);
        setError('');
      } catch (cause) {
        if (controller.signal.aborted) return;
        setResponse(null);
        setError(cause instanceof Error ? cause.message : 'دریافت ناموفق بود.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, page, branchId, retry]);
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <input type="hidden" name={name} value={selected} />
      <Input
        aria-label="جست‌وجوی مسئول"
        placeholder="نام، کد پرسنلی یا واحد کارمند"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
      />
      <AffairsSelect
        aria-label="انتخاب مسئول"
        className="h-11 w-full rounded-xl border border-input bg-surface px-3"
        value={selected}
        disabled={loading || Boolean(error)}
        onChange={(event) => {
          const value = event.target.value;
          if (
            !value ||
            response?.employees.some((employee) => employee.userId === value)
          )
            setSelected(value);
        }}
      >
        <option value="">بدون کارشناس مشخص / صف واحد</option>
        {selected &&
          !response?.employees.some(
            (employee) => employee.userId === selected,
          ) && <option value={selected}>مسئول انتخاب‌شده فعلی</option>}
        {assigneeOptions(response?.employees ?? []).map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </AffairsSelect>
      {loading && (
        <p role="status" className="text-xs text-muted-foreground">
          در حال دریافت کارکنان منابع انسانی…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!loading && response && response.employees.length === 0 && (
        <p className="text-xs text-muted-foreground">
          کارمند فعالی مطابق جست‌وجو در محدوده دسترسی شما پیدا نشد.
        </p>
      )}
      {!loading && response?.employees.some((employee) => !employee.userId) && (
        <p className="text-xs text-muted-foreground">
          کارکنان بدون حساب متصل نمایش داده می‌شوند، اما قابل انتخاب نیستند.
          مدیر منابع انسانی باید حساب کاربری متعلق به هر کارمند را در پرونده او
          مشخص کند تا بتواند مسئول پاسخگویی باشد.
        </p>
      )}
      {error && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setRetry(retry + 1)}
        >
          تلاش دوباره
        </Button>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={loading || page === 1}
          onClick={() => setPage(page - 1)}
        >
          قبلی
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={loading || !response?.hasMore}
          onClick={() => setPage(page + 1)}
        >
          بعدی
        </Button>
      </div>
    </div>
  );
}
