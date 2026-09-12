'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
export async function rateRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const run = () =>
    fetch(`${getPublicApiBaseUrl()}/reservations/hotel-rates${path}`, {
      ...init,
      credentials: 'include',
      cache: 'no-store',
      headers: { 'content-type': 'application/json', ...init?.headers },
    });
  let response = await run();
  if (
    response.status === 401 &&
    (await refreshAuthenticatedSession(getPublicApiBaseUrl() ?? ''))
  )
    response = await run();
  if (!response.ok) {
    let message = 'ارتباط برقرار نشد؛ دوباره تلاش کنید.';
    try {
      const body = await response.json();
      if (typeof body.message === 'string') message = body.message;
    } catch {
      /* Keep the fallback for non-JSON server errors. */
    }
    throw Error(
      response.status === 403
        ? 'دسترسی این بخش برای حساب شما فعال نیست.'
        : message,
    );
  }
  return response.json();
}
export type Option = { id: string; name: string };
export function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}) {
  return (
    <Select dir="rtl" value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        style={{
          background: 'var(--surface)',
          color: 'var(--foreground)',
          borderColor: 'var(--input)',
        }}
      >
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Lookup({
  kind,
  label,
  value,
  onChange,
}: {
  kind: 'hotels' | 'organizations';
  label: string;
  value: Option | null;
  onChange: (value: Option) => void;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [options, setOptions] = useState<Option[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      rateRequest<{ data: Option[]; meta: { total: number } }>(
        `/options?kind=${kind}&search=${encodeURIComponent(search)}&page=${page}`,
      )
        .then((r) => {
          if (active) {
            setOptions(r.data);
            setTotal(r.meta.total);
            setError('');
          }
        })
        .catch((e) => {
          if (active) {
            setOptions([]);
            setError(e.message);
          }
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [kind, search, page]);
  const choices =
    value && !options.some((o) => o.id === value.id)
      ? [value, ...options]
      : options;
  return (
    <div style={{ display: 'grid', gap: 6, minWidth: 180 }}>
      <input
        aria-label={`جست‌وجوی ${label}`}
        placeholder={`جست‌وجوی ${label}`}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <Choice
        label={label}
        value={value?.id ?? ''}
        onChange={(id) => {
          const found = choices.find((o) => o.id === id);
          if (found) onChange(found);
        }}
        options={choices}
      />
      {total > 50 && (
        <div>
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            قبلی
          </button>
          <span> {page} </span>
          <button
            type="button"
            disabled={page * 50 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            بعدی
          </button>
        </div>
      )}
      {!error && !options.length && (
        <small>
          برای جست‌وجوی بیشتر نام را وارد کنید؛ هتل و کارگزار باید در{' '}
          <Link href="/master-data/organizations-suppliers">اطلاعات پایه</Link>{' '}
          ثبت شده باشند.
        </small>
      )}
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
