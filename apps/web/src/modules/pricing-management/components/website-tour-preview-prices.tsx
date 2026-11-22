'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Input } from '@/components/ui';
import { localizedFetch } from '@/i18n/localized-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';

const hotelFields = [
  ['double', 'دو تخته'],
  ['single', 'یک تخته'],
  ['childWithBed', 'کودک با تخت'],
  ['extra', 'تخت اضافه'],
] as const;
const flightFields = [
  ['adultFlightIrr', 'قیمت فروش پرواز بزرگسال'],
  ['childFlightIrr', 'قیمت فروش پرواز کودک'],
] as const;
type Breakdown = Record<(typeof flightFields)[number][0], string> & {
  hotel: Record<(typeof hotelFields)[number][0], string>;
};
type Publication = {
  version: number;
  enabled: boolean;
  salesStopped: boolean;
  presentation: {
    title: string;
    description: string;
    commissionPercent: string;
    previewOnly?: boolean;
    previewHotelRate?: {
      checkIn: string;
      checkOut: string;
      amountIrr: string;
      breakdown?: Breakdown;
    };
  } | null;
};
export function WebsiteTourPreviewPrices({
  departureId,
  branchId,
  canEdit,
}: {
  departureId: string;
  branchId: string;
  canEdit: boolean;
}) {
  const [publication, setPublication] = useState<Publication | null>(null);
  const [draft, setDraft] = useState<Breakdown>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const endpoint = `${getPublicApiBaseUrl()}/sales/site-commerce/v1/nss/publications/tour/${encodeURIComponent(departureId)}`;
  const readUrl = `${endpoint}?${new URLSearchParams({ branchId })}`;
  const presentation = publication?.presentation;
  const rate = presentation?.previewHotelRate;

  useEffect(() => {
    const controller = new AbortController();
    void localizedFetch(readUrl, {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 403) return { data: null };
        if (!response.ok) throw Error();
        return (await response.json()) as { data: Publication | null };
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        setPublication(result.data);
        setDraft(result.data?.presentation?.previewHotelRate?.breakdown);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('وضعیت انتشار سایت دریافت نشد.');
      });
    return () => controller.abort();
  }, [readUrl]);

  const valid =
    draft &&
    [
      ...flightFields.map(([key]) => draft[key]),
      ...hotelFields.map(([key]) => draft.hotel[key]),
    ].every((value) => /^[1-9]\d{0,14}$/.test(value));
  const dirty = JSON.stringify(draft) !== JSON.stringify(rate?.breakdown);

  async function save() {
    if (
      !publication ||
      !presentation?.previewOnly ||
      !rate ||
      !draft ||
      !valid ||
      !dirty ||
      !canEdit ||
      saving
    )
      return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const response = await localizedFetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-nora-site-commerce': '1',
        },
        body: JSON.stringify({
          branchId,
          enabled: publication.enabled,
          salesStopped: publication.salesStopped,
          version: publication.version,
          presentation: {
            ...presentation,
            previewHotelRate: { ...rate, breakdown: draft },
          },
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error?.message ?? body?.message;
        throw Error(
          typeof message === 'string'
            ? message
            : 'ثبت انتشار سایت ناموفق بود؛ وضعیت را دوباره دریافت کنید.',
        );
      }
      const result = (await response.json()) as { data: Publication };
      setPublication(result.data);
      setSaved(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'ثبت ناموفق بود.');
    } finally {
      setSaving(false);
    }
  }

  if (!presentation?.previewOnly || !rate || !draft)
    return error ? <p role="alert">{error}</p> : null;

  return (
    <Card className="space-y-4 p-5">
      <h2 className="text-lg font-black">قیمت نمایشی تور در سایت نیایش سیر</h2>
      <p className="text-sm text-muted-foreground">
        <span dir="ltr">
          {rate.checkIn} — {rate.checkOut}
        </span>
        {' · '}ریال
      </p>
      {publication?.enabled && <p>نمایش در سایت؛ فروش متوقف است</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {flightFields.map(([key, label]) => (
          <label key={key}>
            {label}
            <Input
              dir="ltr"
              inputMode="numeric"
              maxLength={15}
              value={draft[key]}
              readOnly={!canEdit || saving}
              onChange={(event) =>
                setDraft({ ...draft, [key]: event.target.value })
              }
            />
          </label>
        ))}
        {hotelFields.map(([key, label]) => (
          <label key={key}>
            {label}
            <Input
              dir="ltr"
              inputMode="numeric"
              maxLength={15}
              value={draft.hotel[key]}
              readOnly={!canEdit || saving}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  hotel: { ...draft.hotel, [key]: event.target.value },
                })
              }
            />
          </label>
        ))}
      </div>
      {canEdit && (
        <Button
          type="button"
          disabled={!valid || !dirty || saving}
          onClick={() => void save()}
        >
          {saving ? 'در حال ثبت…' : 'ذخیره و به‌روزرسانی قیمت سایت'}
        </Button>
      )}
      {saved && <p role="status">قیمت نمایشی ذخیره شد.</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </Card>
  );
}
