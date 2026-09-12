'use client';

import { useEffect, useState } from 'react';
import type { HrDirectoryResponse } from '@rubi/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { Input } from '@/components/ui/form-controls';
import { Button } from '@/components/ui/button';

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
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
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
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, page, branchId]);
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <input type="hidden" name={name} value={selected} />
      <Input
        aria-label="جست‌وجوی مسئول"
        placeholder="نام یا واحد مسئول"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
      />
      <select
        aria-label="انتخاب مسئول"
        className="h-11 w-full rounded-xl border border-input bg-surface px-3"
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
      >
        <option value="">بدون کارشناس مشخص / صف واحد</option>
        {selected &&
          !response?.employees.some(
            (employee) => employee.userId === selected,
          ) && <option value={selected}>مسئول انتخاب‌شده فعلی</option>}
        {response?.employees
          .filter((employee) => employee.userId)
          .map((employee) => (
            <option key={employee.id} value={employee.userId!}>
              {employee.name} — {employee.unit}
            </option>
          ))}
      </select>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {response && !response.employees.some((employee) => employee.userId) && (
        <p className="text-xs text-muted-foreground">
          کارمند دارای حساب کاربری در این صفحه پیدا نشد.
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          قبلی
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!response?.hasMore}
          onClick={() => setPage(page + 1)}
        >
          بعدی
        </Button>
      </div>
    </div>
  );
}
