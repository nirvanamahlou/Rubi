'use client';
import { useRef, useState } from 'react';
import type {
  DocumentListItemV1,
  DocumentOptionsResponseV1,
  SalesContractDetail,
} from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import {
  documentsApi,
  DocumentsApiError,
} from '@/modules/documents/api/client';
import {
  paymentDocumentQuery,
  paymentDocumentScanLabel,
  paymentEvidenceForm,
} from '../model/payment-evidence';

export function PaymentDocuments({
  contract,
  paymentId,
}: {
  contract: SalesContractDetail;
  paymentId: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<readonly DocumentListItemV1[]>([]);
  const [options, setOptions] = useState<
    DocumentOptionsResponseV1['data'] | null
  >(null);
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [inputKey, setInputKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [unknown, setUnknown] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const message = (reason: unknown) =>
    reason instanceof Error ? reason.message : 'عملیات مدرک ناموفق بود.';
  async function refresh(nextPage = 1) {
    const result = await documentsApi.list(
      paymentDocumentQuery(contract, paymentId, nextPage),
    );
    setItems(result.data);
    setPage(nextPage);
    setPages(result.meta.totalPages);
  }
  async function load(nextPage = 1) {
    setBusy(true);
    setError('');
    try {
      await refresh(nextPage);
      setOptions((await documentsApi.options()).data);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    if (!file || !options || busy || unknown) return;
    setBusy(true);
    setError('');
    setNotice('');
    let submitted = false;
    try {
      const form = paymentEvidenceForm(contract, paymentId, options, file);
      submitted = true;
      const result = await documentsApi.upload(form);
      setFile(null);
      setInputKey((key) => key + 1);
      setNotice(
        'مدرک ذخیره شد؛ ' +
          paymentDocumentScanLabel(result.data.currentVersion.scanStatus) +
          '. این وضعیت به معنی تأیید پرداخت نیست.',
      );
      submitted = false;
      await refresh();
    } catch (reason) {
      setError(message(reason));
      // No automatic retry of an upload whose server outcome might be unknown.
      if (
        submitted &&
        !(
          reason instanceof DocumentsApiError &&
          reason.status >= 400 &&
          reason.status < 500 &&
          reason.status !== 408
        )
      ) {
        setUnknown(true);
        setNotice(
          'پیش از بارگذاری دوباره، فهرست مدارک را تازه و نتیجهٔ تلاش قبلی را بررسی کنید.',
        );
      }
    } finally {
      setBusy(false);
    }
  }
  async function download(item: DocumentListItemV1) {
    setBusy(true);
    setError('');
    try {
      const result = await documentsApi.download(
        item.id,
        'بررسی مدرک پرداخت قرارداد ' + contract.contractNumber,
      );
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.currentVersion.safeDownloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 border-t pt-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => {
          setOpen(!open);
          if (!open) void load();
        }}
      >
        مدارک پرداخت
      </Button>
      {open ? (
        <div className="mt-3 space-y-3 rounded-xl bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground">
            رسید همین پرداخت را پیوست کنید. اطلاعات کامل کارت، CVV و رمز
            بارگذاری نکنید. فایل تا عبور از بررسی امنیتی قابل دریافت نیست؛ تأیید
            مالی مستقل است.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p role="status" className="text-sm">
              {notice}
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void load()}
          >
            تازه‌سازی مدارک
          </Button>
          {!items.length && !busy && !error ? (
            <p className="text-sm">هنوز مدرکی برای این پرداخت ثبت نشده است.</p>
          ) : null}
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-2"
            >
              <div>
                <p className="text-sm">
                  {item.currentVersion.originalFileName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {paymentDocumentScanLabel(item.currentVersion.scanStatus)}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  busy ||
                  !item.capabilities.download ||
                  item.currentVersion.scanStatus !== 'CLEAN'
                }
                onClick={() => void download(item)}
              >
                دریافت مدرک
              </Button>
            </div>
          ))}
          {pages > 1 ? (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy || page <= 1}
                onClick={() => void load(page - 1)}
              >
                قبلی
              </Button>
              <span>
                {page} / {pages}
              </span>
              <Button
                type="button"
                size="sm"
                disabled={busy || page >= pages}
                onClick={() => void load(page + 1)}
              >
                بعدی
              </Button>
            </div>
          ) : null}
          <FormField label="مدرک پرداخت (PDF، JPG یا PNG)">
            <Input
              ref={fileInput}
              className="sr-only"
              aria-label="انتخاب فایل مدرک پرداخت"
              key={inputKey}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              disabled={busy || !options || unknown}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-background p-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || !options || unknown}
                onClick={() => fileInput.current?.click()}
              >
                انتخاب فایل
              </Button>
              <span className="break-all text-xs">
                {file?.name || 'فایلی انتخاب نشده'}
              </span>
            </div>
          </FormField>
          <Button
            type="button"
            size="sm"
            disabled={busy || !file || !options || unknown}
            onClick={() => void upload()}
          >
            {busy ? 'در حال بررسی…' : 'بارگذاری مدرک'}
          </Button>
          {unknown ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                setUnknown(false);
                setFile(null);
                setInputKey((key) => key + 1);
                setNotice(
                  'فقط اگر فایل قبلی ذخیره نشده، آن را دوباره انتخاب کنید.',
                );
              }}
            >
              فهرست را بررسی کردم؛ انتخاب مجدد فایل
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
