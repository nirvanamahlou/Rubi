'use client';

import { useEffect, useState } from 'react';
import styles from './contract-pdf-preview.module.css';

export const contractPdfPath = (contractId: string) =>
  `/sales/contracts/${encodeURIComponent(contractId)}/pdf`;

export function ContractPdfPreview({
  contractId,
  contractNumber,
}: {
  contractId: string | undefined;
  contractNumber: string;
}) {
  const [attempt, setAttempt] = useState(0);
  if (!contractId)
    return (
      <p className={styles.error} role="alert">
        شناسهٔ قرارداد در اطلاعات دریافتی رزرواسیون موجود نیست.
      </p>
    );
  return (
    <ContractPdfLoader
      key={`${contractId}:${attempt}`}
      contractId={contractId}
      contractNumber={contractNumber}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}

function ContractPdfLoader({
  contractId,
  contractNumber,
  onRetry,
}: {
  contractId: string;
  contractNumber: string;
  onRetry: () => void;
}) {
  const [pdfUrl, setPdfUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let objectUrl = '';
    void fetch(contractPdfPath(contractId), {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (
          !response.ok ||
          !response.headers.get('content-type')?.includes('application/pdf')
        ) {
          const body = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(
            body?.message ??
              'دریافت PDF قرارداد انجام نشد؛ دسترسی و اتصال را بررسی کنید.',
          );
        }
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setPdfUrl(objectUrl);
      })
      .catch((reason: unknown) => {
        if (
          active &&
          !(reason instanceof DOMException && reason.name === 'AbortError')
        )
          setError(
            reason instanceof Error
              ? reason.message
              : 'دریافت PDF قرارداد انجام نشد.',
          );
      });
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [contractId]);

  return (
    <div className={styles.preview}>
      {!pdfUrl && !error && <p role="status">در حال ساخت PDF قرارداد…</p>}
      {error && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button type="button" onClick={onRetry}>
            تلاش دوباره
          </button>
        </div>
      )}
      {pdfUrl && (
        <>
          <iframe
            title={`PDF قرارداد ${contractNumber}`}
            src={pdfUrl}
            className={styles.frame}
          />
          <a
            href={pdfUrl}
            download={`contract-${contractNumber}.pdf`}
            className={styles.download}
          >
            دانلود PDF قرارداد
          </a>
        </>
      )}
    </div>
  );
}
