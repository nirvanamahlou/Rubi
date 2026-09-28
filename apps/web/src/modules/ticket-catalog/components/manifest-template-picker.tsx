'use client';

import { useEffect, useState } from 'react';
import { Button, Input } from '@/components/ui';
import { toursApi } from '../api/tours';

export function ManifestTemplatePicker({
  value,
  name,
  readOnly = false,
  onChange,
}: {
  value: string | null;
  name?: string | undefined;
  readOnly?: boolean;
  onChange: (id: string | null, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([search, page, attempt]);
  const [result, setResult] = useState<{
    key: string;
    data: { id: string; name: string }[];
    hasMore: boolean;
    error?: string;
  }>();
  useEffect(() => {
    if (!open || readOnly) return;
    let active = true;
    const timer = setTimeout(() => {
      void toursApi
        .manifestTemplates(search, page)
        .then((data) => {
          if (active) setResult({ ...data, key });
        })
        .catch((error: unknown) => {
          if (active)
            setResult({
              key,
              data: [],
              hasMore: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'دریافت قالب‌ها ناموفق بود.',
            });
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, readOnly, search, page, key]);
  const current = result?.key === key ? result : undefined;
  const select = (id: string | null, label: string) => {
    onChange(id, label);
    setOpen(false);
    setSearch('');
    setPage(1);
  };
  return (
    <div
      className="relative grid gap-2"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setOpen(false);
          document.getElementById('ticket-manifest-template')?.focus();
        }
      }}
    >
      <label htmlFor="ticket-manifest-template" className="text-sm font-medium">
        انتخاب قالب منیفست
      </label>
      <Button
        id="ticket-manifest-template"
        type="button"
        variant="outline"
        className="justify-between"
        disabled={readOnly}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="ticket-manifest-template-choices"
        onClick={() => setOpen(!open)}
      >
        {value ? name || 'قالب انتخاب‌شده' : 'پیش‌فرض'}{' '}
        <span aria-hidden>▾</span>
      </Button>
      {open && !readOnly ? (
        <div className="grid gap-3 rounded-xl border bg-surface p-3">
          <Input
            autoFocus
            aria-label="جست‌وجوی قالب منیفست"
            placeholder="جست‌وجوی ایرلاین یا مقصد…"
            value={search}
            maxLength={160}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <div
            id="ticket-manifest-template-choices"
            role="listbox"
            aria-label="قالب‌های منیفست"
            className="max-h-52 overflow-y-auto"
            onKeyDown={(event) => {
              const options = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  'button[role="option"]',
                ),
              );
              const index = options.findIndex(
                (option) => option === document.activeElement,
              );
              const next =
                event.key === 'ArrowDown'
                  ? (index + 1) % options.length
                  : event.key === 'ArrowUp'
                    ? (index - 1 + options.length) % options.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? options.length - 1
                        : undefined;
              if (next !== undefined) {
                event.preventDefault();
                options[next]?.focus();
              }
            }}
          >
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className="block w-full rounded-lg px-3 py-2 text-start hover:bg-muted"
              onClick={() => select(null, 'پیش‌فرض')}
            >
              پیش‌فرض
            </button>
            {current?.data.map((row) => (
              <button
                key={row.id}
                type="button"
                role="option"
                aria-selected={value === row.id}
                className="block w-full rounded-lg px-3 py-2 text-start hover:bg-muted"
                onClick={() => select(row.id, row.name)}
              >
                {row.name}
              </button>
            ))}
          </div>
          {!current ? (
            <p role="status">در حال دریافت قالب‌ها…</p>
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
          ) : !current.data.length ? (
            <p role="status">قالبی پیدا نشد.</p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              قبلی
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!current?.hasMore}
              onClick={() => setPage(page + 1)}
            >
              بعدی
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
