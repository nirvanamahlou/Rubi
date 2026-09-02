'use client';

import type { DocumentCaseOptionV1 } from '@rubi/contracts';
import {
  Check,
  ChevronDown,
  FolderSearch,
  LoaderCircle,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { documentsApi } from '../api/client';

import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils';

export function DocumentCasePicker({
  branchId,
  disabled,
  onSelect,
  selected,
}: {
  branchId: string;
  disabled?: boolean;
  onSelect: (option: DocumentCaseOptionV1 | null) => void;
  selected: DocumentCaseOptionV1 | null;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<readonly DocumentCaseOptionV1[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open || !branchId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      void documentsApi
        .caseOptions(
          {
            branchId,
            ...(search.trim() ? { search: search.trim() } : {}),
            limit: 20,
          },
          controller.signal,
        )
        .then((response) => setOptions(response.data))
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setOptions([]);
          setError(
            reason instanceof Error
              ? reason.message
              : 'دریافت پرونده‌ها ناموفق بود.',
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [attempt, branchId, open, search]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () =>
      document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open]);

  function choose(option: DocumentCaseOptionV1) {
    onSelect(option);
    setOpen(false);
    setSearch('');
  }

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
      ref={rootRef}
    >
      <Button
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="h-auto min-h-11 w-full justify-between px-3 text-start font-normal"
        disabled={disabled || !branchId}
        id="source-relation"
        onClick={() => {
          if (!open) {
            setLoading(true);
            setError('');
            setOptions([]);
          }
          setOpen(!open);
        }}
        role="combobox"
        type="button"
        variant="outline"
      >
        <span className="min-w-0">
          <span
            className={cn(
              'block truncate',
              !selected && 'text-muted-foreground',
            )}
          >
            {selected?.displayLabel ??
              (branchId
                ? 'انتخاب یا جست‌وجوی پرونده'
                : 'ابتدا شعبه را انتخاب کنید')}
          </span>
          {selected ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              پرونده موجود در آرشیو
            </span>
          ) : null}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </Button>

      {open ? (
        <div className="absolute inset-x-0 top-full z-[80] mt-2 overflow-hidden rounded-2xl border border-blue-100 bg-popover shadow-2xl">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="جست‌وجوی پرونده"
                autoFocus
                className="pe-10"
                onChange={(event) => {
                  setLoading(true);
                  setSearch(event.target.value);
                }}
                placeholder="نام قرارداد، رزرو یا پرونده…"
                value={search}
              />
            </div>
          </div>
          <div
            aria-busy={loading || undefined}
            className="max-h-64 overflow-y-auto p-2"
            id={listboxId}
            role="listbox"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
                در حال دریافت پرونده‌ها…
              </div>
            ) : error ? (
              <div className="space-y-3 px-3 py-5 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  onClick={() => {
                    setLoading(true);
                    setAttempt((current) => current + 1);
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  تلاش دوباره
                </Button>
              </div>
            ) : options.length ? (
              options.map((option) => (
                <button
                  aria-selected={selected?.id === option.id}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm outline-none transition hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-blue-950/30 dark:focus-visible:bg-blue-950/30"
                  key={option.id}
                  onClick={() => choose(option)}
                  role="option"
                  type="button"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                    <FolderSearch aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {option.displayLabel}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      پرونده مرتبط موجود
                    </span>
                  </span>
                  {selected?.id === option.id ? (
                    <Check aria-hidden="true" className="size-4 text-primary" />
                  ) : null}
                </button>
              ))
            ) : (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                پرونده‌ای با این عبارت پیدا نشد.
              </div>
            )}
          </div>
          {selected ? (
            <div className="border-t border-border p-2">
              <Button
                className="w-full"
                onClick={() => {
                  onSelect(null);
                  setOpen(false);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" className="size-4" />
                پاک‌کردن انتخاب
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
