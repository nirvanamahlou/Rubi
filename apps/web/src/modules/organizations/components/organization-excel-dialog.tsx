'use client';
import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import {
  importOrganizations,
  organizationHeaders,
  previewOrganizations,
  syntheticOrganizations,
  type OrganizationPreviewRow,
} from '../model/organization-import';

export function OrganizationExcelDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [rows, setRows] = useState<OrganizationPreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<OrganizationPreviewRow[]>([]);
  async function inspect(file: File) {
    setBusy(true);
    setRows([]);
    setProgress([]);
    setStarted(false);
    setError('');
    try {
      const { parseOrganizationXlsx } =
        await import('../model/organization-xlsx');
      setRows(await previewOrganizations(await parseOrganizationXlsx(file)));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'خواندن فایل ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (busy || started || !rows.length || rows.some((row) => row.issue))
      return;
    setBusy(true);
    setStarted(true);
    setError('');
    try {
      await importOrganizations(rows, setProgress);
      onImported();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'ورود فایل ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="b2b-design b2b-modal"
        dir="rtl"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogTitle>ورود سازمان‌ها از اکسل</DialogTitle>
        <DialogDescription>
          پیش‌نمایش را بررسی کنید. سازمان‌های موجود با کد یا نام یکسان تغییر
          نمی‌کنند؛ هر ردیف جدید جداگانه ثبت می‌شود.
        </DialogDescription>
        <div className="excel-tools">
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              const { downloadOrganizationXlsx } =
                await import('../model/organization-xlsx');
              downloadOrganizationXlsx('rubi-organizations-template.xlsx', [
                organizationHeaders,
                ...syntheticOrganizations.map((row) => [
                  row.code,
                  row.legalName,
                  row.personType,
                  row.roleCodes,
                ]),
              ]);
            }}
          >
            <Download size={18} />
            دریافت قالب و داده نمونه
          </button>
          <label className="btn">
            <Upload size={18} />
            انتخاب فایل XLSX
            <input
              aria-label="فایل اکسل سازمان‌ها"
              type="file"
              accept=".xlsx"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void inspect(file);
              }}
            />
          </label>
        </div>
        <p className="panel-note">
          حداکثر ۲۰۰ ردیف و ۵ مگابایت. نوع شخصیت: LEGAL یا NATURAL؛ نقش: AGENCY
          یا CORPORATE_CUSTOMER. برای سازمان جدید کد را خالی بگذارید؛ کد خودکار
          تولید می‌شود. فرمول و ماکرو مجاز نیست.
        </p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {busy ? (
          <p role="status">
            {started
              ? `ثبت ${progress.length.toLocaleString('fa-IR')} از ${rows.length.toLocaleString('fa-IR')} ردیف…`
              : 'در حال بررسی فایل و رکوردهای موجود…'}
          </p>
        ) : null}
        {rows.length ? (
          <div className="excel-preview">
            <table>
              <thead>
                <tr>
                  {['ردیف', 'کد', 'نام سازمان', 'نقش', 'نتیجه بررسی'].map(
                    (label) => (
                      <th key={label}>{label}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const result = progress[index];
                  return (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber.toLocaleString('fa-IR')}</td>
                      <td>
                        <bdi>
                          {result?.code ||
                            row.existing?.code ||
                            row.code ||
                            'خودکار'}
                        </bdi>
                      </td>
                      <td>{row.legalName}</td>
                      <td>{row.roleCodes}</td>
                      <td>
                        {result?.message ??
                          row.issue ??
                          (row.existing
                            ? 'موجود؛ بدون تغییر'
                            : started
                              ? 'ثبت نشده'
                              : 'آماده ثبت')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {started && !busy ? (
          <p role="status">
            {progress
              .filter((row) => row.result === 'created')
              .length.toLocaleString('fa-IR')}{' '}
            ثبت شد؛{' '}
            {progress
              .filter((row) => row.result === 'skipped')
              .length.toLocaleString('fa-IR')}{' '}
            موجود بود.{' '}
            {progress.some((row) => row.result === 'failed')
              ? 'عملیات در ردیف خطادار متوقف شد. پس از بررسی نتیجه، فایل را دوباره پیش‌نمایش کنید.'
              : ''}
          </p>
        ) : null}
        <div className="wizard-actions">
          <button className="btn" disabled={busy} onClick={onClose}>
            بستن
          </button>
          <button
            className="btn primary"
            disabled={
              busy || started || !rows.length || rows.some((row) => row.issue)
            }
            onClick={() => void commit()}
          >
            ثبت سازمان‌های جدید
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
