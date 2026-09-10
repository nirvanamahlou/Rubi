'use client';
import { useEffect, useState } from 'react';
import type { DocumentListItemV1 } from '@rubi/contracts';
import { documentsApi } from '../documents/api/client';

export function HrArchiveDocumentPicker({
  branchId,
  value,
  onChange,
}: {
  branchId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const key = JSON.stringify([branchId, search, page]);
  const [result, setResult] = useState<{
    key: string;
    documents?: readonly DocumentListItemV1[];
    hasMore?: boolean;
    error?: string;
  }>();
  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void documentsApi
        .list({
          branchId,
          domain: 'HUMAN_RESOURCES',
          archiveStatus: 'ACTIVE',
          search,
          page,
          pageSize: 50,
        })
        .then((response) => {
          if (active)
            setResult({
              key,
              documents: response.data,
              hasMore: page * 50 < response.meta.total,
            });
        })
        .catch((e: unknown) => {
          if (active)
            setResult({
              key,
              error:
                e instanceof Error ? e.message : 'دریافت اسناد ناموفق بود.',
            });
        });
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, branchId, key, search, page]);
  const current = result?.key === key ? result : undefined;
  return (
    <span className="block space-y-2">
      <button type="button" onClick={() => setOpen((v) => !v)}>
        انتخاب سند موجود در اسناد و فایل‌ها
      </button>
      {open ? (
        <>
          <input
            aria-label="جست‌وجوی سند آرشیو"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="سند آرشیوشده منابع انسانی"
            value={value.startsWith('document://') ? value : ''}
            disabled={!current?.documents}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">انتخاب سند</option>
            {value.startsWith('document://') &&
            !current?.documents?.some((d) => `document://${d.id}` === value) ? (
              <option value={value}>سند متصل فعلی</option>
            ) : null}
            {current?.documents?.map((d) => (
              <option key={d.id} value={`document://${d.id}`}>
                {d.title} · {d.archiveCode}
              </option>
            ))}
          </select>
          {current?.error ? (
            <span role="alert">{current.error}</span>
          ) : !current?.documents ? (
            <span role="status">در حال دریافت اسناد…</span>
          ) : !current.documents.length ? (
            <span>سندی در این شعبه پیدا نشد.</span>
          ) : null}
          <button
            type="button"
            disabled={page === 1 || !current?.documents}
            onClick={() => setPage((p) => p - 1)}
          >
            اسناد قبلی
          </button>
          <button
            type="button"
            disabled={!current?.hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            اسناد بعدی
          </button>
        </>
      ) : null}
      {value.startsWith('document://') ? (
        <small>سند آرشیو انتخاب شده است؛ فایل دوباره بارگذاری نمی‌شود.</small>
      ) : null}
    </span>
  );
}
