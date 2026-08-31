'use client';

import type {
  MasterDataListQuery,
  MasterDataRecord,
  MasterHotelImportDuplicateBehavior,
  MasterHotelImportPreview,
} from '@rubi/contracts';
import { FileCheck2, FileSpreadsheet, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-controls';
import { Alert, Badge, Card } from '@/components/ui/surfaces';
import { masterDataApi } from '../api/client';
import { MasterDataClearableField } from './master-data-clearable-field';

const lookupQuery: MasterDataListQuery = {
  search: '',
  status: 'active',
  sortBy: 'name',
  sortDirection: 'asc',
  page: 1,
  pageSize: 100,
};
async function loadAll(resource: 'countries' | 'cities') {
  const first = await masterDataApi.list(resource, lookupQuery);
  const records = [...first.data];
  const pages = Math.ceil(first.meta.total / lookupQuery.pageSize);
  for (let page = 2; page <= pages; page += 1) {
    const response = await masterDataApi.list(resource, {
      ...lookupQuery,
      page,
    });
    records.push(...response.data);
  }
  return records;
}

export function HotelImportPanel({ onImported }: { onImported: () => void }) {
  const [countries, setCountries] = useState<readonly MasterDataRecord[]>([]);
  const [cities, setCities] = useState<readonly MasterDataRecord[]>([]);
  const [countryId, setCountryId] = useState('');
  const [cityId, setCityId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MasterHotelImportPreview | null>(null);
  const [duplicateBehavior, setDuplicateBehavior] = useState<
    MasterHotelImportDuplicateBehavior | ''
  >('SKIP');
  const [createMissingReferences, setCreateMissingReferences] = useState(true);
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([loadAll('countries'), loadAll('cities')])
      .then(([countryRecords, cityRecords]) => {
        setCountries(countryRecords);
        setCities(cityRecords);
      })
      .catch((error: unknown) =>
        setMessage(
          error instanceof Error
            ? error.message
            : 'دریافت فهرست کشور و شهر ناموفق بود.',
        ),
      );
  }, []);

  const scopedCities = cities.filter(
    (city) => city.attributes.countryId === countryId,
  );

  async function makePreview() {
    if (!file || !countryId || !cityId) {
      setMessage('کشور، شهر و فایل اکسل را کامل انتخاب کنید.');
      return;
    }
    setBusy('preview');
    setMessage(null);
    setPreview(null);
    try {
      const response = await masterDataApi.previewHotelImport({
        file,
        countryId,
        cityId,
      });
      setPreview(response.data);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'پیش‌نمایش فایل ناموفق بود.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    if (!preview || preview.issues.length > 0) return;
    if (!duplicateBehavior) {
      setMessage('رفتار با کد سیستمی تکراری را انتخاب کنید.');
      return;
    }
    setBusy('commit');
    setMessage(null);
    try {
      const response = await masterDataApi.commitHotelImport(
        preview.sessionId,
        {
          previewToken: preview.previewToken,
          idempotencyKey: crypto.randomUUID(),
          duplicateBehavior,
          createMissingReferences,
        },
      );
      const counts = response.data.counts;
      setMessage(
        `ثبت کامل شد: ${counts.created} هتل جدید، ${counts.updated} به‌روزرسانی و ${counts.skipped} مورد رد شد.`,
      );
      setPreview(null);
      setFile(null);
      onImported();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'ثبت نهایی هتل‌ها ناموفق بود.',
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-5 border-sky-200 bg-sky-50/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-sky-700" />
            <h2 className="font-bold text-slate-900">
              افزودن گروهی هتل از اکسل
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            قالب مورد پذیرش دقیقاً HOTEL_IMPORT_V1 با همان ۱۸ ستون فایل بدروم
            است.
          </p>
        </div>
        <Badge>HOTEL_IMPORT_V1</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <FormField id="hotel-import-country" label="کشور" required>
          <MasterDataClearableField
            controlId="hotel-import-country"
            label="کشور"
            value={countryId}
            disabled={busy !== null}
            onClear={() => {
              setCountryId('');
              setCityId('');
              setPreview(null);
            }}
          >
            <select
              id="hotel-import-country"
              disabled={busy !== null}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
              value={countryId}
              onChange={(event) => {
                setCountryId(event.target.value);
                setCityId('');
                setPreview(null);
              }}
            >
              <option value="">انتخاب کشور</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </MasterDataClearableField>
        </FormField>
        <FormField id="hotel-import-city" label="شهر" required>
          <MasterDataClearableField
            controlId="hotel-import-city"
            label="شهر"
            value={cityId}
            disabled={busy !== null || !countryId}
            onClear={() => {
              setCityId('');
              setPreview(null);
            }}
          >
            <select
              id="hotel-import-city"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
              value={cityId}
              disabled={busy !== null || !countryId}
              onChange={(event) => {
                setCityId(event.target.value);
                setPreview(null);
              }}
            >
              <option value="">انتخاب شهر</option>
              {scopedCities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </MasterDataClearableField>
        </FormField>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          فایل اکسل
          <input
            className="block h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
            }}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => void makePreview()}
          disabled={busy !== null}
        >
          <Upload className="size-4" />
          {busy === 'preview' ? 'در حال بررسی…' : 'بررسی و پیش‌نمایش'}
        </Button>
        {file ? (
          <span className="text-xs text-slate-600">{file.name}</span>
        ) : null}
      </div>

      {message ? <Alert title="نتیجه عملیات">{message}</Alert> : null}

      {preview ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-3">
              <div className="text-xs text-slate-500">ردیف‌های فایل</div>
              <div className="text-xl font-bold">{preview.counts.rows}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-slate-500">خطای مانع ثبت</div>
              <div className="text-xl font-bold text-rose-700">
                {preview.counts.invalid}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-slate-500">کد تکراری</div>
              <div className="text-xl font-bold text-amber-700">
                {preview.counts.duplicates}
              </div>
            </Card>
          </div>

          {preview.security.malwareScanStatus === 'UNAVAILABLE' ? (
            <Alert title="کنترل امنیتی فایل">
              کنترل ساختار ZIP، امضا، فرمول، لینک خارجی و ماکرو انجام شده است؛
              سرویس آنتی‌ویروس مستقل هنوز متصل نیست.
            </Alert>
          ) : null}

          {preview.issues.length > 0 ? (
            <Alert title="خطاهای مانع ثبت">
              {preview.issues.slice(0, 5).map((issue) => (
                <div key={`${issue.rowNumber}-${issue.code}`}>
                  ردیف {issue.rowNumber ?? '—'}: {issue.message}
                </div>
              ))}
            </Alert>
          ) : (
            <Alert title="آماده ثبت">
              <span className="inline-flex items-center gap-2">
                <FileCheck2 className="size-4 text-emerald-700" />
                فایل برای ثبت اتمیک آماده است؛ یا همه ردیف‌ها ثبت می‌شوند یا
                هیچ‌کدام.
              </span>
            </Alert>
          )}

          <div className="max-h-72 overflow-auto rounded-md border bg-white">
            <table className="w-full text-right text-sm">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  <th className="p-2">ردیف</th>
                  <th className="p-2">کد سیستمی</th>
                  <th className="p-2">نام هتل</th>
                  <th className="p-2">ستاره</th>
                  <th className="p-2">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber} className="border-t">
                    <td className="p-2">{row.rowNumber}</td>
                    <td className="p-2 font-mono text-xs">{row.code}</td>
                    <td className="p-2">{row.englishName}</td>
                    <td className="p-2">{row.starRating ?? '—'}</td>
                    <td className="p-2">{row.duplicate ? 'تکراری' : 'جدید'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <FormField
              id="hotel-import-duplicates"
              label="رفتار با کد سیستمی تکراری"
              required
            >
              <MasterDataClearableField
                controlId="hotel-import-duplicates"
                label="رفتار با کد سیستمی تکراری"
                value={duplicateBehavior}
                disabled={busy !== null}
                onClear={() => setDuplicateBehavior('')}
              >
                <select
                  id="hotel-import-duplicates"
                  disabled={busy !== null}
                  className="mr-2 h-9 rounded-md border bg-white px-2"
                  value={duplicateBehavior}
                  onChange={(event) =>
                    setDuplicateBehavior(
                      event.target.value as MasterHotelImportDuplicateBehavior,
                    )
                  }
                >
                  <option value="">انتخاب کنید</option>
                  <option value="SKIP">رد کردن تکراری‌ها</option>
                  <option value="UPDATE">به‌روزرسانی تکراری‌ها</option>
                </select>
              </MasterDataClearableField>
            </FormField>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={createMissingReferences}
                onChange={(event) =>
                  setCreateMissingReferences(event.target.checked)
                }
              />
              ساخت نوع خدمات، نوع اتاق و امکاناتِ موجود در فایل
            </label>
            <Button
              type="button"
              onClick={() => void commit()}
              disabled={
                busy !== null || preview.issues.length > 0 || !duplicateBehavior
              }
            >
              {busy === 'commit' ? 'در حال ثبت…' : 'ثبت نهایی هتل‌ها'}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
