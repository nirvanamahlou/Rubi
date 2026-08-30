'use client';

import type { MasterDataRecord } from '@rubi/contracts';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import {
  DialogDescription,
  DialogTitle,
  Dialog,
  DialogClose,
  DialogContent,
} from '@/components/ui/overlays';
import { Alert, Badge } from '@/components/ui/surfaces';
import type { MasterDataCatalogItem } from '../model/catalog';
import { getMasterDataFormFields } from '../model/form-fields';
import { validateMasterDataDraft } from '../model/validation';
import { getReferenceFieldConfig } from '../model/reference-fields';
import { MasterDataClearableField } from './master-data-clearable-field';
import {
  MasterDataReferenceSelector,
  OrganizationRoleSelector,
} from './master-data-reference-selector';

export type MasterDataFormMode = 'create' | 'view' | 'edit';

function valuesFrom(
  definition: MasterDataCatalogItem,
  record?: MasterDataRecord,
): Record<string, string> {
  if (!record)
    return Object.fromEntries(
      getMasterDataFormFields(definition).map((field) => [field.key, '']),
    );
  const [fromCurrencyCode = '', toCurrencyCode = ''] = record.code.split('/');
  return Object.fromEntries(
    getMasterDataFormFields(definition).map((field) => {
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
      return [
        field.key,
        value === null || value === undefined ? '' : String(value),
      ];
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
        form:
          error instanceof Error ? error.message : 'ذخیره اطلاعات ناموفق بود.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        {...(!readonly ? { 'aria-describedby': undefined } : {})}
        className="start-auto left-1/2 max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto p-6"
      >
        <DialogTitle>
          {mode === 'create' ? 'ایجاد' : mode === 'edit' ? 'ویرایش' : 'مشاهده'}{' '}
          {definition.singularLabel}
        </DialogTitle>
        {readonly ? (
          <DialogDescription>
            جزئیات رکورد پایدار و فقط‌خواندنی است.
          </DialogDescription>
        ) : null}
        {record ? (
          <div className="mt-4 flex gap-2">
            <Badge>نسخه {record.version.toLocaleString('fa-IR')}</Badge>
          </div>
        ) : null}

        <form
          className="mt-6 space-y-5"
          onSubmit={(event) => void submit(event)}
        >
          {getMasterDataFormFields(definition).map((field) => {
            const error = errors[field.key];
            const controlId = `live-${definition.key}-${field.key}`;
            const reference = getReferenceFieldConfig(
              definition.key,
              field.key,
            );
            const updateValue = (value: string) =>
              setValues((current) => ({ ...current, [field.key]: value }));
            const control = reference ? (
              <MasterDataReferenceSelector
                config={reference}
                disabled={readonly || saving}
                id={controlId}
                label={field.label}
                onChange={updateValue}
                value={values[field.key] ?? ''}
              />
            ) : field.key === 'roleCodes' ? (
              <OrganizationRoleSelector
                disabled={readonly || saving}
                id={controlId}
                onChange={updateValue}
                value={values[field.key] ?? ''}
              />
            ) : field.type === 'select' ? (
              <Select
                disabled={readonly || saving}
                onValueChange={updateValue}
                value={values[field.key] ?? ''}
              >
                <SelectTrigger aria-invalid={Boolean(error)} id={controlId}>
                  <SelectValue placeholder="انتخاب کنید" />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.type === 'datetime-local' ? (
              <DatePicker
                aria-invalid={Boolean(error)}
                disabled={readonly || saving}
                id={controlId}
                includeTime
                onChange={updateValue}
                placeholder={field.placeholder}
                readOnly={readonly}
                value={values[field.key] ?? ''}
              />
            ) : (
              <Input
                aria-invalid={Boolean(error)}
                disabled={readonly || saving}
                dir={
                  field.key.toLowerCase().includes('code') ? 'ltr' : undefined
                }
                id={controlId}
                inputMode={field.type === 'number' ? 'decimal' : undefined}
                onChange={(event) => updateValue(event.target.value)}
                placeholder={field.placeholder}
                readOnly={readonly}
                step={field.type === 'number' ? 'any' : undefined}
                type={field.type}
                value={values[field.key] ?? ''}
              />
            );
            return (
              <FormField
                {...(field.hint ? { description: field.hint } : {})}
                {...(error ? { error } : {})}
                {...(field.required ? { required: true } : {})}
                id={controlId}
                key={field.key}
                label={field.label}
              >
                {!reference &&
                (field.type === 'select' || field.type === 'datetime-local') ? (
                  <MasterDataClearableField
                    controlId={controlId}
                    label={field.label}
                    value={values[field.key] ?? ''}
                    onClear={() => updateValue('')}
                    disabled={readonly || saving}
                  >
                    {control}
                  </MasterDataClearableField>
                ) : (
                  control
                )}
              </FormField>
            );
          })}
          {errors.form ? (
            <Alert
              description={errors.form}
              title="ذخیره انجام نشد"
              tone="error"
            />
          ) : null}
          <div className="flex justify-end gap-2 border-t border-border pt-5">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                بستن
              </Button>
            </DialogClose>
            {!readonly ? (
              <Button loading={saving} type="submit">
                ذخیره
              </Button>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
