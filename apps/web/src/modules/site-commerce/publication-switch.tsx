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
  const [state, setState] = useState<{
    enabled: boolean;
    salesStopped?: boolean;
    version: number;
  }>();
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
  async function change(enabled: boolean, salesStopped = false) {
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
        body: JSON.stringify({ enabled, salesStopped, version: state.version }),
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
      <p className="text-sm font-medium">سایت نیایش سیر</p>
      <p role="status" className="text-xs">
        {!state
          ? 'دریافت وضعیت…'
          : !state.enabled
            ? 'در سایت نمایش داده نمی‌شود'
            : state.salesStopped
              ? 'نمایش در سایت؛ فروش متوقف است'
              : 'منتشر شده و قابل خرید'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={
            disabled ||
            !state ||
            saving ||
            (state.enabled && !state.salesStopped)
          }
          onClick={() => void change(true)}
          className="rounded-md border px-3 py-2 text-xs"
        >
          {state?.salesStopped ? 'ادامه فروش' : 'انتشار در سایت'}
        </button>
        <button
          type="button"
          disabled={disabled || !state?.enabled || state.salesStopped || saving}
          onClick={() => void change(true, true)}
          className="rounded-md border px-3 py-2 text-xs"
        >
          توقف فروش سایت
        </button>
        <button
          type="button"
          disabled={disabled || !state?.enabled || saving}
          onClick={() => void change(false)}
          className="rounded-md border px-3 py-2 text-xs text-red-600"
        >
          حذف از سایت
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        قیمت و اطلاعاتِ منتشرشده با تغییر در ERP به‌روز می‌شود. حذف از سایت،
        محصول و رزروهای قبلی را حذف نمی‌کند.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
