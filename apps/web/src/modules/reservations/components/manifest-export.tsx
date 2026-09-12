'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';

export function ManifestExport({
  requestId,
  contractNumber,
}: {
  requestId?: string;
  contractNumber?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function download() {
    if (!requestId || !contractNumber || busy) return;
    const base = getPublicApiBaseUrl();
    if (!base) {
      setError('نشانی سرور تنظیم نشده است.');
      return;
    }
    setBusy(true);
    setError('');
    const send = () =>
      fetch(
        `${base}/reservations/requests/${encodeURIComponent(requestId)}/manifest.xlsx`,
        {
          credentials: 'include',
          cache: 'no-store',
        },
      );
    try {
      let response = await send();
      if (response.status === 401 && (await refreshAuthenticatedSession(base)))
        response = await send();
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          typeof result?.message === 'string'
            ? result.message
            : typeof result?.error?.message === 'string'
              ? result.error.message
              : 'MANIFEST آماده نشد.',
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `iran-airtour-${contractNumber.replace(/[^A-Za-z0-9_-]/g, '_')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'MANIFEST آماده نشد.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-3 rounded-xl border border-border p-4">
      <strong>
        {contractNumber
          ? `قرارداد انتخاب‌شده: ${contractNumber}`
          : 'ابتدا یک قرارداد را از صندوق درخواست‌ها انتخاب کنید.'}
      </strong>
      <p className="text-sm text-muted-foreground">
        قالب رسمی Pax List ایران ایرتور با اطلاعات پاسپورتی ثبت‌شده در فروش
        ساخته می‌شود. فایل شامل شیت‌های راهنمای اصلی ایرلاین است.
      </p>
      <Button disabled={!requestId || busy} onClick={() => void download()}>
        {busy ? 'در حال ساخت MANIFEST…' : 'دریافت MANIFEST ایران ایرتور'}
      </Button>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
