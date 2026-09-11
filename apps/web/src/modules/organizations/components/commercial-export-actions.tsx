'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import {
  commercialWorkbookRows,
  type CommercialReport,
} from '../model/commercial-export';

export function CommercialExportActions({
  disabled,
  loadReport,
}: {
  disabled: boolean;
  loadReport: (isCurrent: () => boolean) => Promise<CommercialReport>;
}) {
  const alive = useRef(true);
  const running = useRef(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function download(format: 'pdf' | 'xlsx') {
    if (disabled || running.current) return;
    running.current = true;
    setBusy(format);
    setError('');
    try {
      const report = await loadReport(() => alive.current);
      report.context.push(
        `زمان گزارش: ${new Date().toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })}`,
      );
      let bytes: Uint8Array;
      if (format === 'pdf') {
        const { commercialPdf } = await import('../model/commercial-pdf');
        bytes = await commercialPdf(report);
      } else {
        const { createOrganizationXlsx } =
          await import('../model/organization-xlsx');
        bytes = createOrganizationXlsx(commercialWorkbookRows(report));
      }
      if (!alive.current) return;
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], {
          type:
            format === 'pdf'
              ? 'application/pdf'
              : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `روبی-${report.title}-${new Date().toISOString().slice(0, 10)}.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (caught) {
      if (alive.current)
        setError(
          caught instanceof Error ? caught.message : 'ساخت خروجی ناموفق بود.',
        );
    } finally {
      running.current = false;
      if (alive.current) setBusy('');
    }
  }
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="خروجی اطلاعات فیلترشده"
    >
      <button
        className="btn"
        disabled={disabled || !!busy}
        onClick={() => void download('xlsx')}
      >
        <Download size={16} />
        {busy === 'xlsx' ? 'در حال ساخت…' : 'خروجی Excel'}
      </button>
      <button
        className="btn"
        disabled={disabled || !!busy}
        onClick={() => void download('pdf')}
      >
        <FileText size={16} />
        {busy === 'pdf' ? 'در حال ساخت…' : 'خروجی PDF'}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
