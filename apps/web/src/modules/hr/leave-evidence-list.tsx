'use client';
import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { localizedFetch } from '@/i18n/localized-fetch';
export function LeaveEvidenceList({
  ids,
  path,
}: {
  ids: readonly string[];
  path: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (!ids.length) return null;
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="text-sm font-bold">مدارک استعلاجی</h3>
      <div className="flex flex-wrap gap-2">
        {ids.map((id, index) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                const result = await localizedFetch(
                  `${getPublicApiBaseUrl()}${path}/${encodeURIComponent(id)}`,
                  { credentials: 'include', cache: 'no-store' },
                );
                if (!result.ok) {
                  const body = await result.json().catch(() => null);
                  throw new Error(
                    body?.message ??
                      body?.error?.message ??
                      'دریافت مدرک انجام نشد.',
                  );
                }
                const blob = await result.blob(),
                  url = URL.createObjectURL(blob),
                  link = document.createElement('a');
                const file = result.headers
                  .get('content-disposition')
                  ?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
                link.href = url;
                link.download = file
                  ? decodeURIComponent(file)
                  : `leave-evidence-${index + 1}`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 60000);
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : 'دریافت مدرک انجام نشد.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <FileText className="size-4" aria-hidden="true" />
            مدرک {(index + 1).toLocaleString('fa-IR')}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
