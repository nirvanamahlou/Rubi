'use client';

import type { MasterDataRecord } from '@nora/contracts';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  MasterDataApiError,
  masterDataApi,
  type MasterDataLogoChange,
} from '../api/client';

export function MasterDataLogoImage({
  className = 'size-10',
  pending,
  record,
  showError = false,
}: {
  className?: string;
  pending?: MasterDataLogoChange;
  record?: MasterDataRecord;
  showError?: boolean;
}) {
  const [imageState, setImageState] = useState<{
    key: string;
    url: string;
  } | null>(null);
  const [errorState, setErrorState] = useState<{
    key: string;
    kind: 'error' | 'pending';
    message: string;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const file = pending?.kind === 'replace' ? pending.file : undefined;
  const documentId = String(record?.attributes.logoFileReference ?? '').trim();
  const recordId = record?.id;
  const resource = record?.resource;
  const imageKey = file
    ? `local:${file.name}:${file.size}:${file.lastModified}`
    : `${resource}/${recordId}/${documentId}`;
  const url = imageState?.key === imageKey ? imageState.url : null;
  const issue = errorState?.key === imageKey ? errorState : null;
  const error = issue?.message ?? '';
  const logoName = record?.name ?? 'انتخاب‌شده';
  const fallbackLabel = issue
    ? issue.kind === 'pending'
      ? `لوگوی ${logoName} در حال بررسی امنیتی است.`
      : `نمایش لوگوی ${logoName} ممکن نیست: ${issue.message}`
    : `در حال دریافت لوگوی ${logoName}`;

  useEffect(() => {
    if (
      pending?.kind === 'remove' ||
      (!file && (!resource || !recordId || !documentId))
    )
      return;
    const controller = new AbortController();
    let active = true;
    let objectUrl: string | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let scanRetries = 0;
    function load() {
      const image = file
        ? Promise.resolve(file)
        : masterDataApi.previewLogo(
            { resource: resource!, recordId: recordId! },
            controller.signal,
          );
      void image
        .then((blob) => {
          if (!active) return;
          objectUrl = URL.createObjectURL(blob);
          setImageState({ key: imageKey, url: objectUrl });
          setErrorState(null);
        })
        .catch((caught: unknown) => {
          if (!active || controller.signal.aborted) return;
          if (
            caught instanceof MasterDataApiError &&
            caught.status === 409 &&
            scanRetries < 12
          ) {
            scanRetries += 1;
            setErrorState({
              key: imageKey,
              kind: 'pending',
              message:
                'لوگو در حال بررسی امنیتی است؛ نمایش آن خودکار انجام می‌شود.',
            });
            retryTimer = setTimeout(load, 5000);
            return;
          }
          setErrorState({
            key: imageKey,
            kind: 'error',
            message:
              caught instanceof Error
                ? caught.message
                : 'نمایش لوگو ممکن نیست.',
          });
        });
    }
    load();
    return () => {
      active = false;
      controller.abort();
      if (retryTimer) clearTimeout(retryTimer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, file, imageKey, pending?.kind, recordId, resource, retry]);

  if (pending?.kind === 'remove' || (!file && !documentId)) return null;
  return (
    <div className={showError ? 'space-y-1' : undefined}>
      {url ? (
        // Authenticated blob URLs are not supported by Next Image optimization.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={`لوگوی ${record?.name ?? 'انتخاب‌شده'}`}
          className={`${className} rounded-lg border border-border object-contain`}
          src={url}
        />
      ) : null}
      {!url && !showError ? (
        <span
          aria-label={fallbackLabel}
          className={`${className} inline-flex items-center justify-center rounded-lg bg-muted/50 text-xs font-black text-muted-foreground`}
          role="status"
          title={fallbackLabel}
        >
          <span aria-hidden="true">{issue?.kind === 'error' ? '!' : '…'}</span>
        </span>
      ) : null}
      {error && showError ? (
        <div
          className="flex items-center gap-2 text-xs text-destructive"
          role="status"
        >
          <span>{error}</span>
          <Button
            onClick={() => setRetry((value) => value + 1)}
            size="sm"
            type="button"
            variant="outline"
          >
            تلاش دوباره
          </Button>
        </div>
      ) : null}
    </div>
  );
}
