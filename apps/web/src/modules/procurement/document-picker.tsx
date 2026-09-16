'use client';
import { FileUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type {
  DocumentListItemV1,
  DocumentOptionsResponseV1,
  ProcurementDocumentReferenceV1,
} from '@nora/contracts';
import { documentsApi } from '@/modules/documents/api/client';
import { Input } from '@/components/ui/form-controls';
import { Alert } from '@/components/ui/surfaces';
import { Button } from '@/components/ui/button';

export function ProcurementDocumentPicker({
  branchId,
  value,
  onChange,
  available,
  invoiceUpload,
}: {
  branchId: string;
  value: ProcurementDocumentReferenceV1[];
  onChange: (value: ProcurementDocumentReferenceV1[]) => void;
  available: boolean;
  invoiceUpload?: { requestId: string; requestNumber: string };
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<readonly DocumentListItemV1[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [invoiceOptions, setInvoiceOptions] = useState<
    DocumentOptionsResponseV1['data'] | null
  >(null);
  const [invoiceUploadError, setInvoiceUploadError] = useState('');
  const [invoiceUploadSuccess, setInvoiceUploadSuccess] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const invoiceRequestId = invoiceUpload?.requestId;
  useEffect(() => {
    if (!invoiceRequestId || !available) return;
    let current = true;
    void documentsApi
      .options()
      .then((result) => {
        if (current) setInvoiceOptions(result.data);
      })
      .catch((caught: unknown) => {
        if (!current) return;
        setInvoiceUploadError(
          caught instanceof Error
            ? caught.message
            : 'تنظیمات اسناد دریافت نشد.',
        );
      });
    return () => {
      current = false;
    };
  }, [available, invoiceRequestId]);
  async function load(targetPage: number) {
    setBusy(true);
    setError('');
    try {
      const result = await documentsApi.list({
        page: targetPage,
        pageSize: 20,
        domain: 'PROCUREMENT',
        branchId,
        scanStatus: 'CLEAN',
        search,
      });
      setRows(result.data);
      setHasMore(result.meta.page < result.meta.totalPages);
      setPage(targetPage);
      setLoaded(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'اسناد دریافت نشدند.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function uploadInvoice(file: File) {
    if (!invoiceUpload || !invoiceOptions) return;
    const documentType = invoiceOptions.documentTypes.find(
      (type) => type.domain === 'PROCUREMENT',
    );
    const category = invoiceOptions.categories[0];
    const owner =
      invoiceOptions.owners.find(
        (candidate) => candidate.id === invoiceOptions.currentUserId,
      ) ?? invoiceOptions.owners[0];
    if (!documentType || !category || !owner) {
      setInvoiceUploadError(
        'تنظیمات نوع سند خرید، دسته‌بندی یا مالک برای بارگذاری فاکتور کامل نیست.',
      );
      return;
    }
    setBusy(true);
    setInvoiceUploadError('');
    setInvoiceUploadSuccess('');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set(
        'title',
        `فاکتور ${invoiceUpload.requestNumber} · ${file.name}`.slice(0, 240),
      );
      form.set('description', 'فایل فاکتور بارگذاری‌شده از خرید و تأمین');
      form.set('documentTypeId', documentType.id);
      form.set('categoryId', category.id);
      form.set('branchId', branchId);
      form.set('ownerUserId', owner.id);
      form.set('sourceModule', 'PROCUREMENT');
      form.set('sourceEntityType', 'ProcurementRequest');
      form.set('sourceEntityId', invoiceUpload.requestId);
      form.set(
        'sourceDisplayLabel',
        `${invoiceUpload.requestNumber} · فاکتور خرید`,
      );
      form.set('confidentiality', documentType.defaultConfidentiality);
      form.set('versionNote', 'بارگذاری از فرم فاکتور خرید');
      const result = await documentsApi.upload(form);
      const reference = {
        id: result.data.id,
        versionId: result.data.currentVersion.id,
      };
      onChange([
        ...value.filter((item) => item.id !== reference.id),
        reference,
      ]);
      setInvoiceUploadSuccess(
        'فایل در اسناد و فایل‌ها ذخیره و به فاکتور پیوست شد.',
      );
      if (fileInput.current) fileInput.current.value = '';
    } catch (caught) {
      setInvoiceUploadError(
        caught instanceof Error
          ? caught.message
          : 'بارگذاری فاکتور ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">مدارک این عملیات</h3>
      {available ? (
        <>
          {invoiceUpload && (
            <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold">بارگذاری فایل فاکتور</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    فایل در بخش «اسناد و فایل‌ها» با مرجع همین درخواست ذخیره و
                    به فاکتور پیوست می‌شود.
                  </p>
                </div>
                <input
                  ref={fileInput}
                  accept={invoiceOptions?.uploadPolicy.allowedMimeTypes.join(
                    ',',
                  )}
                  aria-label="انتخاب فایل فاکتور"
                  className="sr-only"
                  disabled={busy || !invoiceOptions}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadInvoice(file);
                  }}
                  type="file"
                />
                <Button
                  type="button"
                  disabled={busy || !invoiceOptions}
                  loading={busy}
                  onClick={() => fileInput.current?.click()}
                >
                  <FileUp aria-hidden="true" className="size-4" />
                  بارگذاری فاکتور
                </Button>
              </div>
              {invoiceUploadError && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {invoiceUploadError}
                </p>
              )}
              {invoiceUploadSuccess && (
                <p role="status" className="mt-3 text-sm text-emerald-700">
                  {invoiceUploadSuccess}
                </p>
              )}
            </section>
          )}
          <p className="text-xs text-muted-foreground">
            نسخه سالم اسناد خرید مربوط به همین شعبه را انتخاب کنید. اصل فایل در
            آرشیو اسناد باقی می‌ماند.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-40 flex-1"
              aria-label="جست‌وجوی مدارک عملیات"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              loading={busy}
              onClick={() => void load(1)}
            >
              جست‌وجوی مدرک
            </Button>
          </div>
          {error && (
            <Alert
              tone="error"
              title="دریافت اسناد ناموفق بود"
              description={error}
            />
          )}
          {loaded && !rows.length && (
            <p className="text-sm text-muted-foreground">
              سندی با این شرایط پیدا نشد.
            </p>
          )}
          {rows.map((row) => (
            <label
              key={row.id}
              className="flex min-h-11 items-center gap-3 text-sm"
            >
              <input
                type="checkbox"
                checked={value.some((ref) => ref.id === row.id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [
                          ...value.filter((ref) => ref.id !== row.id),
                          { id: row.id, versionId: row.currentVersion.id },
                        ]
                      : value.filter((ref) => ref.id !== row.id),
                  )
                }
              />
              {row.title} · {row.archiveCode}
            </label>
          ))}
          {loaded && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={busy || page <= 1}
                onClick={() => void load(page - 1)}
              >
                صفحه قبل اسناد
              </Button>
              <span className="text-xs">{page.toLocaleString('fa-IR')}</span>
              <Button
                type="button"
                variant="ghost"
                disabled={busy || !hasMore}
                onClick={() => void load(page + 1)}
              >
                صفحه بعد اسناد
              </Button>
            </div>
          )}
        </>
      ) : (
        <Alert
          title="اسناد در دسترس نیست"
          description="مدارک جدید پس از دسترس‌پذیر شدن سرویس اسناد قابل انتخاب هستند."
        />
      )}
      <p className="text-sm">
        مدارک انتخاب‌شده: {value.length.toLocaleString('fa-IR')}
      </p>
      {value.map((ref) => (
        <div key={ref.id} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="break-all">
            {rows.find((row) => row.id === ref.id)?.title ?? ref.id}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(value.filter((item) => item.id !== ref.id))}
          >
            حذف از این عملیات
          </Button>
        </div>
      ))}
    </div>
  );
}
