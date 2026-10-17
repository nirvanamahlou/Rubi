'use client';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { downloadOrganizationXlsx } from '@/modules/organizations/model/organization-xlsx';
import { MasterDataProfileDialog } from './master-data-profile-dialog';
import {
  importPartners,
  partnerImportHeaders,
  previewPartnerWorkbook,
  type PartnerImportRow,
} from '../model/partner-import';

export function PartnerExcelDialog({
  resource,
  onClose,
  onImported,
}: {
  resource: 'suppliers' | 'brokers';
  onClose: () => void;
  onImported: () => void;
}) {
  const [rows, setRows] = useState<PartnerImportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  return (
    <MasterDataProfileDialog
      open
      title="ورود اطلاعات از اکسل"
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <div className="space-y-4">
        <Button
          variant="outline"
          onClick={() =>
            downloadOrganizationXlsx(`${resource}-template.xlsx`, [
              partnerImportHeaders,
            ])
          }
        >
          دریافت قالب اکسل
        </Button>
        <Input
          type="file"
          aria-label="فایل اکسل"
          accept=".xlsx"
          disabled={busy || started}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file || pending.current) return;
            pending.current = true;
            setBusy(true);
            setError('');
            setRows([]);
            try {
              setRows(await previewPartnerWorkbook(file));
            } catch (e) {
              setError(
                e instanceof Error ? e.message : 'خواندن فایل ناموفق بود.',
              );
            } finally {
              pending.current = false;
              setBusy(false);
            }
          }}
        />
        {error ? <p role="alert">{error}</p> : null}
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['ردیف', ...partnerImportHeaders, 'نتیجه'].map((h) => (
                  <th key={h} className="p-2 text-start">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.rowNumber}>
                  <td>{row.rowNumber}</td>
                  <td>{row.name}</td>
                  <td>{row.location}</td>
                  <td dir="ltr">{row.phone}</td>
                  <td dir="ltr">{row.mobile}</td>
                  <td dir="ltr">{row.email}</td>
                  <td>
                    {row.error ??
                      (row.result === 'created'
                        ? 'ثبت شد'
                        : row.result === 'skipped'
                          ? 'رکورد موجود تغییر نکرد.'
                          : 'آماده ثبت')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          disabled={busy || started || !rows.some((row) => !row.error)}
          onClick={async () => {
            if (pending.current) return;
            pending.current = true;
            setBusy(true);
            setStarted(true);
            try {
              await importPartners(resource, rows, setRows);
              onImported();
            } finally {
              pending.current = false;
              setBusy(false);
            }
          }}
        >
          ثبت ردیف‌های قابل ذخیره
        </Button>
      </div>
    </MasterDataProfileDialog>
  );
}
