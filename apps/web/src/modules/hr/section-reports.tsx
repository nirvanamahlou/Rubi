'use client';
import { useState, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import type { HrPreviewDataset } from './hr-preview-data';
import { parseWeightedGoals } from './weighted-goals';
import { downloadSectionPdf } from './section-report-pdf';
import styles from './hr-workspace.module.css';

export interface SectionReport {
  id: string;
  title: string;
  data: HrPreviewDataset;
}
export function reportCellText(
  cell: HrPreviewDataset['rows'][number][number],
): string {
  if (typeof cell !== 'string') return cell.label;
  if (cell.startsWith('hr-attachment://')) return 'فایل پیوست';
  if (cell.startsWith('['))
    return parseWeightedGoals(cell)
      .map(
        (goal) =>
          `${goal.title} ـ وزن ${goal.weight} ـ ${goal.achieved ? 'محقق‌شده' : 'محقق‌نشده'}`,
      )
      .join('؛ ');
  return cell;
}
export function SectionReports({
  title,
  reports,
  children,
}: {
  title: string;
  reports: readonly SectionReport[];
  children: ReactNode;
}) {
  const [view, setView] = useState('operations');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const filtered = reports
    .filter((report) => selected === 'all' || selected === report.id)
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
      <nav aria-label={`نماهای ${title}`} className={styles.rowActions}>
        {[
          ['overview', 'نمای کلی'],
          ['operations', 'عملیات'],
          ['reports', 'گزارش‌ها'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            onClick={() => setView(id!)}
            className={`${styles.button} ${view === id ? styles.buttonPrimary : ''}`}
          >
            {label}
          </button>
        ))}
      </nav>
      <div hidden={view !== 'operations'}>{children}</div>
      {view === 'overview' ? (
        <section className={styles.panel} aria-label={`نمای کلی ${title}`}>
          <div className={styles.panelBody}>
            <h2>نمای کلی {title}</h2>
            <p>آمار رکوردهای موجود در این نشست</p>
            <div className={styles.hubGrid}>
              {reports.map((report) => (
                <button
                  className={styles.button}
                  key={report.id}
                  onClick={() => {
                    setSelected(report.id);
                    setView('reports');
                  }}
                  type="button"
                >
                  <span>{report.title}</span>
                  <strong>
                    {report.data.rows.length.toLocaleString('fa-IR')}
                  </strong>{' '}
                  رکورد
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      {view === 'reports' ? (
        <section className={styles.panel}>
          <div className={styles.panelBody}>
            <h2>گزارش‌های {title}</h2>
            <div className={styles.rowActions}>
              <select
                aria-label="موضوع گزارش"
                className={styles.control}
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
              >
                <option value="all">همه موضوع‌ها</option>
                {reports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {report.title}
                  </option>
                ))}
              </select>
              <input
                className={styles.control}
                aria-label="جست‌وجوی گزارش"
                placeholder="جست‌وجو در گزارش"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button
                type="button"
                className={`${styles.button} ${styles.buttonPrimary}`}
                disabled={
                  busy || !filtered.some((report) => report.data.rows.length)
                }
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
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
                <Download size={16} />
                {busy ? 'در حال ساخت…' : 'دریافت PDF'}
              </button>
            </div>
            {error ? <p role="alert">{error}</p> : null}
            {filtered.map((report) => (
              <article key={report.id}>
                <h3>
                  {report.title} ·{' '}
                  {report.data.rows.length.toLocaleString('fa-IR')} رکورد
                </h3>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        {report.data.columns.map((column, index) => (
                          <th key={index}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.data.rows.map((row, index) => (
                        <tr key={index}>
                          {row.map((cell, i) => (
                            <td key={i}>{reportCellText(cell)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!report.data.rows.length ? (
                  <p>رکوردی مطابق فیلتر وجود ندارد.</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
