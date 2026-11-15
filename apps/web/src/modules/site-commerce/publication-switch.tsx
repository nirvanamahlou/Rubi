'use client';
import { useEffect, useState } from 'react';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { localizedFetch } from '@/i18n/localized-fetch';

export function WebsitePublicationSwitch(
  props: Parameters<typeof PublicationSwitch>[0],
) {
  return (
    <PublicationSwitch key={`${props.kind}:${props.resourceId}`} {...props} />
  );
}

function PublicationSwitch({
  kind,
  resourceId,
  disabled = false,
}: {
  kind: 'ticket' | 'tour';
  resourceId: string;
  disabled?: boolean;
}) {
  const [state, setState] = useState<{ enabled: boolean; version: number }>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const path = `${getPublicApiBaseUrl()}/sales/site-commerce/v1/nss/publications/${kind}/${resourceId}`;
  useEffect(() => {
    const abort = new AbortController();
    void localizedFetch(path, {
      credentials: 'include',
      cache: 'no-store',
      signal: abort.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw Error('وضعیت انتشار سایت دریافت نشد.');
        return response.json();
      })
      .then((result) => {
        if (!abort.signal.aborted)
          setState(result.data ?? { enabled: false, version: 0 });
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [path]);
  async function change(enabled: boolean) {
    if (!state || saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await localizedFetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-nora-site-commerce': '1',
        },
        body: JSON.stringify({ enabled, version: state.version }),
      });
      if (!response.ok)
        throw Error('ثبت انتشار سایت ناموفق بود؛ وضعیت را دوباره دریافت کنید.');
      const result = await response.json();
      setState(result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت ناموفق بود.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-1 rounded-lg border p-3">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={state?.enabled ?? false}
          disabled={disabled || !state || saving}
          onChange={(e) => void change(e.target.checked)}
        />
        انتشار در سایت نیایش
      </label>
      <p className="text-xs text-muted-foreground">
        فروش این محصول در سایت، قرارداد را از ERP دریافت می‌کند. محصولات قدیمی
        سایت تغییر نمی‌کنند.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
