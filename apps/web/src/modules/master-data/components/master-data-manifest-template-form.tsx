'use client';

import type { MasterDataRecord } from '@nora/contracts';
import { FileSpreadsheet, Save } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { Alert, Badge } from '@/components/ui/surfaces';
import type {
  MasterDataLogoChange,
  MasterDataManifestFileChange,
} from '../api/client';
import { masterDataApi } from '../api/client';
import { getReferenceFieldConfig } from '../model/reference-fields';
import { MasterDataProfileDialog } from './master-data-profile-dialog';
import { MasterDataReferenceSelector } from './master-data-reference-selector';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function initialValue(record: MasterDataRecord | undefined, key: string) {
  const value = record?.attributes[key];
  return value === null || value === undefined ? '' : String(value);
}

function templateName(file: File) {
  return file.name
    .replace(/\.xlsx$/i, '')
    .trim()
    .slice(0, 160);
}

export function MasterDataManifestTemplateForm({
  record,
  mode,
  onOpenChange,
  onPersist,
}: {
  record?: MasterDataRecord;
  mode: 'create' | 'edit' | 'view';
  onOpenChange: (open: boolean) => void;
  onPersist: (
    values: Record<string, string>,
    logoChange?: MasterDataLogoChange,
    manifestFileChange?: MasterDataManifestFileChange,
  ) => Promise<void>;
}) {
  const [airlineId, setAirlineId] = useState(() =>
    initialValue(record, 'airlineId'),
  );
  const [destinationCityId, setDestinationCityId] = useState(() =>
    initialValue(record, 'destinationCityId'),
  );
  const [file, setFile] = useState<File | null>(null);
  const [publicationStatus, setPublicationStatus] = useState(
    () => initialValue(record, 'publicationStatus') || 'DRAFT',
  );
  const [starterLoading, setStarterLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const readonly = mode === 'view';
  const disabled = readonly || saving;
  const hasSavedFile = Boolean(initialValue(record, 'fileReferenceId'));

  async function chooseStarter(kind: 'izmir' | 'sparta') {
    if (disabled || starterLoading) return;
    setStarterLoading(true);
    setErrors({});
    try {
      const response = await fetch(
        '/manifest-templates/iran-airtour-' + kind + '.xlsx',
      );
      if (!response.ok) throw new Error('فایل آمادهٔ قالب دریافت نشد.');
      const label = kind === 'izmir' ? 'قالب ازمیر' : 'قالب اسپارتا';
      setFile(
        new File([await response.blob()], label + '.xlsx', {
          type: XLSX_MIME,
        }),
      );
      setPublicationStatus('DRAFT');
      const destination = kind === 'izmir' ? 'ازمیر' : 'آنتالیا';
      const query = {
        status: 'active' as const,
        sortBy: 'name' as const,
        sortDirection: 'asc' as const,
        page: 1,
        pageSize: 100,
      };
      const [airlines, cities] = await Promise.all([
        masterDataApi.list('airlines', { ...query, search: 'ایران ایرتور' }),
        masterDataApi.list('cities', { ...query, search: destination }),
      ]);
      const airline = airlines.data.find((row) =>
        /ایران.?ایرتور|AIRTOUR/i.test(
          row.name + ' ' + String(row.attributes.englishName || ''),
        ),
      );
      const city = cities.data.find((row) => row.name.includes(destination));
      if (airline) setAirlineId(airline.id);
      if (city) setDestinationCityId(city.id);
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : 'دریافت قالب آماده انجام نشد.',
      });
    } finally {
      setStarterLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || pending.current) return;
    const nextErrors: Record<string, string> = {};
    if (!airlineId) nextErrors.airlineId = 'انتخاب ایرلاین الزامی است.';
    if (!destinationCityId)
      nextErrors.destinationCityId = 'انتخاب مقصد الزامی است.';
    if (!file && !hasSavedFile)
      nextErrors.file = 'انتخاب فایل XLSX قالب الزامی است.';
    if (file && (file.type !== XLSX_MIME || !/\.xlsx$/i.test(file.name)))
      nextErrors.file = 'فقط فایل Excel با پسوند XLSX پذیرفته می‌شود.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    pending.current = true;
    setSaving(true);
    try {
      await onPersist(
        {
          airlineId,
          destinationCityId,
          name: file ? templateName(file) : (record?.name ?? 'قالب منیفست'),
          displayOrder: initialValue(record, 'displayOrder') || '0',
          publicationStatus: file ? 'DRAFT' : publicationStatus,
        },
        undefined,
        file ? { kind: 'replace', file } : undefined,
      );
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : 'ذخیره قالب انجام نشد.',
      });
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <MasterDataProfileDialog
      open
      title={
        readonly
          ? 'مشخصات قالب منیفست'
          : mode === 'edit'
            ? 'ویرایش قالب منیفست'
            : 'ایجاد قالب منیفست از Excel'
      }
      description="فایل Excel را انتخاب کنید؛ نام، نسخه، فرمت و وضعیت پیش‌نویس به‌صورت خودکار ثبت می‌شوند."
      onOpenChange={(open) => {
        if (!pending.current) onOpenChange(open);
      }}
    >
      <form
        className="space-y-5"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        {record ? (
          <div className="flex flex-wrap gap-2">
            <Badge>
              نسخه قالب {initialValue(record, 'versionNumber') || '—'}
            </Badge>
            <Badge>
              {initialValue(record, 'publicationStatus') || 'DRAFT'}
            </Badge>
          </div>
        ) : null}
        {!readonly ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3">
            <span className="w-full text-sm font-semibold">
              قالب‌های آمادهٔ ایران ایرتور
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={starterLoading || saving}
              onClick={() => void chooseStarter('izmir')}
            >
              قالب ازمیر
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={starterLoading || saving}
              onClick={() => void chooseStarter('sparta')}
            >
              قالب اسپارتا
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              فایل‌های آماده بدون اطلاعات مسافر هستند. ایرلاین و مقصد را پیش از
              ذخیره بررسی کنید.
            </p>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="manifest-airlineId"
            label="ایرلاین"
            required
            {...(errors.airlineId ? { error: errors.airlineId } : {})}
          >
            {readonly ? (
              <Input
                id="manifest-airlineId"
                readOnly
                value={initialValue(record, 'airlineName') || '—'}
              />
            ) : (
              <MasterDataReferenceSelector
                config={getReferenceFieldConfig(
                  'manifest-templates',
                  'airlineId',
                )!}
                disabled={disabled}
                id="manifest-airlineId"
                label="ایرلاین"
                onChange={setAirlineId}
                required
                value={airlineId}
                closeOnSelect
              />
            )}
          </FormField>
          <FormField
            id="manifest-destinationCityId"
            label="مقصد (شهر)"
            required
            {...(errors.destinationCityId
              ? { error: errors.destinationCityId }
              : {})}
          >
            {readonly ? (
              <Input
                id="manifest-destinationCityId"
                readOnly
                value={initialValue(record, 'destinationCityName') || '—'}
              />
            ) : (
              <MasterDataReferenceSelector
                config={getReferenceFieldConfig(
                  'manifest-templates',
                  'destinationCityId',
                )!}
                disabled={disabled}
                id="manifest-destinationCityId"
                label="مقصد"
                onChange={setDestinationCityId}
                required
                value={destinationCityId}
                closeOnSelect
              />
            )}
          </FormField>
        </div>
        <FormField
          id="manifest-file"
          label="فایل قالب Excel"
          required={!hasSavedFile}
          description={
            hasSavedFile
              ? 'فایل فعلی در اسناد ثبت شده است؛ برای جایگزینی، فایل جدید انتخاب کنید.'
              : 'فایل اصلی بدون تغییر در اسناد و با نوع MANIFEST ذخیره می‌شود.'
          }
          {...(errors.file ? { error: errors.file } : {})}
        >
          {readonly ? (
            <Input
              id="manifest-file"
              readOnly
              value={hasSavedFile ? 'فایل XLSX ثبت شده' : 'فایل ثبت نشده'}
            />
          ) : (
            <Input
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-invalid={Boolean(errors.file)}
              disabled={saving}
              id="manifest-file"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                setErrors((current) => ({ ...current, file: '' }));
              }}
              required={!hasSavedFile}
              type="file"
            />
          )}
        </FormField>
        {file ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
            <FileSpreadsheet
              aria-hidden="true"
              className="size-4 text-primary"
            />
            <span dir="ltr">{file.name}</span>
          </div>
        ) : null}
        {mode === 'edit' && hasSavedFile && !readonly ? (
          <FormField id="manifest-publication-status" label="وضعیت انتشار">
            <select
              id="manifest-publication-status"
              className="h-10 w-full rounded-md border border-input bg-background px-3"
              disabled={saving || Boolean(file)}
              value={publicationStatus}
              onChange={(event) => setPublicationStatus(event.target.value)}
            >
              <option value="DRAFT">پیش‌نویس</option>
              <option value="ACTIVE">فعال برای بلیط‌های جدید</option>
            </select>
          </FormField>
        ) : null}
        {errors.form ? (
          <Alert
            title="ذخیره انجام نشد"
            description={errors.form}
            tone="error"
          />
        ) : null}
        <div className="flex justify-end gap-3 border-t border-border pt-5">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            بستن
          </Button>
          {!readonly ? (
            <Button type="submit" loading={saving}>
              <Save aria-hidden="true" className="size-4" />
              ذخیره قالب
            </Button>
          ) : null}
        </div>
      </form>
    </MasterDataProfileDialog>
  );
}
