'use client';
import { useRef, useState } from 'react';
import type { HrEmployeeDto, HrRecordDto } from '@nora/contracts';
import { FileText, Plus, Download } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogTitle } from '@/components/ui';
import { DatePicker } from '@/components/ui/date-picker';
import { archiveHrFile } from './hr-file-archive';
import { documentsApi } from '../documents/api/client';
import type { HrStore } from './hr-store';

export const payDocumentType = (section: string) =>
  `حقوق و پرداخت / ${section}`;

export function HrPayDocuments({
  employee,
  section,
  records,
  store,
  onSaved,
}: {
  employee: HrEmployeeDto;
  section: string;
  records: HrRecordDto[];
  store: HrStore;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<{ documentId?: string; key: string }>({ key: '' });
  const docs = records.filter(
    (r) =>
      r.section === 'employee' &&
      r.tab === 'docs' &&
      !r.deletedAt &&
      r.employeeId === employee.id &&
      r.values[0] === payDocumentType(section),
  );
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !file || !title.trim() || !date) return;
    if (!pending.current.key) return;
    setBusy(true);
    setError('');
    try {
      if (!pending.current.documentId) {
        const uploaded = await archiveHrFile({
          file,
          employeeId: employee.id,
          entityId: employee.id,
          branchId: employee.branchId,
          title: title.trim(),
          validUntil: validUntil || undefined,
        });
        pending.current.documentId = uploaded.id;
        setUploaded(true);
      }
      await store.create(
        {
          section: 'employee',
          tab: 'docs',
          employeeId: employee.id,
          branchId: employee.branchId,
          values: [
            payDocumentType(section),
            title.trim(),
            '',
            date,
            validUntil,
            new Date().toISOString().slice(0, 10),
            'خیلی محرمانه',
            `document://${pending.current.documentId}`,
          ],
          data: { documentId: pending.current.documentId },
        },
        pending.current.key,
      );
      setOpen(false);
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'ذخیره مدرک انجام نشد.',
      );
    } finally {
      setBusy(false);
    }
  };
  const download = async (record: HrRecordDto) => {
    setError('');
    try {
      const id = record.data.documentId;
      if (!id) throw new Error('فایل این مدرک در دسترس نیست.');
      const { blob } = await documentsApi.download(
        id,
        'مشاهده مدرک حقوق و پرداخت کارمند',
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = record.values[1] || 'document';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'دریافت مدرک انجام نشد.',
      );
    }
  };
  return (
    <section className="mt-5 space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4" />
          مدارک {section}
        </h3>
        {store.data?.capabilities.write && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setUploaded(false);
              setTitle('');
              setDate('');
              setValidUntil('');
              setFile(null);
              setError('');
              pending.current = { key: crypto.randomUUID() };
              setOpen(true);
            }}
          >
            <Plus className="size-4" />
            افزودن مدرک
          </Button>
        )}
      </div>
      {error && !open && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {docs.map((record) => (
        <div
          key={record.id}
          className="flex items-center justify-between gap-3 rounded-lg border p-3"
        >
          <div className="min-w-0">
            <p className="break-words text-sm font-medium">
              {record.values[1]}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {record.values[3]
                ? new Date(`${record.values[3]}T12:00:00Z`).toLocaleDateString(
                    'fa-IR',
                  )
                : '—'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void download(record)}
            aria-label={`دریافت ${record.values[1]}`}
          >
            <Download className="size-4" />
            دریافت
          </Button>
        </div>
      ))}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogTitle>افزودن مدرک · {section}</DialogTitle>
          <form onSubmit={submit} className="mt-4 grid gap-5">
            <label className="grid gap-2 text-sm">
              عنوان مدرک
              <input
                required
                maxLength={200}
                disabled={busy || uploaded}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-11 rounded-lg border bg-background px-3"
              />
            </label>
            <label className="grid gap-2 text-sm">
              تاریخ
              <DatePicker
                value={date}
                onChange={(value) => {
                  if (!busy && !pending.current.documentId) setDate(value);
                }}
              />
            </label>
            <label className="grid gap-2 text-sm">
              اعتبار فایل در بایگانی
              <DatePicker
                value={validUntil}
                onChange={(value) => {
                  if (!busy && !pending.current.documentId)
                    setValidUntil(value);
                }}
              />
            </label>
            <label className="grid gap-2 text-sm">
              فایل مدرک
              <input
                required
                type="file"
                disabled={busy || uploaded}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="rounded-lg border p-3"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button
                type="submit"
                disabled={busy || !file || !title.trim() || !date}
              >
                {busy ? 'در حال ذخیره…' : 'ثبت مدرک'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                انصراف
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
