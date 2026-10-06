'use client';
import { useState } from 'react';
import {
  occupancyImportRows,
  readOccupancyXlsx,
  type ImportedOccupancy,
} from './occupancy-import';
import { OccupancyImportPreview } from './occupancy-import-preview';
import { registerOccupancyBatch } from './occupancy-bulk-register';
import { planOccupancyBatch, reviewOccupancyBatch } from './occupancy-bulk';

export function OccupancyBulkPanel({
  branchId,
  countryId,
  cityId,
  actorId,
  permissions,
  disabled,
  onBusy,
  onSaved,
}: {
  branchId: string;
  countryId: string;
  cityId: string;
  actorId: string;
  permissions: readonly string[];
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    rows: ImportedOccupancy[];
    issues: string[];
    excluded: number;
    ignoredRoomCount: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [brokerName, setBrokerName] = useState('کارگزار آنتالیا ۱');
  const [createBroker, setCreateBroker] = useState(false);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [planReady, setPlanReady] = useState(false);
  function lock(value: boolean) {
    setBusy(value);
    onBusy(value);
  }
  async function read() {
    if (!file || busy || disabled) return;
    lock(true);
    setError('');
    setMessage('در حال خواندن فایل…');
    setPreview(null);
    setDone(false);
    setSkipInvalid(false);
    setPlanReady(false);
    try {
      const parsed = occupancyImportRows(await readOccupancyXlsx(file));
      const review = reviewOccupancyBatch(parsed.rows);
      setPreview({
        rows: review.rows,
        issues: [...parsed.issues, ...review.issues],
        excluded: parsed.excluded,
        ignoredRoomCount: review.ignoredRoomCount,
      });
      const plan = planOccupancyBatch(review.rows);
      setPlanReady(true);
      setMessage(
        `${plan.hotelNames.size.toLocaleString('fa-IR')} هتل و ${plan.priceCount.toLocaleString('fa-IR')} قیمت آماده ثبت است؛ ${review.overriddenRooms.toLocaleString('fa-IR')} ردیف ROOM در بخش هم‌پوشان با قیمت ترکیب مشخص کنار گذاشته شد. تاریخ و نوع اتاق از فایل ثبت می‌شود. هنوز ثبت نشده است.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خواندن فایل ناموفق بود.');
      setMessage('');
    } finally {
      lock(false);
    }
  }
  async function save() {
    if (
      !preview ||
      !planReady ||
      busy ||
      disabled ||
      done ||
      (preview.issues.length > 0 && !skipInvalid)
    )
      return;
    lock(true);
    setError('');
    try {
      const result = await registerOccupancyBatch({
        rows: preview.rows,
        branchId,
        countryId,
        cityId,
        actorId,
        brokerName,
        createBroker,
        permissions,
        onProgress: setMessage,
        onSaved,
      });
      setDone(true);
      setMessage(
        `${result.hotels.toLocaleString('fa-IR')} هتل، ${result.prices.toLocaleString('fa-IR')} قیمت بررسی شد: ${result.created} بسته جدید، ${result.updated} بسته به‌روزرسانی و ${result.unchanged} بسته بدون تغییر. از بخش بسته‌های موجود پایین صفحه قابل مشاهده و ویرایش است.${preview.issues.length ? ` ${preview.issues.length} ردیف خطادار ثبت نشد.` : ''}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت ناموفق بود.');
    } finally {
      lock(false);
    }
  }
  return (
    <section
      className="space-y-4 rounded-xl border p-5"
      aria-label="ثبت گروهی فایل نرخ هتل"
    >
      <h2 className="font-bold">ورودی اکسل — ثبت همه هتل‌ها و نرخ‌ها</h2>
      <p>
        کشور و شهر را بالا انتخاب کنید. قیمت کل اتاق در هر شب، ترکیب نفرات، بورد
        و همه تاریخ‌ها از اکسل خوانده می‌شود؛ انتخاب تک‌هتل یا انتقال به
        پیش‌نویس لازم نیست.
      </p>
      <p>
        اکسل جدیدِ همین شهر و کارگزار، قیمت ترکیب‌های موجود در همان بازه و ارز
        را به‌روزرسانی می‌کند. بازه‌های جدید اضافه می‌شوند؛ هتل‌ها، اتاق‌ها و
        نرخ‌هایی که در فایل جدید نیستند حذف نمی‌شوند.
      </p>
      <label className="block">
        فایل خروجی نورا
        <input
          className="block w-full rounded border p-3"
          type="file"
          accept=".xlsx"
          disabled={disabled || busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
            setPlanReady(false);
            setDone(false);
            setError('');
            setMessage('');
          }}
        />
      </label>
      <button
        className="rounded bg-primary px-4 py-3 text-primary-foreground disabled:opacity-50"
        type="button"
        disabled={disabled || busy || !file}
        onClick={() => void read()}
      >
        دیدن پیش‌نمایش اکسل
      </button>
      {preview && (
        <>
          <OccupancyImportPreview {...preview} />
          <label className="block">
            کارگزار کل فایل
            <input
              className="mt-2 block w-full rounded border p-3"
              value={brokerName}
              disabled={disabled || busy || done}
              onChange={(e) => setBrokerName(e.target.value)}
            />
          </label>
          <label className="block">
            <input
              type="checkbox"
              checked={createBroker}
              disabled={disabled || busy || done}
              onChange={(e) => setCreateBroker(e.target.checked)}
            />{' '}
            اگر این کارگزار موجود نیست، با همین نام در اطلاعات پایه
            تأمین‌کنندگان ایجاد شود.
          </label>
          <p>
            هتل و نوع اتاقِ موجود نبود، در مقصد انتخاب‌شده ایجاد و متصل می‌شود.
            نام‌های مبهم یا موارد غیرفعال خودکار تغییر نمی‌کنند. ثبت در چند بسته
            انجام می‌شود؛ در خطا، ثبت‌های موفق باقی می‌مانند.
          </p>
          {preview.issues.length > 0 && (
            <label className="block text-amber-700">
              <input
                type="checkbox"
                checked={skipInvalid}
                disabled={disabled || busy || done}
                onChange={(e) => setSkipInvalid(e.target.checked)}
              />{' '}
              تأیید می‌کنم فقط ردیف‌های سالم ثبت شوند و{' '}
              {preview.issues.length.toLocaleString('fa-IR')} ردیف خطادار کنار
              گذاشته شود.
            </label>
          )}
          <button
            type="button"
            className="rounded bg-primary px-5 py-3 text-primary-foreground disabled:opacity-50"
            disabled={
              disabled ||
              busy ||
              done ||
              !preview.rows.length ||
              !planReady ||
              (preview.issues.length > 0 && !skipInvalid)
            }
            onClick={() => void save()}
          >
            {busy
              ? 'در حال ثبت…'
              : done
                ? 'ثبت کامل شد'
                : 'ثبت همه هتل‌ها و نرخ‌ها'}
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
