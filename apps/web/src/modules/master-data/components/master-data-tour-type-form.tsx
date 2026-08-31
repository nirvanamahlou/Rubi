'use client';

import type { MasterDataRecord } from '@rubi/contracts';
import { Save } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import {
  FormField,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import { Alert } from '@/components/ui/surfaces';
import {
  tourTypeFormValues,
  tourTypeMutationValues,
  tourTypeScopes,
  tourTypeUpdatedLabel,
  tourTypeUsageLabel,
  validateTourTypeForm,
} from '../model/tour-type-form';
import { MasterDataClearableField } from './master-data-clearable-field';
import { MasterDataProfileDialog } from './master-data-profile-dialog';

export function MasterDataTourTypeForm({
  record,
  actorNames = {},
  onOpenChange,
  onPersist,
}: {
  record?: MasterDataRecord;
  actorNames?: Readonly<Record<string, string>>;
  onOpenChange: (open: boolean) => void;
  onPersist: (values: Record<string, string>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    tourTypeFormValues(record),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const change = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;
    const result = validateTourTypeForm(values);
    setErrors(result.errors);
    if (!result.success) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onPersist(tourTypeMutationValues(result.values, record));
    } catch (error) {
      setErrors({
        form:
          error instanceof Error ? error.message : 'ذخیره نوع تور ناموفق بود.',
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <MasterDataProfileDialog
      open
      title={record ? 'ویرایش نوع تور' : 'ایجاد نوع تور'}
      description="تعریف عنوان، دامنه و مشخصات نوع تور"
      onOpenChange={(open) => {
        if (!savingRef.current) onOpenChange(open);
      }}
    >
      <form
        onSubmit={(event) => void submit(event)}
        noValidate
        className="space-y-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="tour-code" label="کد">
            <Input
              id="tour-code"
              readOnly
              dir={record ? 'ltr' : 'rtl'}
              value={record?.code ?? 'پس از ثبت، خودکار تولید می‌شود'}
            />
          </FormField>
          {(
            [
              ['name', 'عنوان فارسی', 160],
              ['englishName', 'عنوان انگلیسی', 160],
            ] as const
          ).map(([key, label, maxLength]) => (
            <FormField
              key={key}
              id={`tour-${key}`}
              label={label}
              {...(key === 'name' ? { required: true } : {})}
              {...(errors[key] ? { error: errors[key] } : {})}
            >
              <Input
                id={`tour-${key}`}
                value={values[key] ?? ''}
                maxLength={maxLength}
                required={key === 'name'}
                dir={key === 'englishName' ? 'ltr' : 'rtl'}
                disabled={saving}
                aria-invalid={Boolean(errors[key])}
                aria-describedby={errors[key] ? `tour-${key}-error` : undefined}
                onChange={(event) => change(key, event.target.value)}
              />
            </FormField>
          ))}
          {(
            [
              { key: 'scope', label: 'دامنه', options: tourTypeScopes },
              {
                key: 'status',
                label: 'وضعیت',
                options: [
                  { value: 'active', label: 'فعال' },
                  { value: 'inactive', label: 'غیرفعال' },
                ],
              },
            ] as const
          ).map(({ key, label, options }) => (
            <FormField
              key={key}
              id={`tour-${key}`}
              label={label}
              required
              {...(errors[key] ? { error: errors[key] } : {})}
            >
              <MasterDataClearableField
                controlId={`tour-${key}`}
                label={label}
                value={values[key] ?? ''}
                onClear={() => change(key, '')}
                disabled={saving}
              >
                <Select
                  required
                  value={values[key] ?? ''}
                  onValueChange={(value) => change(key, value)}
                  disabled={saving}
                >
                  <SelectTrigger
                    id={`tour-${key}`}
                    aria-invalid={Boolean(errors[key])}
                    aria-describedby={
                      errors[key] ? `tour-${key}-error` : undefined
                    }
                  >
                    <SelectValue placeholder="انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </MasterDataClearableField>
            </FormField>
          ))}
          <FormField
            id="tour-displayOrder"
            label="ترتیب نمایش"
            {...(errors.displayOrder ? { error: errors.displayOrder } : {})}
          >
            <Input
              id="tour-displayOrder"
              type="number"
              min={0}
              max={2147483647}
              step={1}
              value={values.displayOrder ?? ''}
              disabled={saving}
              aria-invalid={Boolean(errors.displayOrder)}
              aria-describedby={
                errors.displayOrder ? 'tour-displayOrder-error' : undefined
              }
              onChange={(event) => change('displayOrder', event.target.value)}
            />
          </FormField>
          <div className="sm:col-span-2">
            <FormField
              id="tour-description"
              label="شرح"
              {...(errors.description ? { error: errors.description } : {})}
            >
              <Textarea
                id="tour-description"
                value={values.description ?? ''}
                maxLength={1000}
                disabled={saving}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={
                  errors.description ? 'tour-description-error' : undefined
                }
                onChange={(event) => change('description', event.target.value)}
              />
            </FormField>
          </div>
          <FormField
            id="tour-usage"
            label="استفاده"
            description="این مقدار از محصولات مصرف‌کننده دریافت می‌شود و قابل ورود دستی نیست."
          >
            <Input
              id="tour-usage"
              readOnly
              value={tourTypeUsageLabel(record)}
              aria-describedby="tour-usage-help"
            />
          </FormField>
          <FormField id="tour-updated" label="آخرین تغییر">
            <Textarea
              id="tour-updated"
              readOnly
              value={tourTypeUpdatedLabel(record, actorNames)}
            />
          </FormField>
        </div>
        {errors.form ? (
          <Alert
            title="ذخیره انجام نشد"
            description={errors.form}
            tone="error"
          />
        ) : null}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            انصراف
          </Button>
          <Button type="submit" loading={saving}>
            <Save aria-hidden="true" className="size-4" />
            ذخیره نوع تور
          </Button>
        </div>
      </form>
    </MasterDataProfileDialog>
  );
}
