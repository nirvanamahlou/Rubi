'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileUp } from 'lucide-react';
import type { DocumentOptionsResponseV1 } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { DocumentUploadDialog } from '@/modules/documents/components/document-upload-dialog';
import { documentsApi } from '@/modules/documents/api/client';

export function IncomingLetterWorkspace() {
  const [options, setOptions] = useState<
    DocumentOptionsResponseV1['data'] | null
  >(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [archiveCode, setArchiveCode] = useState('');
  useEffect(() => {
    let current = true;
    documentsApi
      .options()
      .then((response) => {
        if (current) setOptions(response.data);
      })
      .catch((cause) => {
        if (current)
          setError(
            cause instanceof Error
              ? cause.message
              : 'گزینه‌های فرم بارگذاری قابل دریافت نیست.',
          );
      });
    return () => {
      current = false;
    };
  }, []);
  async function upload(form: FormData) {
    setBusy(true);
    setError('');
    try {
      const response = await documentsApi.upload(form);
      setArchiveCode(response.data.archiveCode);
      setOpen(false);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'بارگذاری ناموفق بود.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section dir="rtl" className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">نامه‌های ورودی</h1>
        <Link href="/correspondence" className="text-primary underline">
          بازگشت به مکاتبات
        </Link>
      </div>
      <div className="rounded-2xl border bg-surface p-6">
        <Button
          disabled={!options || busy}
          onClick={() => {
            setError('');
            setOpen(true);
          }}
        >
          <FileUp className="size-4" />
          بارگذاری نامه
        </Button>
        <Link href="/documents" className="ms-5 text-sm text-primary underline">
          اسناد و فایل‌ها
        </Link>
        {archiveCode && (
          <p role="status" className="mt-4">
            نامه در اسناد و فایل‌ها ثبت شد. کد آرشیو:{' '}
            <b dir="ltr">{archiveCode}</b>
          </p>
        )}
        {error && !open && (
          <p role="alert" className="mt-4 text-destructive">
            {error}
          </p>
        )}
      </div>
      {open && options && (
        <DocumentUploadDialog
          key={options.currentUserId}
          open
          branches={options.branches}
          options={options}
          error={error}
          submitting={busy}
          onOpenChange={setOpen}
          onSubmit={upload}
        />
      )}
    </section>
  );
}
