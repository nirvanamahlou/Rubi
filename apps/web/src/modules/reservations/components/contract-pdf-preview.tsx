'use client';

import { useEffect, useRef, useState } from 'react';
import { loadContractPrint } from '@/modules/sales/components/contract-output';
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
  useEffect(() => {
    const refresh = () => setAttempt((value) => value + 1);
    window.addEventListener('reservation-workflow-changed', refresh);
    return () =>
      window.removeEventListener('reservation-workflow-changed', refresh);
  }, []);
  if (!contractId)
    return (
      <p className={styles.error} role="alert">
        شناسهٔ قرارداد در اطلاعات دریافتی رزرواسیون موجود نیست.
      </p>
    );
  return (
    <ContractPrintLoader
      key={`${contractId}:${attempt}`}
      contractId={contractId}
      contractNumber={contractNumber}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}

function ContractPrintLoader({
  contractId,
  contractNumber,
  onRetry,
}: {
  contractId: string;
  contractNumber: string;
  onRetry: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  async function download() {
    setDownloading(true);
    setError('');
    try {
      const response = await fetch(contractPdfPath(contractId), {
        credentials: 'include',
        cache: 'no-store',
      });
      if (
        !response.ok ||
        !response.headers.get('content-type')?.includes('application/pdf')
      ) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message || 'دانلود PDF قرارداد انجام نشد.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'contract-' + contractId + '.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'دانلود انجام نشد.');
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void loadContractPrint(contractId)
      .then((result) => {
        if (active) {
          setReady(false);
          setHtml(result.html);
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'دریافت خروجی قرارداد انجام نشد.',
          );
      });
    return () => {
      active = false;
    };
  }, [contractId]);

  const print = () => {
    const win = frame.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  return (
    <div className={styles.preview}>
      {!html && !error && <p role="status">در حال ساخت خروجی قرارداد…</p>}
      <button
        type="button"
        onClick={() => void download()}
        disabled={downloading}
        className={styles.download}
      >
        {downloading ? 'در حال دانلود…' : 'دانلود PDF قرارداد'}
      </button>
      {error && (
        <div className={styles.error} role="alert">
          <p>
            {error === 'Failed to fetch'
              ? 'دریافت خروجی قرارداد انجام نشد؛ اتصال سرور را بررسی کنید.'
              : error}
          </p>
          <button type="button" onClick={onRetry}>
            تلاش دوباره
          </button>
        </div>
      )}
      {html && (
        <>
          <iframe
            ref={frame}
            title={`قرارداد ${contractNumber}`}
            srcDoc={html}
            sandbox="allow-same-origin allow-modals"
            onLoad={() => setReady(true)}
            className={styles.frame}
          />
          <button
            type="button"
            disabled={!ready}
            onClick={print}
            className={styles.download}
          >
            چاپ / ذخیره PDF
          </button>
        </>
      )}
    </div>
  );
}
