'use client';
import { useEffect, useState } from 'react';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { localizedFetch } from '@/i18n/localized-fetch';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui';

const publicationSites = [{ id: 'nss', name: 'نیایش سیر' }] as const;

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
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState('');
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
    if (
      !state ||
      saving ||
      disabled ||
      !publicationSites.some((site) => site.id === siteId)
    )
      return;
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
        body: JSON.stringify({
          enabled,
          ...(salesStopped || state.salesStopped ? { salesStopped } : {}),
          version: state.version,
        }),
      });
      if (!response.ok)
        throw Error('ثبت انتشار سایت ناموفق بود؛ وضعیت را دوباره دریافت کنید.');
      const result = await response.json();
      setState(result.data);
      setOpen(false);
      setSiteId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت ناموفق بود.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        aria-haspopup="dialog"
        disabled={disabled || !state || saving}
        onClick={() => {
          setSiteId('');
          setError('');
          setOpen(true);
        }}
      >
        انتشار در سایت
      </Button>
      {state?.enabled ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          منتشرشده در نیایش سیر
        </p>
      ) : null}
      {state?.enabled && state.salesStopped ? (
        <p role="status" className="text-xs text-amber-700">
          نمایش در سایت؛ فروش متوقف است
        </p>
      ) : null}
      {kind === 'ticket' ? (
        <p className="text-xs text-muted-foreground">
          برای انتشار، درصد مقصد «نیایش سیر سحر» را ثبت کنید؛ درصد ۱۰۰ یعنی عدم
          نمایش.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        قیمت و اطلاعاتِ منتشرشده با تغییر در ERP به‌روز می‌شود. حذف از سایت،
        محصول و رزروهای قبلی را حذف نمی‌کند.
      </p>
      {error && !open ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (saving) return;
          setOpen(value);
          if (!value) setSiteId('');
        }}
      >
        <DialogContent dir="rtl" className="max-w-md" showCloseButton={!saving}>
          <DialogTitle>انتشار در سایت</DialogTitle>
          <DialogDescription>
            سایت مقصد را انتخاب و انتشار را تأیید کنید.
          </DialogDescription>
          <div className="space-y-2">
            <p className="text-sm font-medium">سایت مقصد</p>
            <Select value={siteId} onValueChange={setSiteId} disabled={saving}>
              <SelectTrigger aria-label="سایت مقصد">
                <SelectValue placeholder="سایت را انتخاب کنید" />
              </SelectTrigger>
              <SelectContent>
                {publicationSites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {siteId && state?.enabled ? (
            <p className="text-sm text-muted-foreground">
              منتشرشده در نیایش سیر
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            {state?.enabled ? (
              <Button
                type="button"
                variant="outline"
                disabled={disabled || !siteId || saving}
                onClick={() => void change(true, !state.salesStopped)}
              >
                {state.salesStopped ? 'ادامه فروش' : 'توقف فروش سایت'}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setOpen(false);
                setSiteId('');
              }}
            >
              انصراف
            </Button>
            <Button
              type="button"
              variant={state?.enabled ? 'outline' : 'primary'}
              disabled={disabled || !state || !siteId || saving}
              onClick={() => void change(!state?.enabled)}
            >
              {saving
                ? 'در حال ثبت…'
                : state?.enabled
                  ? 'لغو انتشار'
                  : 'انتشار'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
