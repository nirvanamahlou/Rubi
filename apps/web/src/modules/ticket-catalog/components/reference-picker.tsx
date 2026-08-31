'use client';

import { useEffect, useState } from 'react';
import { Button, Input } from '@/components/ui';
import {
  asReference,
  listReferences,
  ReferenceApiError,
  type PublishedResource,
} from '../api/references';
import type { Reference } from '../model/catalog';

export function ReferencePicker({
  id,
  label,
  resource,
  value,
  onSelect,
  countryId,
  readOnly = false,
}: {
  id: string;
  label: string;
  resource: PublishedResource;
  value: Reference | undefined;
  onSelect: (value: Reference | undefined) => void;
  countryId?: string;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    rows: Reference[];
    total: number;
    error?: string;
  }>();
  const enabled = !readOnly && (resource !== 'cities' || Boolean(countryId));
  const key = JSON.stringify([resource, search, page, countryId, attempt]);
  useEffect(() => {
    if (!open || !enabled) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      void listReferences(resource, search, page, abort.signal)
        .then((response) => {
          if (abort.signal.aborted) return;
          const rows = response.data
            .map(asReference)
            .filter((item): item is Reference => Boolean(item))
            .filter(
              (item) => resource !== 'cities' || item.countryId === countryId,
            );
          setResult({ key, rows, total: response.meta.total });
        })
        .catch((error: unknown) => {
          if (!abort.signal.aborted)
            setResult({
              key,
              rows: [],
              total: 0,
              error:
                error instanceof ReferenceApiError &&
                error.state === 'unauthorized'
                  ? 'برای دریافت اطلاعات وارد شوید (401).'
                  : error instanceof ReferenceApiError &&
                      error.state === 'forbidden'
                    ? 'مجوز دریافت اطلاعات پایه ندارید (403).'
                    : 'دریافت اطلاعات پایه ناموفق بود؛ دوباره تلاش کنید.',
            });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [open, enabled, resource, search, page, countryId, key]);
  const current = result?.key === key ? result : undefined;
  return (
    <div className="min-w-0 space-y-2">
      <label className="text-sm font-semibold" htmlFor={id}>
        {label}
      </label>
      <div className="flex min-w-0 items-start gap-2">
        <Button
          id={id}
          type="button"
          variant="outline"
          className="h-auto min-h-11 min-w-0 flex-1 whitespace-normal justify-between text-start"
          aria-expanded={open && enabled}
          aria-controls={`${id}-choices`}
          disabled={!enabled}
          onClick={() => {
            if (!open) setAttempt((value) => value + 1);
            setOpen(!open);
            setSearch('');
            setPage(1);
          }}
        >
          {value
            ? `${value.name} (${value.code ?? ''})`
            : resource === 'cities' && !countryId
              ? 'ابتدا کشور را انتخاب کنید'
              : `انتخاب و جست‌وجوی ${label}`}
        </Button>
        {value && !readOnly ? (
          <Button
            type="button"
            variant="ghost"
            aria-label={`پاک‌کردن ${label}`}
            onClick={() => {
              onSelect(undefined);
              setOpen(false);
            }}
          >
            پاک
          </Button>
        ) : null}
      </div>
      {open && enabled ? (
        <div
          id={`${id}-choices`}
          className="min-w-0 space-y-3 rounded-xl border bg-surface p-3"
        >
          <Input
            aria-label={`جست‌وجوی ${label}`}
            placeholder="نام یا کد را جست‌وجو کنید…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          {!current ? (
            <p role="status" className="text-xs">
              در حال جست‌وجو…
            </p>
          ) : current.error ? (
            <div role="alert">
              <p>{current.error}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAttempt(attempt + 1)}
              >
                تلاش دوباره
              </Button>
            </div>
          ) : (
            <>
              <div
                className="max-h-52 space-y-1 overflow-y-auto"
                aria-label={`نتایج ${label}`}
              >
                {current.rows.length ? (
                  current.rows.map((row) => (
                    <Button
                      key={row.id}
                      type="button"
                      variant="ghost"
                      className="h-auto min-h-10 w-full whitespace-normal justify-start text-start"
                      onClick={() => {
                        onSelect(row);
                        setOpen(false);
                      }}
                    >
                      {row.name} ({row.code})
                    </Button>
                  ))
                ) : (
                  <p role="status" className="text-xs">
                    در این صفحه نتیجهٔ منطبق وجود ندارد؛ جست‌وجو را تغییر دهید
                    یا صفحهٔ بعد را ببینید.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  قبلی
                </Button>
                <span>
                  صفحه {page.toLocaleString('fa-IR')} از{' '}
                  {Math.max(1, Math.ceil(current.total / 25)).toLocaleString(
                    'fa-IR',
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={page * 25 >= current.total}
                  onClick={() => setPage(page + 1)}
                >
                  بعدی
                </Button>
              </div>
              {resource === 'cities' ? (
                <p className="text-xs text-muted-foreground">
                  فقط شهرهای کشور انتخاب‌شده قابل انتخاب‌اند. صفحه‌بندی مربوط به
                  جست‌وجوی عمومی شهرهاست.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
