'use client';

import type { MasterDataRecord } from '@rubi/contracts';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import {
  DialogDescription,
  DialogTitle,
  Drawer,
  DrawerClose,
  DrawerContent,
} from '@/components/ui/overlays';
import { Alert, Badge } from '@/components/ui/surfaces';
import type { MasterDataCatalogItem } from '../model/catalog';
import { validateMasterDataDraft } from '../model/validation';

export type MasterDataFormMode = 'create' | 'view' | 'edit';

function valuesFrom(
  definition: MasterDataCatalogItem,
  record?: MasterDataRecord,
): Record<string, string> {
  if (!record)
    return Object.fromEntries(definition.fields.map((field) => [field.key, '']));
  const [fromCurrencyCode = '', toCurrencyCode = ''] = record.code.split('/');
  return Object.fromEntries(
    definition.fields.map((field) => {
      const value =
        field.key === 'code'
          ? record.code
          : field.key === 'name' || field.key === 'displayName'
            ? record.name
            : field.key === 'fromCurrencyCode'
              ? fromCurrencyCode
              : field.key === 'toCurrencyCode'
                ? toCurrencyCode
                : record.attributes[field.key];
      return [field.key, value === null || value === undefined ? '' : String(value)];
    }),
  );
}

export function MasterDataLiveForm({
  definition,
  mode,
  onOpenChange,
  onPersist,
  open,
  record,
}: {
  definition: MasterDataCatalogItem;
  mode: MasterDataFormMode;
  onOpenChange: (open: boolean) => void;
  onPersist: (values: Record<string, string>) => Promise<void>;
  open: boolean;
  record?: MasterDataRecord;
}) {
  const [values, setValues] = useState(() => valuesFrom(definition, record));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const readonly = mode === 'view';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readonly) return;
    const result = validateMasterDataDraft(definition.key, values);
    setErrors(result.errors);
    if (!result.success) return;
    setSaving(true);
    try {
      await onPersist(result.values);
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : 'ذخیره اطلاعات ناموفق بود.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerContent className="w-[min(94vw,34rem)] overflow-y-auto p-6">
        <DialogTitle>
          {mode === 'create' ? 'ایجاد' : mode === 'edit' ? 'ویرایش' : 'مشاهده'}{' '}
          {definition.singularLabel}
        </DialogTitle>
        <DialogDescription>
          {readonly
            ? 'جزئیات رکورد پایدار و فقط‌خواندنی است.'
            : 'اطلاعات پس از اعتبارسنجی در Backend ثبت و Audit می‌شود.'}
        </DialogDescription>
        <div className="mt-4 flex gap-2">
          <Badge>master-data.v1</Badge>
          {record ? <Badge>نسخه {record.version.toLocaleString('fa-IR')}</Badge> : null}
        </div>

        <form className="mt-6 space-y-5" onSubmit={(event) => void submit(event)}>
          {definition.fields.map((field) => {
            const error = errors[field.key];
            const canonical =
              field.key.toLowerCase().includes('code') ||
              field.key.toLowerCase().endsWith('id');
            return (
              <FormField
                {...(field.hint ? { description: field.hint } : {})}
                {...(error ? { error } : {})}
                {...(field.required ? { required: true } : {})}
                id={`live-${definition.key}-${field.key}`}
                key={field.key}
                label={field.label}
              >
                <Input
                  aria-invalid={Boolean(error)}
                  disabled={readonly || saving}
                  dir={canonical ? 'ltr' : undefined}
                  id={`live-${definition.key}-${field.key}`}
                  inputMode={field.type === 'number' ? 'decimal' : undefined}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                  readOnly={readonly}
                  step={field.type === 'number' ? 'any' : undefined}
                  type={field.type}
                  value={values[field.key] ?? ''}
                />
              </FormField>
            );
          })}
          {errors.form ? (
            <Alert description={errors.form} title="ذخیره انجام نشد" tone="error" />
          ) : null}
          <div className="flex justify-end gap-2 border-t border-border pt-5">
            <DrawerClose asChild>
              <Button type="button" variant="ghost">بستن</Button>
            </DrawerClose>
            {!readonly ? (
              <Button loading={saving} type="submit">ذخیره</Button>
            ) : null}
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
