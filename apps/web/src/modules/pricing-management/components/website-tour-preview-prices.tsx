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
type HotelRates = Record<(typeof hotelFields)[number][0], string>;
type Breakdown = Record<(typeof flightFields)[number][0], string> & {
  hotel: HotelRates;
  hotels?: Record<string, HotelRates>;
};
type PreviewHotel = { id: string; name: string };
const emptyRates: HotelRates = {
  double: '',
  single: '',
  childWithBed: '',
  extra: '',
};
const emptyBreakdown: Breakdown = {
  adultFlightIrr: '',
  childFlightIrr: '',
  hotel: emptyRates,
};
type PublicationResult = {
  data: Publication | null;
  previewHotels?: PreviewHotel[];
};

function hotelDraft(breakdown: Breakdown, hotels: PreviewHotel[]) {
  return Object.fromEntries(
    hotels.map(({ id }) => [
      id,
      breakdown.hotels
        ? (breakdown.hotels[id] ?? {
            double: '',
            single: '',
            childWithBed: '',
            extra: '',
          })
        : breakdown.hotel,
    ]),
  );
}
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
  site = 'nss',
  travelDates,
}: {
  departureId: string;
  branchId: string;
  canEdit: boolean;
  site?: 'nss' | 'ghestiroo';
  travelDates?: { checkIn: string; checkOut: string };
}) {
  const [publication, setPublication] = useState<Publication | null>(null);
  const [hotels, setHotels] = useState<PreviewHotel[]>([]);
  const [draft, setDraft] = useState<Breakdown>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const endpoint =
    getPublicApiBaseUrl() +
    '/sales/site-commerce/v1/' +
    site +
    '/publications/tour/' +
    encodeURIComponent(departureId);
  const readUrl = `${endpoint}?${new URLSearchParams({ branchId })}`;
  const presentation = publication?.presentation;
  const rate = presentation?.previewHotelRate;
  const dates = rate ?? (site === 'ghestiroo' ? travelDates : undefined);

  useEffect(() => {
    const controller = new AbortController();
    void localizedFetch(readUrl, {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 403) return { data: null } as PublicationResult;
        if (!response.ok) throw Error();
        return (await response.json()) as PublicationResult;
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        setPublication(result.data);
        const options = result.previewHotels ?? [];
        const breakdown =
          result.data?.presentation?.previewHotelRate?.breakdown;
        setHotels(options);
        const initial =
          breakdown ?? (site === 'ghestiroo' ? emptyBreakdown : undefined);
        setDraft(
          initial && { ...initial, hotels: hotelDraft(initial, options) },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('وضعیت انتشار سایت دریافت نشد.');
      });
    return () => controller.abort();
  }, [readUrl, site]);

  const valid =
    draft &&
    hotels.length > 0 &&
    [
      ...flightFields.map(([key]) => draft[key]),
      ...hotels.flatMap(({ id }) =>
        hotelFields.map(([key]) => draft.hotels?.[id]?.[key] ?? ''),
      ),
    ].every((value) => /^[1-9]\d{0,14}$/.test(value));
  const savedBreakdown = rate?.breakdown;
  const dirty =
    JSON.stringify(draft) !==
    JSON.stringify(
      savedBreakdown && {
        ...savedBreakdown,
        hotels: hotelDraft(savedBreakdown, hotels),
      },
    );

  async function save() {
    if (
      !publication ||
      !presentation?.previewOnly ||
      !dates ||
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
            previewHotelRate: {
              checkIn: dates.checkIn,
              checkOut: dates.checkOut,
              amountIrr:
                rate?.amountIrr ?? draft.hotels![hotels[0]!.id]!.double,
              breakdown: rate
                ? draft
                : {
                    ...draft,
                    hotel: draft.hotels?.[hotels[0]!.id] ?? draft.hotel,
                  },
            },
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

  if (!presentation?.previewOnly || !dates || !draft)
    return error ? <p role="alert">{error}</p> : null;

  return (
    <Card className="space-y-4 p-5">
      <h2 className="text-lg font-black">
        قیمت نمایشی تور در سایت {site === 'ghestiroo' ? 'قسطی‌رو' : 'نیایش سیر'}
      </h2>
      <p className="text-sm text-muted-foreground">
        <span dir="ltr">
          {dates.checkIn} — {dates.checkOut}
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
      </div>
      {hotels.map(({ id, name }) => {
        const prices = draft.hotels?.[id];
        if (!prices) return null;
        return (
          <fieldset
            key={id}
            className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <legend className="px-2 font-bold">{name}</legend>
            {hotelFields.map(([key, label]) => (
              <label key={key}>
                {label}
                <Input
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={15}
                  value={prices[key]}
                  readOnly={!canEdit || saving}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      hotels: {
                        ...draft.hotels,
                        [id]: { ...prices, [key]: event.target.value },
                      },
                    })
                  }
                />
              </label>
            ))}
          </fieldset>
        );
      })}
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
