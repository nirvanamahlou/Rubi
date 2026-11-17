'use client';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  parseTaxReferenceCsv,
  type TaxCode,
  type TaxMappingView,
  type TaxReferenceKind,
} from '@nora/contracts';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { accountingApi } from '../api/accounting-api';

export function TaxReferenceWorkspace({
  bookId,
  canManage,
}: {
  bookId: string;
  canManage: boolean;
}) {
  const [kind, setKind] = useState<TaxReferenceKind>('CURRENCY');
  return (
    <section className="space-y-4 rounded-md border p-4">
      <h2 className="font-bold">نگاشت اطلاعات فصلی</h2>
      <div className="flex gap-2">
        {(['CURRENCY', 'REGION'] as const).map((k) => (
          <button
            className="rounded border px-4 py-1 aria-pressed:bg-primary aria-pressed:text-white"
            key={k}
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
          >
            {k === 'CURRENCY' ? 'ارز' : 'منطقه جغرافیایی'}
          </button>
        ))}
      </div>
      <MappingTable
        key={bookId + kind}
        bookId={bookId}
        kind={kind}
        canManage={canManage}
      />
    </section>
  );
}
function MappingTable({
  bookId,
  kind,
  canManage,
}: {
  bookId: string;
  kind: TaxReferenceKind;
  canManage: boolean;
}) {
  const query = useQuery({
    queryKey: ['seasonal-mappings', bookId, kind],
    queryFn: () =>
      accountingApi.analytical<TaxMappingView>(bookId, 'tax-mapping', { kind }),
  });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [label, setLabel] = useState('');
  const [file, setFile] = useState<{ csv: string; rows: TaxCode[] } | null>(
    null,
  );
  const [error, setError] = useState('');
  const [fileKey, setFileKey] = useState(0);
  const mutation = useMutation({
    mutationFn: ({
      action,
      payload,
    }: {
      action: string;
      payload: Record<string, unknown>;
    }) =>
      accountingApi.command(bookId, action, {
        key: crypto.randomUUID(),
        payload,
      }),
    onSuccess: async (_, variables) => {
      if (variables.action === 'tax-reference-import') {
        setFile(null);
        setLabel('');
        setFileKey((k) => k + 1);
      }
      await query.refetch();
    },
  });
  const data = query.data;
  if (!data)
    return (
      <p role="status">
        {query.isError ? 'خطا در دریافت اطلاعات' : 'در حال بارگذاری…'}
      </p>
    );
  const sources = data.sources.filter((s) =>
    (s.code + ' ' + s.title).includes(search),
  );
  const options = data.entries.map((e) => ({
    value: e.id,
    label: e.code + ' — ' + e.title,
  }));
  return (
    <>
      {canManage && (
        <details className="rounded border p-3">
          <summary className="cursor-pointer">
            ورود فهرست رسمی اداره مالیات
          </summary>
          <div className="mt-4 grid gap-3">
            <p>
              فایل CSV با کدگذاری UTF-8 و سرستون <bdi dir="ltr">code,title</bdi>{' '}
              را انتخاب کنید. هر ردیف شامل یک کد و عنوان رسمی است.
            </p>
            <label>
              نسخه فهرست{' '}
              <input
                className="rounded border p-1"
                value={label}
                maxLength={80}
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
            <input
              key={fileKey}
              type="file"
              aria-label="فایل مرجع"
              accept=".csv,text/csv"
              disabled={mutation.isPending}
              onChange={async (e) => {
                const input = e.currentTarget,
                  selected = input.files?.[0];
                setFile(null);
                setError('');
                if (!selected) return;
                try {
                  if (selected.size > 1024 * 1024)
                    throw new Error('اندازه فایل مرجع بیش از یک مگابایت است.');
                  const csv = new TextDecoder('utf-8', { fatal: true }).decode(
                    await selected.arrayBuffer(),
                  );
                  if (input.files?.[0] === selected)
                    setFile({ csv, rows: parseTaxReferenceCsv(csv) });
                } catch (err) {
                  if (input.files?.[0] === selected)
                    setError(
                      err instanceof Error
                        ? err.message
                        : 'فایل مرجع معتبر نیست.',
                    );
                }
              }}
            />
            {file && (
              <div>
                <p>پیش‌نمایش فهرست ({file.rows.length})</p>
                <div className="max-h-56 overflow-auto">
                  <table className="w-full text-start">
                    <tbody>
                      {file.rows.map((row) => (
                        <tr key={row.code}>
                          <td>
                            <bdi>{row.code}</bdi>
                          </td>
                          <td>{row.title}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  className="rounded border px-3 py-1"
                  disabled={!label.trim() || mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      action: 'tax-reference-import',
                      payload: {
                        kind,
                        label,
                        csv: file.csv,
                        previousReleaseId: data.release?.id ?? null,
                      },
                    })
                  }
                >
                  تأیید و فعال‌سازی فهرست
                </button>
              </div>
            )}
          </div>
        </details>
      )}
      {error && <p role="alert">{error}</p>}
      {mutation.isError && <p role="alert">{mutation.error.message}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <span>نسخه فعال فهرست</span>
        <b>{data.release?.label ?? 'تعیین نشده'}</b>
        <input
          className="rounded border p-1"
          aria-label="جستجوی کد یا عنوان"
          placeholder="جستجوی کد یا عنوان"
          value={search}
          onChange={(e) => {
            setPage(0);
            setSearch(e.target.value);
          }}
        />
      </div>
      <table className="w-full text-start">
        <thead>
          <tr>
            <th>کد</th>
            <th>عنوان در نورا</th>
            <th>معادل اداره مالیات</th>
          </tr>
        </thead>
        <tbody>
          {sources.slice(page * 25, (page + 1) * 25).map((source) => (
            <tr className="border-t" key={source.id}>
              <td>
                <bdi>{source.code}</bdi>
              </td>
              <td>{source.title}</td>
              <td>
                <SearchCombobox
                  label={'معادل اداره مالیات ' + source.title}
                  value={source.entryId ?? ''}
                  disabled={!canManage || !data.release || mutation.isPending}
                  placeholder="تعیین نشده"
                  options={[{ value: '', label: 'تعیین نشده' }, ...options]}
                  onValueChange={(id) =>
                    mutation.mutate({
                      action: 'tax-map-save',
                      payload: {
                        kind,
                        sourceId: source.id,
                        releaseId: data.release?.id,
                        previousEntryId: source.entryId,
                        entryId: id || null,
                      },
                    })
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!sources.length && <p>ردیفی برای نمایش وجود ندارد.</p>}
      {sources.length > 25 && (
        <div className="flex gap-3">
          <button disabled={!page} onClick={() => setPage(page - 1)}>
            صفحه قبل
          </button>
          <span>
            {page + 1} / {Math.ceil(sources.length / 25)}
          </span>
          <button
            disabled={(page + 1) * 25 >= sources.length}
            onClick={() => setPage(page + 1)}
          >
            صفحه بعد
          </button>
        </div>
      )}
    </>
  );
}
