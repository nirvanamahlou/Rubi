'use client';

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

interface MasterDataFormProps {
  definition: MasterDataCatalogItem;
  mode: MasterDataFormMode;
  onOpenChange: (open: boolean) => void;
  onValidatedBlocked: (message: string) => void;
  open: boolean;
}

const modeLabels: Record<MasterDataFormMode, string> = {
  create: 'ایجاد',
  view: 'مشاهده',
  edit: 'ویرایش',
};

function initialValues(
  definition: MasterDataCatalogItem,
  mode: MasterDataFormMode,
) {
  if (mode === 'create') {
    return Object.fromEntries(
      definition.fields.map((field) => [field.key, '']),
    );
  }
  return Object.fromEntries(
    definition.fields.map((field) => [
      field.key,
      definition.preview[field.key] ?? '',
    ]),
  );
}

export function MasterDataForm({
  definition,
  mode,
  onOpenChange,
  onValidatedBlocked,
  open,
}: MasterDataFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(definition, mode),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const readonly = mode === 'view';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readonly) return;

    const result = validateMasterDataDraft(definition.key, values);
    setErrors(result.errors);
    if (!result.success) return;

    onValidatedBlocked(
      `اعتبارسنجی فرم ${definition.singularLabel} پاس شد؛ ذخیره‌سازی تا آزادشدن Migration Lock مسدود است.`,
    );
  }

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerContent className="w-[min(94vw,34rem)] p-6">
        <DialogTitle>
          {modeLabels[mode]} {definition.singularLabel}
        </DialogTitle>
        <DialogDescription>
          {readonly
            ? 'نمای فقط‌خواندنی نمونه طراحی؛ این رکورد در Database وجود ندارد.'
            : 'Validation فعال است، اما submit هیچ داده‌ای را ذخیره نمی‌کند.'}
        </DialogDescription>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>Contract: master-data.v1-draft</Badge>
          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300">
            Blocked by Migration Lock
          </Badge>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          {definition.fields.map((field) => {
            const error = errors[field.key];
            const helpId = `${definition.key}-${field.key}-help`;
            const errorId = `${definition.key}-${field.key}-error`;
            const isCanonical =
              field.key.toLowerCase().includes('code') ||
              field.key.toLowerCase().endsWith('id');
            return (
              <FormField
                {...(field.hint ? { description: field.hint } : {})}
                {...(error ? { error } : {})}
                {...(field.required ? { required: true } : {})}
                id={`${definition.key}-${field.key}`}
                key={field.key}
                label={field.label}
              >
                <Input
                  aria-describedby={
                    error ? errorId : field.hint ? helpId : undefined
                  }
                  aria-invalid={Boolean(error)}
                  disabled={readonly}
                  dir={isCanonical ? 'ltr' : undefined}
                  id={`${definition.key}-${field.key}`}
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
            <Alert
              description={errors.form}
              title="فرم معتبر نیست"
              tone="error"
            />
          ) : null}

          {!readonly ? (
            <Alert
              description="در این مرحله هیچ POST/PATCH یا persistence محلی اجرا نمی‌شود."
              title="عملیات ذخیره مسدود است"
              tone="warning"
            />
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-5">
            <DrawerClose asChild>
              <Button type="button" variant="ghost">
                بستن
              </Button>
            </DrawerClose>
            {!readonly ? <Button type="submit">اعتبارسنجی فرم</Button> : null}
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
