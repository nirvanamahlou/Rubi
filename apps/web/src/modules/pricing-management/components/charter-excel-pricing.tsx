'use client';

import { useEffect, useState } from 'react';
import type {
  FloatingTourImportPreview,
  FloatingTourSaleRow,
  LoginResponse,
  TourDepartureV1,
} from '@nora/contracts';
import { Button, Card, Input } from '@/components/ui';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { packagePricingApi } from '../api/client';
import { FloatingPriceRows } from './floating-price-rows';

const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message.replace(/^Row (?=\d)/gm, 'ردیف ')
    : 'ورود قیمت فروش ناموفق بود.';

export function CharterExcelPricing({
  tour,
  session,
}: {
  tour: TourDepartureV1;
  session: LoginResponse;
}) {
  const [enabled, setEnabled] = useState(false);
  const [file, setFile] = useState<File>();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<FloatingTourImportPreview>();
  const [published, setPublished] = useState<{
    version: number;
    rows: FloatingTourSaleRow[];
  }>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canManage = session.user.permissions.includes(
    'package_pricing.period.manage',
  );

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void packagePricingApi.charterExcelPrices(tour.id, session).then(
      (value) => {
        if (active)
          setPublished((current) =>
            current && current.version > value.version ? current : value,
          );
      },
      (error: unknown) => {
        if (active) setError(errorText(error));
      },
    );
    return () => {
      active = false;
    };
  }, [enabled, session, tour.id]);

  async function submit(digest?: string) {
    if (!file || !canManage || busy || tour.remainingCapacity < 1) return;
    setBusy(true);
    setError('');
    try {
      const result = await packagePricingApi.charterExcelImport(
        tour.id,
        file,
        selections,
        session,
        digest,
      );
      if ('digest' in result) setPreview(result);
      else {
        setPublished(result);
        setPreview(undefined);
      }
    } catch (error) {
      setError(errorText(error));
      setPreview(undefined);
    } finally {
      setBusy(false);
    }
  }

  const matches = preview?.hotelMatches ?? [];
  const apiBase = getPublicApiBaseUrl();
  return (
    <Card className="grid gap-4 p-5">
      <label className="flex items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        ورود با اکسل
      </label>
      {enabled && (
        <>
          <p className="text-sm text-muted-foreground">
            قالب قیمت فروش تور شناور را برای تاریخ همین نوبت تکمیل کنید. فروش با
            بلیت و ظرفیت همین نوبت چارتر انجام می‌شود.
          </p>
          <p className="flex flex-wrap gap-2 text-sm">
            <bdi>
              {tour.startsOn} – {tour.endsOn}
            </bdi>
            <span>ظرفیت {tour.remainingCapacity}</span>
            <span>
              رفت <bdi>{tour.outbound.serviceNumber}</bdi>
            </span>
            {tour.returning && (
              <span>
                برگشت <bdi>{tour.returning.serviceNumber}</bdi>
              </span>
            )}
          </p>
          {apiBase && (
            <a
              className="w-fit font-semibold text-primary underline"
              href={`${apiBase}/sales/pricing/tour-drafts/${encodeURIComponent(tour.id)}/charter-excel/template`}
            >
              دانلود قالب قیمت تور
            </a>
          )}
          {canManage && (
            <label className="grid gap-2 text-sm font-semibold">
              فایل قیمت فروش
              <Input
                type="file"
                accept=".xlsx"
                disabled={busy || tour.remainingCapacity < 1}
                onChange={(event) => {
                  setFile(event.target.files?.[0]);
                  setPreview(undefined);
                  setSelections({});
                  setError('');
                }}
              />
            </label>
          )}
          {error && (
            <p
              className="whitespace-pre-line text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
          {matches.map((match) => (
            <label key={match.key} className="grid gap-2 text-sm">
              <span>
                ردیف {match.row} · {match.name}
              </span>
              <NativeSearchSelect
                disabled={busy || !match.candidates.length}
                value={selections[match.key] ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelections((current) => ({
                    ...current,
                    [match.key]: value,
                  }));
                }}
              >
                <option value="">انتخاب هتل</option>
                {match.candidates.map((hotel) => (
                  <option key={hotel.id} value={hotel.id}>
                    {hotel.name}
                  </option>
                ))}
              </NativeSearchSelect>
            </label>
          ))}
          {canManage && (
            <Button
              className="w-fit"
              variant="outline"
              disabled={
                !file ||
                busy ||
                tour.remainingCapacity < 1 ||
                matches.some((match) => !selections[match.key])
              }
              onClick={() => void submit()}
            >
              پیش‌نمایش قیمت فروش
            </Button>
          )}
          {preview?.digest && (
            <>
              {!!preview.warnings?.length && (
                <ul className="list-disc space-y-1 ps-5 text-sm">
                  {preview.warnings.map((warning) => (
                    <li key={warning}>{warning.replace(/^Row /, 'ردیف ')}</li>
                  ))}
                </ul>
              )}
              <FloatingPriceRows rows={preview.rows} showSource exactMoney />
              <Button
                className="w-fit"
                disabled={busy || !canManage || tour.remainingCapacity < 1}
                onClick={() => void submit(preview.digest)}
              >
                ثبت نهایی قیمت فروش چارتر
              </Button>
            </>
          )}
          {!!published?.rows.length && (
            <>
              <h3 className="font-bold" role="status">
                قیمت فروش چارتر ثبت شد · نسخه {published.version}
              </h3>
              <FloatingPriceRows rows={published.rows} showSource exactMoney />
            </>
          )}
        </>
      )}
    </Card>
  );
}
