'use client';
import { useState } from 'react';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { masterDataApi } from '../api/client';

export function hotelImageUrls(value: string): string[] {
  return value
    .split('|')
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//i.test(url) || /^\/[^/]/.test(url));
}

export function HotelImageStrip({
  main,
  gallery,
  subject = 'هتل',
}: {
  main: string;
  gallery: string;
  subject?: string;
}) {
  const images = [
    ...hotelImageUrls(main).slice(0, 1),
    ...hotelImageUrls(gallery),
  ];
  if (!images.length)
    return (
      <p className="text-sm text-muted-foreground">
        {subject === 'هتل'
          ? 'هنوز عکسی برای هتل ثبت نشده است.'
          : 'هنوز عکسی ثبت نشده است.'}
      </p>
    );
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {images.map((value, index) => {
        const url =
          value.startsWith('/api/v1/master-data/hotel-images/') &&
          getPublicApiBaseUrl()
            ? getPublicApiBaseUrl() + value.slice('/api/v1'.length)
            : value;
        return (
          <a
            key={url + index}
            href={
              url.includes('/master-data/hotel-images/')
                ? `${url}?download=1`
                : url
            }
            download={`photo-${index + 1}.webp`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0"
            aria-label={`دانلود عکس ${index + 1} ${subject}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={
                index === 0 && main
                  ? `عکس اصلی ${subject}`
                  : `عکس گالری ${index + 1}`
              }
              className="h-24 w-32 rounded-lg border object-cover"
            />
          </a>
        );
      })}
    </div>
  );
}

export function HotelImageUpload({
  main,
  gallery,
  disabled,
  onChange,
  onBusy,
  idPrefix = 'live-hotels',
  subject = idPrefix === 'visa-services' ? 'ویزا' : 'هتل',
}: {
  main: string;
  gallery: string;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
  onBusy: (busy: boolean) => void;
  idPrefix?: string;
  subject?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const galleryUrls = hotelImageUrls(gallery);
  async function upload(files: File[], kind: 'main' | 'gallery') {
    if (!files.length) return;
    setError('');
    if (
      (kind === 'main' && files.length > 1) ||
      (kind === 'gallery' && galleryUrls.length + files.length > 6)
    ) {
      setError('گالری حداکثر ۶ عکس می‌پذیرد.');
      return;
    }
    if (files.some((file) => file.size > 10 * 1024 * 1024)) {
      setError('حجم هر عکس باید حداکثر ۱۰ مگابایت باشد.');
      return;
    }
    setBusy(true);
    onBusy(true);
    try {
      const urls = await masterDataApi.uploadHotelImages(files);
      onChange(
        kind === 'main' ? 'sourceMainImage' : 'sourceGalleryImages',
        kind === 'main' ? urls[0]! : [...galleryUrls, ...urls].join('|'),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'بارگذاری عکس انجام نشد.',
      );
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <div className="space-y-4 rounded-xl border p-3">
      <label className="grid gap-2 text-sm">
        عکس اصلی
        <input
          type="file"
          id={`${idPrefix}-sourceMainImage`}
          accept="image/png,image/jpeg,image/webp,.jfif"
          disabled={disabled || busy}
          onChange={(event) => {
            void upload(Array.from(event.target.files ?? []), 'main');
            event.target.value = '';
          }}
        />
      </label>
      {main && (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => onChange('sourceMainImage', '')}
          className="text-sm text-red-600"
        >
          حذف عکس اصلی
        </button>
      )}
      <label className="grid gap-2 text-sm">
        گالری · حداکثر ۶ عکس
        <input
          type="file"
          id={`${idPrefix}-sourceGalleryImages`}
          multiple
          accept="image/png,image/jpeg,image/webp,.jfif"
          disabled={disabled || busy || galleryUrls.length >= 6}
          onChange={(event) => {
            void upload(Array.from(event.target.files ?? []), 'gallery');
            event.target.value = '';
          }}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        عکس‌ها با فرمت WebP ذخیره می‌شوند. حداکثر حجم هر عکس ۱۰ مگابایت.
      </p>
      <HotelImageStrip main={main} gallery={gallery} subject={subject} />
      <div className="flex flex-wrap gap-2">
        {galleryUrls.map((url, index) => (
          <button
            key={url + index}
            type="button"
            disabled={disabled || busy}
            className="rounded border px-2 py-1 text-xs"
            onClick={() =>
              onChange(
                'sourceGalleryImages',
                galleryUrls.filter((_, i) => i !== index).join('|'),
              )
            }
          >
            حذف عکس گالری {index + 1}
          </button>
        ))}
      </div>
      {busy && <p role="status">در حال بارگذاری عکس‌ها…</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
