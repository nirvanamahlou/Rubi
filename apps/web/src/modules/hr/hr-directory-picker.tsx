'use client';
import { useEffect, useId, useState } from 'react';
import {
  hrDirectoryLabel,
  type HrDirectoryEmployee,
  type HrDirectoryResponse,
  type HrFormReferences,
} from '@rubi/contracts';
import { hrRequest } from './hr-api';

export function useHrFormReferences(employeeId?: string) {
  const key = employeeId ?? '';
  const [result, setResult] = useState<{
    key: string;
    data?: HrFormReferences;
    error?: string;
  }>();
  useEffect(() => {
    let active = true;
    void hrRequest<HrFormReferences>(
      `/form-references${employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : ''}`,
    )
      .then((data) => {
        if (active) setResult({ key, data });
      })
      .catch((e: unknown) => {
        if (active)
          setResult({
            key,
            error:
              e instanceof Error
                ? e.message
                : 'دریافت اطلاعات مرجع ناموفق بود.',
          });
      });
    return () => {
      active = false;
    };
  }, [key, employeeId]);
  return {
    data: result?.key === key ? result.data : undefined,
    error: result?.key === key ? result.error : undefined,
  };
}

/** Public directory picker: labels are display-only; callers receive the canonical employee/user IDs. */
export function HrDirectoryPicker({
  branchId,
  selected,
  onSelect,
  disabled,
  label = 'انتخاب کارمند',
  linkedUsersOnly = false,
}: {
  branchId?: string | undefined;
  selected: HrDirectoryEmployee | null;
  onSelect: (employee: HrDirectoryEmployee | null) => void;
  disabled?: boolean | undefined;
  label?: string;
  linkedUsersOnly?: boolean;
}) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([branchId, search, page, attempt]);
  const [result, setResult] = useState<{
    key: string;
    data?: HrDirectoryResponse;
    error?: string;
  }>();
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({
        search,
        page: String(page),
        ...(branchId ? { branchId } : {}),
      });
      void hrRequest<HrDirectoryResponse>(`/directory?${query}`)
        .then((data) => {
          if (active) setResult({ key, data });
        })
        .catch((e: unknown) => {
          if (active)
            setResult({
              key,
              error:
                e instanceof Error ? e.message : 'دریافت کارکنان ناموفق بود.',
            });
        });
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [branchId, search, page, key]);
  const data = result?.key === key ? result.data : undefined;
  const error = result?.key === key ? result.error : undefined;
  const options = (data?.employees ?? []).filter(
    (e) => !linkedUsersOnly || e.userId,
  );
  const current =
    selected && (!branchId || selected.branchId === branchId) ? selected : null;
  return (
    <div className="space-y-2">
      <label className="block text-sm" htmlFor={`${id}-search`}>
        {label}
      </label>
      <input
        id={`${id}-search`}
        className="w-full rounded-lg border border-border bg-surface p-2"
        disabled={disabled}
        value={search}
        placeholder="نام، کد پرسنلی، واحد یا سمت"
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <select
        aria-label={label}
        className="w-full rounded-lg border border-border bg-surface p-2"
        disabled={disabled || !data}
        value={current?.id ?? ''}
        onChange={(e) =>
          onSelect(options.find((item) => item.id === e.target.value) ?? null)
        }
      >
        <option value="">انتخاب از کارکنان ثبت‌شده</option>
        {current && !options.some((e) => e.id === current.id) ? (
          <option value={current.id}>{hrDirectoryLabel(current)}</option>
        ) : null}
        {options.map((e) => (
          <option key={e.id} value={e.id}>
            {hrDirectoryLabel(e)}
          </option>
        ))}
      </select>
      {error ? (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={() => setAttempt((a) => a + 1)}>
            تلاش مجدد
          </button>
        </p>
      ) : !data ? (
        <p role="status">در حال دریافت کارکنان…</p>
      ) : !options.length ? (
        <p>کارمند فعال واجد شرایطی پیدا نشد.</p>
      ) : null}
      <div className="flex gap-3 text-sm">
        <button
          type="button"
          disabled={disabled || page === 1 || !data}
          onClick={() => setPage((p) => p - 1)}
        >
          قبلی
        </button>
        <button
          type="button"
          disabled={disabled || !data?.hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          بعدی
        </button>
        {current ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(null)}
          >
            پاک‌کردن انتخاب
          </button>
        ) : null}
      </div>
    </div>
  );
}
