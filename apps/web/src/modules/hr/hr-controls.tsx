'use client';
import { useState, type ReactNode } from 'react';
import { CalendarDays, Download, Filter, Pencil, Trash2 } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import type { HrPreviewDataset } from './hr-preview-data';
import { cellText, recordKey } from './hr-data-utils';
import { reportCellText } from './section-reports';
import styles from './hr-workspace.module.css';
import ui from './hr-unified.module.css';

export const HrButton = ({
  children,
  primary = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) => (
  <button
    type="button"
    className={`${styles.button} ${primary ? styles.buttonPrimary : ''}`}
    {...props}
  >
    {children}
  </button>
);
export function HrPanel({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={styles.panel}>
      <header className={ui.panelHeader}>
        <h2>{title}</h2>
        {actions}
      </header>
      <div className={ui.panelContent}>{children}</div>
    </section>
  );
}
export function HrTabs({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <nav className={ui.tabs} aria-label={label}>
      {items.map((item) => (
        <button
          type="button"
          aria-current={item.id === value ? 'page' : undefined}
          className={item.id === value ? ui.activeTab : ''}
          key={item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
export function HrRangeBar({
  onApply,
  actions,
  initialRange,
}: {
  initialRange?: { from: string; to: string };
  onApply: (from: string, to: string) => void;
  actions?: ReactNode;
}) {
  const [from, setFrom] = useState(initialRange?.from ?? '');
  const [to, setTo] = useState(initialRange?.to ?? '');
  const [error, setError] = useState('');
  return (
    <section className={ui.range} aria-label="بازه گزارش">
      <span>
        <CalendarDays size={16} /> بازه گزارش
      </span>
      <label>
        از تاریخ
        <DatePicker value={from} onChange={setFrom} aria-label="از تاریخ" />
      </label>
      <label>
        تا تاریخ
        <DatePicker value={to} onChange={setTo} aria-label="تا تاریخ" />
      </label>
      <div className={ui.actions}>
        <HrButton
          primary
          onClick={() => {
            if (from && to && from > to) {
              setError('تاریخ پایان باید پس از شروع باشد.');
              return;
            }
            setError('');
            onApply(from, to);
          }}
        >
          <Filter size={15} /> اعمال بازه
        </HrButton>
        {actions}
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
export function HrTable({
  data,
  onOpen,
  onEdit,
  onDelete,
  empty = 'رکوردی مطابق این فیلترها وجود ندارد.',
}: {
  data: HrPreviewDataset;
  onOpen?: (index: number) => void;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
  empty?: string;
}) {
  const [page, setPage] = useState(0);
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(data.rows.length / 20) - 1),
  );
  const start = currentPage * 20;
  return (
    <>
      <div className={ui.tableScroll}>
        <table className={ui.table}>
          <thead>
            <tr>
              {data.columns.map((column, i) => (
                <th key={`${i}-${column}`}>{column}</th>
              ))}
              {onOpen || onEdit || onDelete ? <th>عملیات</th> : null}
            </tr>
          </thead>
          <tbody>
            {data.rows.slice(start, start + 20).map((row, offset) => {
              const index = start + offset;
              return (
                <tr key={recordKey(data, index) || index}>
                  {data.columns.map((column, col) => (
                    <td key={`${column}-${col}`}>
                      {col === 1 && onOpen ? (
                        <button
                          className={ui.link}
                          type="button"
                          onClick={() => onOpen(index)}
                        >
                          {reportCellText(row[col] ?? '') || 'مشاهده پرونده'}
                        </button>
                      ) : column === 'وضعیت' ? (
                        <span className={ui.status}>{cellText(row[col])}</span>
                      ) : (
                        reportCellText(row[col] ?? '')
                      )}
                    </td>
                  ))}
                  {onOpen || onEdit || onDelete ? (
                    <td>
                      <div className={ui.rowActions}>
                        {onOpen ? (
                          <HrButton onClick={() => onOpen(index)}>
                            مشاهده
                          </HrButton>
                        ) : null}
                        {onEdit ? (
                          <HrButton
                            aria-label={`ویرایش ${cellText(row[1])}`}
                            onClick={() => onEdit(index)}
                          >
                            <Pencil size={13} />
                            ویرایش
                          </HrButton>
                        ) : null}
                        {onDelete ? (
                          <HrButton
                            aria-label={`حذف ${cellText(row[1])}`}
                            onClick={() => onDelete(index)}
                          >
                            <Trash2 size={13} />
                            حذف
                          </HrButton>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!data.rows.length ? <p className={ui.empty}>{empty}</p> : null}
      </div>
      <footer className={ui.pagination}>
        <span>{data.rows.length.toLocaleString('fa-IR')} رکورد</span>
        {data.rows.length > 20 ? (
          <>
            <HrButton
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              قبلی
            </HrButton>
            <span>صفحه {(currentPage + 1).toLocaleString('fa-IR')}</span>
            <HrButton
              disabled={start + 20 >= data.rows.length}
              onClick={() => setPage(currentPage + 1)}
            >
              بعدی
            </HrButton>
          </>
        ) : null}
      </footer>
    </>
  );
}
export function HrConfirmDelete({
  title,
  onClose,
  onConfirm,
}: {
  title: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent dir="rtl" className={styles.modal}>
        <DialogTitle>حذف {title}</DialogTitle>
        <DialogDescription>
          این رکورد از فهرست‌های فعال و گزارش‌ها کنار گذاشته می‌شود. سابقه تغییر
          برای پیگیری حفظ خواهد شد.
        </DialogDescription>
        {error ? <p role="alert">{error}</p> : null}
        <div className={ui.actions}>
          <HrButton disabled={busy} onClick={onClose}>
            انصراف
          </HrButton>
          <HrButton
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'حذف انجام نشد.');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'در حال حذف…' : 'حذف رکورد'}
          </HrButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function HrExportButton({
  data,
  name,
}: {
  data: HrPreviewDataset;
  name: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <HrButton
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const { downloadHrXlsx } = await import('./hr-xlsx');
            await downloadHrXlsx(`${name}.xlsx`, [
              data.columns,
              ...data.rows.map((row) => row.map(reportCellText)),
            ]);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'خروجی انجام نشد.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download size={15} /> خروجی اکسل
      </HrButton>
      {error ? <span role="alert">{error}</span> : null}
    </>
  );
}

export function HrPdfButton({
  data,
  title,
}: {
  data: HrPreviewDataset;
  title: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <HrButton
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const { downloadSectionPdf } = await import('./section-report-pdf');
            await downloadSectionPdf(title, [{ id: 'report', title, data }]);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'گزارش آماده نشد.');
          } finally {
            setBusy(false);
          }
        }}
      >
        گزارش PDF
      </HrButton>
      {error ? <span role="alert">{error}</span> : null}
    </>
  );
}
