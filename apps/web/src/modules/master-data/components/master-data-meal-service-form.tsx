'use client';

import type { MasterDataRecord } from '@rubi/contracts';
import { useRef, useState, type FormEvent } from 'react';
import { Save, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import { Alert } from '@/components/ui/surfaces';
import {
  MasterDataClearableField,
  MasterDataClearSelection,
} from './master-data-clearable-field';
import { MasterDataProfileDialog } from './master-data-profile-dialog';
import { MasterDataNumberInput } from './master-data-number-input';
import {
  includedMealOptions,
  mealServiceCodes,
  mealServiceFormValues,
  mealServiceMutationValues,
  mealServiceStatuses,
  parseIncludedMeals,
  validateMealServiceForm,
} from '../model/meal-service-form';

export function MasterDataMealServiceForm({
  record,
  mode,
  onOpenChange,
  onPersist,
}: {
  record?: MasterDataRecord;
  mode: 'create' | 'edit' | 'view';
  onOpenChange: (open: boolean) => void;
  onPersist: (values: Record<string, string>) => Promise<void>;
}) {
  const [values, setValues] = useState(() => mealServiceFormValues(record));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const disabled = mode === 'view' || saving;
  const meals = parseIncludedMeals(values.includedMeals ?? '[]');
  // Existing custom/legacy values stay visible and selected; no silent replacement.
  const originalMeals = parseIncludedMeals(
    mealServiceFormValues(record).includedMeals ?? '[]',
  );
  const options = [
    ...new Set<string>([...includedMealOptions, ...originalMeals, ...meals]),
  ];
  const change = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || pending.current) return;
    const result = validateMealServiceForm(values);
    setErrors(result.errors);
    if (!result.success) return;
    pending.current = true;
    setSaving(true);
    try {
      await onPersist(mealServiceMutationValues(result.values, record));
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : 'ذخیره انجام نشد.',
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
        mode === 'view'
          ? 'مشخصات وعده و سرویس'
          : mode === 'edit'
            ? 'ویرایش وعده و سرویس'
            : 'ایجاد وعده و سرویس'
      }
      description="مشخصات و وعده‌های شامل‌شده"
      onOpenChange={(open) => {
        if (!pending.current) onOpenChange(open);
      }}
    >
      <form
        className="space-y-5"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ['code', 'کد سرویس'],
              ['name', 'عنوان فارسی'],
              ['englishName', 'عنوان انگلیسی'],
            ] as const
          ).map(([key, label]) => (
            <FormField
              key={key}
              id={`meal-${key}`}
              label={label}
              required={key !== 'englishName'}
              {...(errors[key] ? { error: errors[key] } : {})}
            >
              <Input
                id={`meal-${key}`}
                value={values[key] ?? ''}
                disabled={disabled}
                required={key !== 'englishName'}
                maxLength={key === 'code' ? 32 : 160}
                dir={key === 'name' ? 'rtl' : 'ltr'}
                list={key === 'code' ? 'meal-standard-codes' : undefined}
                aria-invalid={Boolean(errors[key])}
                aria-describedby={errors[key] ? `meal-${key}-error` : undefined}
                onChange={(event) =>
                  change(
                    key,
                    key === 'code'
                      ? event.target.value.toUpperCase()
                      : event.target.value,
                  )
                }
              />
            </FormField>
          ))}
          <datalist id="meal-standard-codes">
            {mealServiceCodes.map((code) => (
              <option key={code} value={code} />
            ))}
          </datalist>
          {(
            [
              {
                key: 'category',
                label: 'دسته',
                options: [
                  { value: 'MEAL_PLAN', label: 'Meal Plan' },
                  { value: 'SERVICE', label: 'Service' },
                ],
              },
              { key: 'status', label: 'وضعیت', options: mealServiceStatuses },
            ] as const
          ).map(({ key, label, options: choices }) => (
            <FormField
              key={key}
              id={`meal-${key}`}
              label={label}
              required
              {...(errors[key] ? { error: errors[key] } : {})}
            >
              <MasterDataClearableField
                controlId={`meal-${key}`}
                label={label}
                value={values[key] ?? ''}
                disabled={disabled}
                onClear={() => change(key, '')}
              >
                <Select
                  value={values[key] ?? ''}
                  disabled={disabled}
                  onValueChange={(value) => change(key, value)}
                  required
                >
                  <SelectTrigger
                    id={`meal-${key}`}
                    aria-invalid={Boolean(errors[key])}
                    aria-describedby={
                      errors[key] ? `meal-${key}-error` : undefined
                    }
                  >
                    <SelectValue placeholder="انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {choices.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </MasterDataClearableField>
            </FormField>
          ))}
          <FormField id="meal-hotelCount" label="تعداد هتل مرتبط">
            <Input
              id="meal-hotelCount"
              readOnly
              value={
                record
                  ? Number(record.attributes.hotelCount ?? 0).toLocaleString(
                      'fa-IR',
                    )
                  : 'پس از ثبت محاسبه می‌شود'
              }
            />
          </FormField>
          <FormField
            id="meal-displayOrder"
            label="ترتیب نمایش"
            {...(errors.displayOrder ? { error: errors.displayOrder } : {})}
          >
            <MasterDataNumberInput
              id="meal-displayOrder"
              disabled={disabled}
              value={values.displayOrder ?? '0'}
              onChange={(value) => change('displayOrder', value)}
            />
          </FormField>
        </div>
        <fieldset
          id="meal-includedMeals"
          tabIndex={-1}
          disabled={disabled}
          className="rounded-2xl border border-border p-4"
          aria-describedby={
            errors.includedMeals
              ? 'meal-includedMeals-error'
              : 'meal-includedMeals-hint'
          }
        >
          <legend className="px-2 font-semibold">
            <UtensilsCrossed
              aria-hidden="true"
              className="me-2 inline size-4"
            />
            وعده‌های شامل‌شده
          </legend>
          <div className="flex items-center justify-between gap-3 pb-3">
            <p
              id="meal-includedMeals-hint"
              className="text-sm text-muted-foreground"
            >
              چند مورد قابل انتخاب است؛ برای «فقط اتاق» انتخاب را خالی بگذارید.
            </p>
            <MasterDataClearSelection
              controlId="meal-includedMeals"
              label="وعده‌های شامل‌شده"
              value={meals.join(',')}
              disabled={disabled}
              onClear={() => change('includedMeals', '[]')}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {options.map((meal) => (
              <label
                key={meal}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/5"
              >
                <input
                  type="checkbox"
                  checked={meals.includes(meal)}
                  disabled={disabled}
                  className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
                  onChange={(event) =>
                    change(
                      'includedMeals',
                      JSON.stringify(
                        event.target.checked
                          ? [...meals, meal]
                          : meals.filter((value) => value !== meal),
                      ),
                    )
                  }
                />
                {meal}
              </label>
            ))}
          </div>
          {errors.includedMeals ? (
            <p
              role="alert"
              id="meal-includedMeals-error"
              className="mt-2 text-sm text-destructive"
            >
              {errors.includedMeals}
            </p>
          ) : null}
        </fieldset>
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
            بستن
          </Button>
          {mode !== 'view' ? (
            <Button type="submit" loading={saving}>
              <Save aria-hidden="true" className="size-4" />
              ذخیره وعده و سرویس
            </Button>
          ) : null}
        </div>
      </form>
    </MasterDataProfileDialog>
  );
}
