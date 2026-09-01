'use client';

import type { DocumentDetailV1 } from '@rubi/contracts';
import {
  Eye,
  FileSearch,
  ImageIcon,
  LoaderCircle,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { Alert, Badge, Button, Input } from '@/components/ui';

const previewableImageMimeTypes = new Set(['image/jpeg', 'image/png']);

type LoadDocumentPreview = (
  document: DocumentDetailV1,
  sensitiveReason: string | undefined,
  signal: AbortSignal,
) => Promise<Blob>;

type PreviewLoadState =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; url: string };

function isSensitive(document: DocumentDetailV1) {
  return (
    document.confidentiality === 'CONFIDENTIAL' ||
    document.confidentiality === 'RESTRICTED'
  );
}

export function DocumentImagePreview({
  document,
  onLoadPreview,
}: {
  document: DocumentDetailV1;
  onLoadPreview: LoadDocumentPreview;
}) {
  const sensitive = isSensitive(document);
  const previewable = previewableImageMimeTypes.has(
    document.currentVersion.detectedMimeType,
  );
  const clean = document.currentVersion.scanStatus === 'CLEAN';
  const allowed = document.capabilities.viewFile;
  const [reason, setReason] = useState('');
  const [approvedReason, setApprovedReason] = useState<string | null>(
    sensitive ? null : '',
  );
  const [requestVersion, setRequestVersion] = useState(0);
  const [previewState, setPreviewState] = useState<PreviewLoadState>(
    sensitive ? { status: 'idle' } : { status: 'loading' },
  );
  const readyToLoad =
    allowed &&
    clean &&
    previewable &&
    approvedReason !== null &&
    (!sensitive || approvedReason.length >= 5);

  useEffect(() => {
    if (!readyToLoad) return;

    const controller = new AbortController();
    let active = true;
    let objectUrl: string | null = null;

    void onLoadPreview(document, approvedReason || undefined, controller.signal)
      .then((blob) => {
        if (!previewableImageMimeTypes.has(blob.type)) {
          throw new Error('پاسخ دریافت‌شده یک تصویر مجاز نیست.');
        }
        objectUrl = URL.createObjectURL(blob);
        if (active) setPreviewState({ status: 'ready', url: objectUrl });
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((caught: unknown) => {
        if (!active || controller.signal.aborted) return;
        setPreviewState({
          status: 'error',
          message:
            caught instanceof Error
              ? caught.message
              : 'بارگذاری پیش‌نمایش تصویر ناموفق بود.',
        });
      });

    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [approvedReason, document, onLoadPreview, readyToLoad, requestVersion]);

  if (!allowed) {
    return (
      <PreviewMessage
        description="حساب فعلی مجوز مشاهده محتوای این فایل را ندارد."
        title="دسترسی به تصویر مجاز نیست"
      />
    );
  }

  if (!clean) {
    return (
      <PreviewMessage
        description="تصویر فقط پس از پایان موفق اسکن امنیتی نمایش داده می‌شود."
        title="پیش‌نمایش هنوز آماده نیست"
      >
        <Badge className="mt-4">{document.currentVersion.scanStatus}</Badge>
      </PreviewMessage>
    );
  }

  if (!previewable) {
    return (
      <PreviewMessage
        description="برای این نوع فایل پیش‌نمایش تصویری موجود نیست؛ می‌توانید نسخه مجاز را دانلود کنید."
        title="این فایل تصویر نیست"
      />
    );
  }

  if (sensitive && approvedReason === null) {
    return (
      <div className="mx-auto w-full max-w-md text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-amber-100 text-amber-700 shadow-sm dark:bg-amber-950/50 dark:text-amber-300">
          <ShieldAlert aria-hidden="true" className="size-8" />
        </span>
        <h3 className="mt-4 text-lg font-black">تصویر محرمانه است</h3>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          برای ثبت صحیح سابقه دسترسی، دلیل مشاهده را وارد کنید.
        </p>
        <div className="mt-5 space-y-3 text-start">
          <Input
            aria-label="دلیل مشاهده تصویر محرمانه"
            onChange={(event) => setReason(event.target.value)}
            placeholder="مثلاً بررسی پرونده مشتری"
            value={reason}
          />
          <Button
            className="w-full"
            disabled={reason.trim().length < 5}
            onClick={() => {
              setPreviewState({ status: 'loading' });
              setApprovedReason(reason.trim());
              setRequestVersion((value) => value + 1);
            }}
            type="button"
          >
            <Eye aria-hidden="true" className="size-4" />
            نمایش امن تصویر
          </Button>
        </div>
      </div>
    );
  }

  if (previewState.status === 'loading') {
    return (
      <div className="text-center" role="status">
        <LoaderCircle
          aria-hidden="true"
          className="mx-auto size-11 animate-spin text-primary"
        />
        <p className="mt-3 text-sm font-bold">در حال دریافت تصویر امن…</p>
      </div>
    );
  }

  if (previewState.status === 'error') {
    return (
      <div className="w-full max-w-lg space-y-3">
        <Alert
          description={previewState.message}
          title="نمایش تصویر ناموفق بود"
          tone="error"
        />
        <Button
          className="w-full"
          onClick={() => {
            setPreviewState({ status: 'loading' });
            setRequestVersion((value) => value + 1);
          }}
          type="button"
          variant="outline"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          تلاش دوباره
        </Button>
      </div>
    );
  }

  if (previewState.status !== 'ready') return null;

  return (
    <figure className="w-full">
      <div className="relative mx-auto flex min-h-80 max-h-[60dvh] w-full items-center justify-center overflow-hidden rounded-2xl border border-sky-200 bg-[linear-gradient(45deg,rgba(14,165,233,.06)_25%,transparent_25%,transparent_75%,rgba(14,165,233,.06)_75%),linear-gradient(45deg,rgba(14,165,233,.06)_25%,transparent_25%,transparent_75%,rgba(14,165,233,.06)_75%)] bg-[length:24px_24px] bg-[position:0_0,12px_12px] p-3 shadow-inner dark:border-sky-400/20">
        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated blob URLs cannot be optimized by Next.js */}
        <img
          alt={`پیش‌نمایش ${document.title}`}
          className="max-h-[56dvh] max-w-full rounded-xl object-contain shadow-xl"
          decoding="async"
          src={previewState.url}
        />
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        <ImageIcon aria-hidden="true" className="size-4 text-primary" />
        <span>{document.currentVersion.safeDownloadName}</span>
        <Badge>تصویر اسکن‌شده و مجاز</Badge>
      </figcaption>
    </figure>
  );
}

function PreviewMessage({
  children,
  description,
  title,
}: {
  children?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="text-center">
      <FileSearch aria-hidden="true" className="mx-auto size-12 text-primary" />
      <h3 className="mt-4 font-black">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        {description}
      </p>
      {children}
    </div>
  );
}
