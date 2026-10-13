'use client';
import { useState } from 'react';
import type { FinanceExportQueryV1 } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
export function exportQueryString(query: FinanceExportQueryV1) {
  return new URLSearchParams(
    Object.entries(query)
      .filter(
        ([, value]) => value !== undefined && value !== '' && value !== null,
      )
      .map(([key, value]) => [key, String(value)]),
  ).toString();
}
export async function downloadFinanceExport(
  query: FinanceExportQueryV1,
  format: 'xlsx' | 'pdf',
) {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی API مالی تنظیم نشده است.');
  const path =
    format === 'pdf' ? '/finance/export/pdf?' : base + '/finance/export.xlsx?';
  const get = () =>
    fetch(path + exportQueryString(query), {
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
    });
  let response = await get();
  if (response.status === 401 && (await refreshAuthenticatedSession(base)))
    response = await get();
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(
      typeof error?.message === 'string'
        ? error.message
        : 'خروجی ساخته نشد؛ دسترسی، فیلتر و تنظیمات سرور را بررسی کنید.',
    );
  }
  const mime =
    format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (
    response.headers
      .get('content-type')
      ?.split(';')[0]
      ?.trim()
      .toLowerCase() !== mime
  )
    throw new Error('پاسخ سرور فایل معتبر نیست.');
  const blob = await response.blob(),
    signature = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const valid =
    format === 'pdf'
      ? new TextDecoder().decode(signature) === '%PDF-'
      : signature[0] === 0x50 &&
        signature[1] === 0x4b &&
        signature[2] === 3 &&
        signature[3] === 4;
  if (!valid || !blob.size) throw new Error('فایل خروجی خالی یا نامعتبر است.');
  const url = URL.createObjectURL(blob),
    anchor = document.createElement('a');
  try {
    anchor.href = url;
    anchor.download =
      'finance-' + (query.scope ?? 'INBOX').toLowerCase() + '.' + format;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
export function FinanceExportActions({
  query,
  disabled = false,
  receipt = false,
}: {
  query: FinanceExportQueryV1;
  disabled?: boolean;
  receipt?: boolean;
}) {
  const permissions = useAccessPermissions();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (!permissions?.includes('finance.export')) return null;
  const download = async (format: 'xlsx' | 'pdf') => {
    setBusy(true);
    setError('');
    try {
      await downloadFinanceExport(query, format);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'خروجی دریافت نشد.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || busy}
          onClick={() => void download('xlsx')}
        >
          {receipt ? 'رسید Excel' : 'خروجی Excel'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || busy}
          onClick={() => void download('pdf')}
        >
          {busy
            ? 'در حال تهیه…'
            : receipt
              ? 'رسید PDF / چاپ'
              : 'خروجی PDF / چاپ'}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
