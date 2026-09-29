'use client';
import { useState, type ReactNode } from 'react';
import { ChevronDown, Download, FileChartColumn } from 'lucide-react';
import type { HrPreviewDataset } from './hr-preview-data';
import { HrButton, HrTable } from './hr-controls';
import { reportCellText } from './hr-report-text';
import ui from './hr-unified.module.css';

export interface SectionReport {
  id: string;
  title: string;
  data: HrPreviewDataset;
}
export { reportCellText } from './hr-report-text';

export function SectionReports({
  title,
  reports,
  children,
}: {
  title: string;
  reports: readonly SectionReport[];
  children: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('all');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selectedId = reports.some((report) => report.id === selected)
    ? selected
    : 'all';
  const filtered = (open ? reports : [])
    .filter((report) => selectedId === 'all' || selectedId === report.id)
    .map((report) => ({
      ...report,
      data: {
        ...report.data,
        rows: report.data.rows.filter(
          (row) =>
            !query.trim() ||
            row.some((cell) => reportCellText(cell).includes(query.trim())),
        ),
      },
    }));
  return (
    <>
      {children}
      <details
        className={ui.reportPanel}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>
          <FileChartColumn size={19} aria-hidden="true" />
          <span>
            آمار و خروجی PDF
            <small>
              {reports
                .reduce((sum, report) => sum + report.data.rows.length, 0)
                .toLocaleString('fa-IR')}{' '}
              رکورد در فهرست انتخاب‌شده
            </small>
          </span>
          <ChevronDown size={17} aria-hidden="true" />
        </summary>
        {open ? (
          <div className={ui.panelContent}>
            <div className={ui.filters}>
              <label>
                موضوع گزارش
                <select
                  value={selectedId}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  <option value="all">همه موضوع‌ها</option>
                  {reports.map((report) => (
                    <option key={report.id} value={report.id}>
                      {report.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                جست‌وجو در گزارش
                <input
                  placeholder="عنوان یا محتوای رکورد"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <HrButton
                primary
                loading={busy}
                disabled={!filtered.some((report) => report.data.rows.length)}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    const { downloadSectionPdf } =
                      await import('./section-report-pdf');
                    await downloadSectionPdf(title, filtered);
                  } catch (reason) {
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : 'ساخت گزارش انجام نشد.',
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Download size={16} aria-hidden="true" />
                دریافت PDF
              </HrButton>
            </div>
            {error ? (
              <p role="alert" className={ui.error}>
                {error}
              </p>
            ) : null}
            <div className={ui.spaced}>
              {filtered.map((report) => (
                <article key={report.id} aria-label={report.title}>
                  <HrTable key={`${report.id}:${query}`} data={report.data} />
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </details>
    </>
  );
}
