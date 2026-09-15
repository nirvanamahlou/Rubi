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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const readonly = mode === 'view';
  const disabled = readonly || saving;
  const hasSavedFile = Boolean(initialValue(record, 'fileReferenceId'));

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
