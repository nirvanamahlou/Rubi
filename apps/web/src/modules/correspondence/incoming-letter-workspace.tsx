'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FileUp, Eye, Download } from 'lucide-react';
import type {
  DocumentListItemV1,
  DocumentListQueryV1,
  DocumentListResponseV1,
  DocumentOptionsResponseV1,
} from '@nora/contracts';
import {
  Button,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui';
import { DocumentUploadDialog } from '@/modules/documents/components/document-upload-dialog';
import { incomingLettersApi as documentsApi } from '@/modules/documents/api/client';

const initialFilters = {
  search: '',
  typeCode: '',
  categoryId: '',
  ownerUserId: '',
  branchId: '',
  createdFrom: '',
  createdTo: '',
};
const field =
  'h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm';
const cards = [
  {
    label: 'همه نامه‌ها',
    color: 'border-blue-200 bg-blue-50 text-blue-900',
    query: {},
  },
  {
    label: 'دارای اعتبار',
    color: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    query: { validity: 'VALID' },
  },
  {
    label: 'منقضی‌شده',
    color: 'border-rose-200 bg-rose-50 text-rose-900',
    query: { validity: 'EXPIRED' },
  },
  {
    label: 'ناقص',
    color: 'border-amber-200 bg-amber-50 text-amber-900',
    query: { completion: 'INCOMPLETE' },
  },
] satisfies { label: string; color: string; query: DocumentListQueryV1 }[];
const message = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'دریافت نامه‌ها ناموفق بود.';
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('fa-IR-u-ca-persian').format(new Date(value))
    : '—';

export function IncomingLetterWorkspace() {
  const [options, setOptions] = useState<
    DocumentOptionsResponseV1['data'] | null
  >(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [archiveCode, setArchiveCode] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [applied, setApplied] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<DocumentListResponseV1 | null>(null);
  const [totals, setTotals] = useState<number[] | null>(null);
  const [preview, setPreview] = useState<DocumentListItemV1 | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileError, setFileError] = useState('');
  useEffect(() => {
    let current = true;
    documentsApi
      .options()
      .then((response) => {
        if (current) setOptions(response.data);
      })
      .catch((cause) => {
        if (current) setError(message(cause));
      });
    return () => {
      current = false;
    };
  }, [revision]);
  useEffect(() => {
    let current = true;
    const query = Object.fromEntries(
      Object.entries(applied).filter(([, value]) => value),
    ) as DocumentListQueryV1;
    const scope: DocumentListQueryV1 = {
      ...query,
      isIncomingLetter: true,
      archiveStatus: 'ACTIVE',
    };
    Promise.resolve().then(() => {
      if (current) {
        setLoading(true);
        setError('');
      }
    });
    Promise.all([
      documentsApi.list({ ...scope, page, pageSize: 25 }),
      Promise.all(
        cards.map((card) =>
          documentsApi.list({ ...scope, ...card.query, pageSize: 10 }),
        ),
      ),
    ])
      .then(([response, counts]) => {
        if (current) {
          setResult(response);
          setTotals(counts.map((item) => item.meta.total));
        }
      })
      .catch((cause) => {
        if (current) {
          setResult(null);
          setTotals(null);
          setError(message(cause));
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [applied, page, revision]);
  useEffect(() => {
    if (!preview) return;
    const controller = new AbortController();
    let url = '';
    documentsApi
      .preview(preview.id, undefined, controller.signal)
      .then(({ blob }) => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setFileError(message(cause));
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [preview]);
  async function upload(form: FormData) {
    setBusy(true);
    setUploadError('');
    try {
      const response = await documentsApi.upload(form);
      setArchiveCode(response.data.archiveCode);
      setOpen(false);
      setPage(1);
      setRevision((value) => value + 1);
      return true;
    } catch (cause) {
      setUploadError(message(cause));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function download(item: DocumentListItemV1) {
    setError('');
    try {
      const { blob } = await documentsApi.download(item.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.currentVersion.safeDownloadName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(message(cause));
    }
  }
  return (
    <section dir="rtl" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">نامه‌های ورودی</h1>
        <Button
          disabled={!options || busy}
          onClick={() => {
            setUploadError('');
            setOpen(true);
          }}
        >
          <FileUp className="size-4" />
          بارگذاری نامه
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => (
          <div
            key={card.label}
            className={`rounded-2xl border p-5 ${card.color}`}
          >
            <p className="text-sm font-semibold">{card.label}</p>
            <p className="mt-3 text-3xl font-bold">
              {loading
                ? '…'
                : (totals?.[index]?.toLocaleString('fa-IR') ?? '—')}
            </p>
          </div>
        ))}
      </div>
      <form
        className="grid items-end gap-4 rounded-2xl border bg-surface p-5 sm:grid-cols-2 xl:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({ ...filters });
          setPage(1);
        }}
      >
        <label className="space-y-2 text-sm">
          <span>جستجو</span>
          <input
            className={field}
            value={filters.search}
            placeholder="عنوان، فرستنده یا کد آرشیو"
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
          />
        </label>
        {(
          [
            {
              key: 'typeCode',
              label: 'نوع سند',
              items: options?.documentTypes.map((item) => ({
                id: item.code,
                name: item.name,
              })),
            },
            {
              key: 'categoryId',
              label: 'دسته‌بندی',
              items: options?.categories,
            },
            {
              key: 'ownerUserId',
              label: 'مالک',
              items: options?.owners.map((item) => ({
                id: item.id,
                name: item.displayName,
              })),
            },
            { key: 'branchId', label: 'شعبه', items: options?.branches },
          ] as const
        ).map((filter) => (
          <label className="space-y-2 text-sm" key={filter.key}>
            <span>{filter.label}</span>
            <select
              className={field}
              value={filters[filter.key]}
              onChange={(event) =>
                setFilters({ ...filters, [filter.key]: event.target.value })
              }
            >
              <option value="">همه</option>
              {filter.items?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <div className="space-y-2 text-sm">
          <label htmlFor="incoming-from">از تاریخ ثبت</label>
          <DatePicker
            id="incoming-from"
            value={filters.createdFrom}
            onChange={(value) => setFilters({ ...filters, createdFrom: value })}
            variant="rubi"
          />
        </div>
        <div className="space-y-2 text-sm">
          <label htmlFor="incoming-to">تا تاریخ ثبت</label>
          <DatePicker
            id="incoming-to"
            value={filters.createdTo}
            onChange={(value) => setFilters({ ...filters, createdTo: value })}
            variant="rubi"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            اعمال فیلتر
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFilters(initialFilters);
              setApplied(initialFilters);
              setPage(1);
            }}
          >
            پاک‌کردن فیلترها
          </Button>
        </div>
      </form>
      {archiveCode && (
        <p role="status">
          نامه ثبت شد. کد آرشیو: <b dir="ltr">{archiveCode}</b>
        </p>
      )}
      {error && (
        <div role="alert" className="text-destructive">
          {error}
          <Button
            variant="outline"
            onClick={() => setRevision((value) => value + 1)}
          >
            تلاش دوباره
          </Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border bg-surface">
        <table className="w-full text-right text-sm">
          <thead className="bg-muted/40">
            <tr>
              {[
                'عنوان',
                'نوع سند',
                'دسته‌بندی',
                'تاریخ اعتبار',
                'مالک',
                'شعبه',
                'فرستنده',
                'عملیات',
              ].map((label) => (
                <th className="whitespace-nowrap p-4" key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center">
                  در حال دریافت…
                </td>
              </tr>
            ) : result?.data.length ? (
              result.data.map((item) => {
                const protectedFile =
                  item.requiresConfidentialAccessCode ||
                  item.requiresStepUpVerification ||
                  ['CONFIDENTIAL', 'RESTRICTED'].includes(item.confidentiality);
                const previewable = [
                  'application/pdf',
                  'image/jpeg',
                  'image/png',
                ].includes(item.currentVersion.detectedMimeType);
                return (
                  <tr className="border-t" key={item.id}>
                    <td className="p-4 font-semibold">{item.title}</td>
                    <td className="p-4">{item.type.name}</td>
                    <td className="p-4">{item.category?.name ?? '—'}</td>
                    <td className="whitespace-nowrap p-4">
                      {date(item.validUntil)}
                    </td>
                    <td className="p-4">{item.owner.displayName}</td>
                    <td className="p-4">
                      {options?.branches.find(
                        (branch) => branch.id === item.branchId,
                      )?.name ?? '—'}
                    </td>
                    <td className="p-4">{item.senderName ?? '—'}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {protectedFile ? (
                          <Link
                            className="text-primary underline"
                            href={`/documents?document=${encodeURIComponent(item.id)}`}
                          >
                            مشاهده فایل
                          </Link>
                        ) : (
                          <>
                            {previewable && (
                              <Button
                                variant="outline"
                                aria-label={`مشاهده ${item.title}`}
                                disabled={!item.capabilities.viewFile}
                                onClick={() => {
                                  setFileError('');
                                  setPreviewUrl('');
                                  setPreview(item);
                                }}
                              >
                                <Eye className="size-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              aria-label={`دریافت ${item.title}`}
                              disabled={!item.capabilities.download}
                              onClick={() => void download(item)}
                            >
                              <Download className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="p-8 text-center">
                  نامه‌ای یافت نشد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={loading || page <= 1}
          onClick={() => setPage((value) => value - 1)}
        >
          قبلی
        </Button>
        <span>
          {page.toLocaleString('fa-IR')} /{' '}
          {(result?.meta.totalPages || 1).toLocaleString('fa-IR')}
        </span>
        <Button
          variant="outline"
          disabled={loading || page >= (result?.meta.totalPages || 1)}
          onClick={() => setPage((value) => value + 1)}
        >
          بعدی
        </Button>
      </div>
      {open && options && (
        <DocumentUploadDialog
          incomingLetter
          open
          branches={options.branches}
          options={options}
          error={uploadError}
          submitting={busy}
          onOpenChange={setOpen}
          onSubmit={upload}
        />
      )}
      <Dialog
        open={Boolean(preview)}
        onOpenChange={(value) => {
          if (!value) {
            setPreview(null);
            setPreviewUrl('');
            setFileError('');
          }
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogTitle>{preview?.title ?? 'مشاهده نامه'}</DialogTitle>
          <DialogDescription>
            {preview?.senderName ?? 'نامه ورودی'}
          </DialogDescription>
          {fileError ? (
            <p role="alert">{fileError}</p>
          ) : previewUrl ? (
            preview?.currentVersion.detectedMimeType === 'application/pdf' ? (
              <iframe
                title="پیش‌نمایش نامه"
                src={previewUrl}
                className="h-[70vh] w-full"
              />
            ) : (
              <Image
                unoptimized
                width={1200}
                height={1600}
                alt={preview?.title ?? ''}
                src={previewUrl}
                className="max-h-[70vh] w-full object-contain"
              />
            )
          ) : (
            <p role="status">در حال دریافت…</p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
