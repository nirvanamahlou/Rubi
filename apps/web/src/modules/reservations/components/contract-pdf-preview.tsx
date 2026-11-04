'use client';

import { useEffect, useState } from 'react';
import { loadContractPrint } from '@/modules/sales/components/contract-output';
import styles from './contract-pdf-preview.module.css';
import { ContractNoticeEditor } from './contract-notice-editor';

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
    <div className="grid w-full gap-4">
      <ContractPrintLoader
        key={`${contractId}:${attempt}`}
        contractId={contractId}
        contractNumber={contractNumber}
        onRetry={() => setAttempt((value) => value + 1)}
      />
      <ContractNoticeEditor
        key={contractId}
        contractId={contractId}
        onSaved={() => setAttempt((v) => v + 1)}
      />
    </div>
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
  const [html, setHtml] = useState('');
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
            title={`قرارداد ${contractNumber}`}
            srcDoc={html}
            sandbox="allow-same-origin allow-modals"
            className={styles.frame}
          />
        </>
      )}
    </div>
  );
}
