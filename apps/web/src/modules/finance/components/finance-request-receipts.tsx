'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DocumentListItemV1 } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { paymentReceiptsApi } from '@/modules/sales/api/payment-receipts';
import { paymentDocumentScanLabel } from '@/modules/sales/model/payment-evidence';

export function FinanceRequestReceipts({
  contractId,
  paymentId,
}: {
  contractId: string;
  paymentId: string;
}) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['finance-request-receipts', contractId, paymentId, page],
    queryFn: () => paymentReceiptsApi.list(contractId, paymentId, page),
  });
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">اسناد و فایل‌ها</h3>
        <Button
          size="sm"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          تازه‌سازی مدارک
        </Button>
      </div>
      {query.isPending && <p role="status">در حال دریافت یا ذخیره مدارک…</p>}
      {query.error ? (
        <p role="alert">{query.error.message}</p>
      ) : (
        <>
          {query.data?.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              هنوز مدرکی برای این پرداخت ثبت نشده است.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {query.data?.data.map((item) => (
              <Receipt
                key={item.id}
                item={item}
                contractId={contractId}
                paymentId={paymentId}
              />
            ))}
          </div>
        </>
      )}
      {(query.data?.meta.totalPages ?? 0) > 1 && (
        <div className="flex items-center gap-2">
          <Button
            disabled={query.isFetching || page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            قبلی
          </Button>
          <span>
            {page} / {query.data?.meta.totalPages}
          </span>
          <Button
            disabled={
              query.isFetching || page >= (query.data?.meta.totalPages ?? 1)
            }
            onClick={() => setPage((p) => p + 1)}
          >
            بعدی
          </Button>
        </div>
      )}
    </section>
  );
}
function Receipt({
  item,
  contractId,
  paymentId,
}: {
  item: DocumentListItemV1;
  contractId: string;
  paymentId: string;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const allowed =
    item.capabilities.download && item.currentVersion.scanStatus === 'CLEAN';
  const image = ['image/jpeg', 'image/png'].includes(
    item.currentVersion.detectedMimeType,
  );
  useEffect(() => {
    setUrl('');
    if (!allowed || !image) return;
    let active = true;
    let objectUrl = '';
    paymentReceiptsApi
      .download(contractId, paymentId, item.id)
      .then((result) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(result.blob);
        setUrl(objectUrl);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'دریافت مدارک ناموفق بود.',
          );
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [allowed, image, contractId, paymentId, item.id, item.currentVersion.id]);
  async function download() {
    setBusy(true);
    setError('');
    try {
      const result = await paymentReceiptsApi.download(
        contractId,
        paymentId,
        item.id,
      );
      const objectUrl = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = item.currentVersion.safeDownloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'دریافت مدارک ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="min-w-0 space-y-3 rounded-xl border bg-background p-3">
      {allowed && url && image && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg border bg-muted/20 p-2"
        >
          {/* Authenticated, short-lived blob URL; no public document URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={item.currentVersion.originalFileName}
            className="h-40 w-full object-contain"
          />
        </a>
      )}
      <p className="break-words text-sm font-medium">
        {item.currentVersion.originalFileName}
      </p>
      <p className="text-xs text-muted-foreground">
        {paymentDocumentScanLabel(item.currentVersion.scanStatus)}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={!allowed || busy}
        onClick={() => void download()}
      >
        دریافت مدرک
      </Button>
    </article>
  );
}
