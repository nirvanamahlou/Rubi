'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type {
  DocumentListItemV1,
  DocumentListResponseV1,
  DocumentOptionsResponseV1,
} from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import { documentsApi } from '@/modules/documents/api/client';
import {
  passengerFilesRequest,
  PassengerFilesError,
  type PassengersResponse,
} from './client';
function Pick({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: { id: string; name: string }[];
}) {
  return (
    <Select
      dir="rtl"
      value={'value:' + value}
      onValueChange={(v) => onChange(v.slice(6))}
    >
      <SelectTrigger aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.id} value={'value:' + item.id}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
const statusLabels: Record<string, string> = {
  CLEAN: 'بررسی امنیتی موفق',
  PENDING_SCAN: 'در انتظار بررسی امنیتی',
  AWAITING_ANTIVIRUS_ADAPTER: 'در انتظار سرویس بررسی امنیتی',
  QUARANTINED: 'قرنطینه',
  SCAN_FAILED: 'بررسی ناموفق',
  INFECTED: 'فایل آلوده',
};
export function ReservationFiles({ id }: { id: string }) {
  const [passengers, setPassengers] = useState<PassengersResponse['data']>([]);
  const [options, setOptions] = useState<DocumentOptionsResponseV1['data']>();
  const [canUpload, setCanUpload] = useState(false);
  const [passenger, setPassenger] = useState('');
  const [category, setCategory] = useState('');
  const [typeId, setTypeId] = useState('');
  const [expiry, setExpiry] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [items, setItems] = useState<readonly DocumentListItemV1[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const mounted = useRef(true);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    Promise.all([
      passengerFilesRequest<PassengersResponse>(id, 'passengers'),
      passengerFilesRequest<DocumentOptionsResponseV1 & { canUpload: boolean }>(
        id,
        'documents/options',
      ),
    ])
      .then(([people, result]) => {
        if (active) {
          setPassengers(people.data);
          setOptions(result.data);
          setCanUpload(result.canUpload);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [id]);
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({
      page: String(page),
      ...(passenger ? { passengerId: passenger } : {}),
      ...(category ? { categoryId: category } : {}),
    });
    void Promise.resolve().then(() => {
      if (active) setLoading(true);
    });
    passengerFilesRequest<DocumentListResponseV1>(id, 'documents?' + query)
      .then((result) => {
        if (active) {
          setItems(result.data);
          setPages(result.meta.totalPages);
          setListError('');
        }
      })
      .catch((e) => {
        if (active) {
          setItems([]);
          setListError(e.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, passenger, category, page, revision]);
  const types =
    options?.documentTypes.filter((t) =>
      ['TRAVEL', 'SALES', 'CUSTOMER_IDENTITY', 'GENERAL'].includes(t.domain),
    ) ?? [];
  const selectedType = types.find((t) => t.id === typeId);
  const clearFile = () => {
    setFile(null);
    setInputKey((n) => n + 1);
  };
  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!options || !selectedType || !file || busy || unknown) return;
    setError('');
    setNotice('');
    if (!category) {
      setError('دسته‌بندی مدرک را انتخاب کنید.');
      return;
    }
    if (
      file.size <= 0 ||
      file.size >
        Math.min(
          selectedType.maxFileSizeBytes,
          options.uploadPolicy.maxFileSizeBytes,
        ) ||
      !selectedType.allowedMimeTypes.includes(file.type)
    ) {
      setError('نوع یا حجم فایل برای مدرک انتخاب‌شده مجاز نیست.');
      return;
    }
    const form = new FormData();
    form.set('file', file);
    form.set('passengerId', passenger);
    form.set('categoryId', category);
    form.set('documentTypeId', selectedType.id);
    if (expiry) form.set('validUntil', expiry);
    setBusy(true);
    try {
      const result = await passengerFilesRequest<{ data: DocumentListItemV1 }>(
        id,
        'documents',
        { method: 'POST', body: form },
      );
      if (!mounted.current) return;
      clearFile();
      setNotice(
        'فایل در اسناد و پروندهٔ انتخاب‌شده ثبت شد؛ ' +
          (statusLabels[result.data.currentVersion.scanStatus] ??
            'در انتظار بررسی') +
          '.',
      );
      setPage(1);
      setRevision((n) => n + 1);
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : 'بارگذاری انجام نشد.');
      if (!(
        e instanceof PassengerFilesError &&
        e.status >= 400 &&
        e.status < 500 &&
        e.status !== 408
      ))
        setUnknown(true);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function download(item: DocumentListItemV1) {
    setError('');
    setBusy(true);
    try {
      const result = await documentsApi.download(
        item.id,
        'دریافت مدرک مسافر از پرونده قرارداد',
      );
      if (!mounted.current) return;
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.currentVersion.safeDownloadName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : 'دریافت فایل انجام نشد.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        پروندهٔ مسافر یا مدارک عمومی قرارداد را انتخاب کنید. فایل فقط یک‌بار در
        اسناد ذخیره می‌شود و همین‌جا قابل مشاهده است.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <fieldset
        disabled={busy || unknown}
        className="grid gap-3 sm:grid-cols-2"
      >
        <label className="space-y-1 text-sm">
          مسافر / پرونده مدارک
          <Pick
            label="مسافر / پرونده مدارک"
            value={passenger}
            onChange={(v) => {
              setPassenger(v);
              setPage(1);
              clearFile();
            }}
            items={[
              { id: '', name: 'مدارک عمومی قرارداد' },
              ...passengers.map((p) => ({ id: p.id, name: p.displayName })),
            ]}
          />
        </label>
        <label className="space-y-1 text-sm">
          دسته‌بندی
          <Pick
            label="دسته‌بندی مدرک"
            value={category}
            onChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
            items={[
              { id: '', name: 'همه دسته‌بندی‌ها / انتخاب برای بارگذاری' },
              ...(options?.categories ?? []),
            ]}
          />
        </label>
      </fieldset>
      {options && canUpload && (
        <form onSubmit={upload} className="space-y-3 rounded-xl border p-4">
          <fieldset disabled={busy || unknown} className="space-y-3">
            <h3 className="font-bold">بارگذاری مدرک جدید</h3>
            <label className="block space-y-1 text-sm">
              نوع مدرک
              <Pick
                label="نوع مدرک"
                value={typeId}
                onChange={(v) => {
                  setTypeId(v);
                  setExpiry('');
                  clearFile();
                }}
                items={[{ id: '', name: 'انتخاب نوع مدرک' }, ...types]}
              />
            </label>
            {selectedType && (
              <>
                <label className="block space-y-1 text-sm">
                  تاریخ انقضا{' '}
                  {selectedType.requiresExpiry ? '(الزامی)' : '(اختیاری)'}
                  <Input
                    type="date"
                    aria-label="تاریخ انقضای مدرک"
                    required={selectedType.requiresExpiry}
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  انتخاب فایل
                  <Input
                    key={inputKey}
                    aria-label="فایل مدرک"
                    type="file"
                    required
                    accept={selectedType.allowedMimeTypes.join(',')}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  حداکثر حجم:{' '}
                  {Math.floor(
                    Math.min(
                      selectedType.maxFileSizeBytes,
                      options.uploadPolicy.maxFileSizeBytes,
                    ) /
                      1024 /
                      1024,
                  )}{' '}
                  مگابایت. دریافت فایل تابع بررسی امنیتی و دسترسی اسناد است.
                </p>
              </>
            )}
            <Button
              type="submit"
              disabled={!selectedType || !category || !file}
            >
              {busy ? 'در حال بارگذاری…' : 'بارگذاری و ثبت مدرک'}
            </Button>
          </fieldset>
        </form>
      )}
      {options && !canUpload && (
        <p className="text-sm text-muted-foreground">
          دسترسی بارگذاری برای حساب شما فعال نیست.
        </p>
      )}
      {unknown && (
        <div className="space-y-2 rounded-xl border p-3">
          <p role="alert">
            نتیجه بارگذاری مشخص نیست؛ پیش از ارسال مجدد، فهرست را تازه کنید و
            وجود فایل را بررسی کنید.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setUnknown(false);
              clearFile();
              setRevision((n) => n + 1);
            }}
          >
            بررسی فهرست و پاک‌کردن فایل انتخاب‌شده
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h3 className="font-bold">مدارک پروندهٔ انتخاب‌شده</h3>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => setRevision((n) => n + 1)}
        >
          تازه‌سازی
        </Button>
      </div>
      {listError ? (
        <p role="alert" className="text-destructive">
          {listError}
        </p>
      ) : loading ? (
        <p>در حال دریافت مدارک…</p>
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="space-y-2 rounded-xl border p-3">
                <strong>{item.title}</strong>
                <p className="text-xs text-muted-foreground">
                  {item.type.name} · {item.category?.name ?? 'بدون دسته‌بندی'} ·{' '}
                  {statusLabels[item.currentVersion.scanStatus] ??
                    item.currentVersion.scanStatus}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      busy ||
                      !item.capabilities.download ||
                      item.requiresStepUpVerification
                    }
                    onClick={() => void download(item)}
                  >
                    دریافت فایل
                  </Button>
                  <Link
                    href={`/documents?document=${encodeURIComponent(item.id)}`}
                    className="text-sm underline"
                  >
                    مشاهده در اسناد
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {!items.length && (
            <p>برای مسافر و دسته‌بندی انتخاب‌شده مدرکی ثبت نشده است.</p>
          )}
          <div className="flex gap-3">
            <Button
              variant="outline"
              disabled={busy || page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              قبلی
            </Button>
            <span>
              صفحه {page} از {Math.max(1, pages)}
            </span>
            <Button
              variant="outline"
              disabled={busy || page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              بعدی
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
