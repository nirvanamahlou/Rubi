'use client';
import { useId, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Filter,
  Inbox,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Card } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/overlays';
import type { HrPreviewDataset } from './hr-preview-data';
import { cellText, recordKey } from './hr-data-utils';
import { reportCellText } from './hr-report-text';
import { hrStatusTone } from './hr-presentation';
import ui from './hr-unified.module.css';

export const HrButton = ({
  children,
  primary = false,
  variant,
  className,
  ...props
}: ButtonProps & { primary?: boolean }) => (
  <Button
    type="button"
    variant={variant ?? (primary ? 'primary' : 'outline')}
    className={cn(ui.button, className)}
    {...props}
  >
    {children}
  </Button>
);

export function HrStatus({ children }: { children: string }) {
  return (
    <span className={ui.status} data-tone={hrStatusTone(children)}>
      <span aria-hidden="true" />
      {children}
    </span>
  );
}

export function HrLoading({
  label = 'در حال دریافت اطلاعات…',
}: {
  label?: string;
}) {
  return (
    <div className={ui.loading} role="status">
      <LoaderCircle size={22} aria-hidden="true" className="animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function HrEmpty({
  title = 'هنوز رکوردی ثبت نشده است.',
  description = 'بازه و فیلترها را بررسی کنید یا یک رکورد جدید بسازید.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className={ui.empty}>
      <span className={ui.emptyIcon}>
        <Inbox size={24} aria-hidden="true" />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
export function HrPanel({
  title,
  children,
  actions,
  description,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  description?: string;
}) {
  const titleId = useId();
  return (
    <Card className={ui.panel} role="region" aria-labelledby={titleId}>
      <header className={ui.panelHeader}>
        <div>
          <h2 id={titleId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions}
      </header>
      <div className={ui.panelContent}>{children}</div>
    </Card>
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
  children,
}: {
  initialRange?: { from: string; to: string };
  onApply: (from: string, to: string) => void;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const [from, setFrom] = useState(initialRange?.from ?? '');
  const [to, setTo] = useState(initialRange?.to ?? '');
  const [error, setError] = useState('');
  return (
    <section className={ui.rangePanel} aria-label="بازه گزارش">
      <div className={ui.range}>
        <span>
          <CalendarDays size={18} aria-hidden="true" /> بازه گزارش
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
      </div>
      {children ? <div className={ui.rangeFilters}>{children}</div> : null}
      {error ? (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
export function HrTable({
  data,
  onOpen,
  onEdit,
  onDelete,
  empty = 'رکوردی مطابق این فیلترها وجود ندارد.',
  showPagination = true,
  busy = false,
}: {
  data: HrPreviewDataset;
  onOpen?: (index: number) => void;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
  empty?: string;
  showPagination?: boolean;
  busy?: boolean;
}) {
  const [page, setPage] = useState(0);
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(data.rows.length / 20) - 1),
  );
  const start = currentPage * 20;
  return (
    <>
      <div
        className={ui.tableScroll}
        tabIndex={0}
        role="region"
        aria-label="جدول رکوردها"
        aria-busy={busy}
      >
        <table className={ui.table}>
          <thead>
            <tr>
              {data.columns.map((column, i) => (
                <th scope="col" key={`${i}-${column}`}>
                  {column}
                </th>
              ))}
              {onOpen || onEdit || onDelete ? (
                <th scope="col" className={ui.operationCell}>
                  عملیات
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {data.rows.slice(start, start + 20).map((row, offset) => {
              const index = start + offset;
              return (
                <tr key={recordKey(data, index) || index}>
                  {data.columns.map((column, col) => (
                    <td
                      key={`${column}-${col}`}
                      className={col === 1 ? ui.primaryCell : undefined}
                    >
                      {col === 1 && onOpen ? (
                        <button
                          className={ui.link}
                          type="button"
                          onClick={() => onOpen(index)}
                        >
                          {reportCellText(row[col] ?? '') || 'مشاهده پرونده'}
                        </button>
                      ) : column === 'وضعیت' ? (
                        <HrStatus>{cellText(row[col])}</HrStatus>
                      ) : (
                        reportCellText(row[col] ?? '')
                      )}
                    </td>
                  ))}
                  {onOpen || onEdit || onDelete ? (
                    <td className={ui.operationCell}>
                      <div className={ui.rowActions}>
                        {onOpen ? (
                          <HrButton
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpen(index)}
                          >
                            مشاهده <ArrowLeft size={14} aria-hidden="true" />
                          </HrButton>
                        ) : null}
                        {onEdit || onDelete ? (
                          <DropdownMenu dir="rtl">
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`عملیات ${cellText(row[1])}`}
                              >
                                <MoreHorizontal size={18} aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {onEdit ? (
                                <DropdownMenuItem
                                  onSelect={() => onEdit(index)}
                                >
                                  <Pencil size={15} aria-hidden="true" />
                                  ویرایش
                                </DropdownMenuItem>
                              ) : null}
                              {onDelete ? (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onSelect={() => onDelete(index)}
                                >
                                  <Trash2 size={15} aria-hidden="true" />
                                  حذف رکورد
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!data.rows.length ? (
          busy ? (
            <HrLoading />
          ) : (
            <HrEmpty
              title={empty}
              description="با تغییر جست‌وجو یا فیلترها، دوباره بررسی کنید."
            />
          )
        ) : null}
      </div>
      {showPagination ? (
        <footer className={ui.pagination}>
          <span>{data.rows.length.toLocaleString('fa-IR')} رکورد</span>
          {data.rows.length > 20 ? (
            <>
              <HrButton
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronRight size={16} aria-hidden="true" /> قبلی
              </HrButton>
              <span>صفحه {(currentPage + 1).toLocaleString('fa-IR')}</span>
              <HrButton
                disabled={start + 20 >= data.rows.length}
                onClick={() => setPage(currentPage + 1)}
              >
                بعدی <ChevronLeft size={16} aria-hidden="true" />
              </HrButton>
            </>
          ) : null}
        </footer>
      ) : null}
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
      <DialogContent dir="rtl" className={ui.confirmDialog}>
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
            variant="destructive"
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
  disabled = false,
}: {
  data: HrPreviewDataset;
  title: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <HrButton
        disabled={busy || disabled}
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
        <FileText size={15} aria-hidden="true" /> گزارش PDF
      </HrButton>
      {error ? <span role="alert">{error}</span> : null}
    </>
  );
}
