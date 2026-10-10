'use client';

import type { MasterDataRecord } from '@nora/contracts';
import { Save } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
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
import { masterDataApi } from '../api/client';
import {
  terminalFormValues,
  terminalHoursLabel,
  terminalHoursModes,
  terminalMutationValues,
  terminalStatuses,
  terminalTypes,
  terminalUpdatedLabel,
  validateTerminalForm,
} from '../model/terminal-form';
import { MasterDataClearableField } from './master-data-clearable-field';
import { MasterDataProfileDialog } from './master-data-profile-dialog';
import { MasterDataNumberInput } from './master-data-number-input';
import {
  MasterDataDetailItem,
  MasterDataDetailSection,
  MasterDataProfileIdentity,
} from './master-data-profile-details';

export function MasterDataTerminalForm({
  record,
  mode,
  actorNames = {},
  onOpenChange,
  onPersist,
  initialValues,
}: {
  record?: MasterDataRecord;
  mode: 'create' | 'edit' | 'view';
  actorNames?: Readonly<Record<string, string>>;
  onOpenChange: (open: boolean) => void;
  onPersist: (values: Record<string, string>) => Promise<void>;
  initialValues?: Record<string, string>;
  lockedFields?: readonly string[];
}) {
  const [values, setValues] = useState(() => ({
    ...terminalFormValues(record),
    ...initialValues,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const disabled = mode === 'view' || saving;
  const airportId = values.airportId ?? '';
  const [airport, setAirport] = useState<MasterDataRecord | null>(null);
  useEffect(() => {
    if (!airportId || record) return;
    let active = true;
    void masterDataApi
      .detail('airports', airportId)
      .then(({ data }) => {
        if (active) setAirport(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [airportId, record]);
  const cityName = String(
    record?.attributes.cityName ?? airport?.attributes.cityName ?? '—',
  );
  function change(key: string, value: string) {
    setValues((current) => ({
      ...current,
      [key]: value,
      ...(key === 'operatingHoursMode' && value !== 'TIME_RANGE'
        ? { opensAt: '', closesAt: '' }
        : {}),
    }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || savingRef.current) return;
    const result = validateTerminalForm(values);
    setErrors(result.errors);
    if (!result.success) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onPersist(terminalMutationValues(result.values, record));
    } catch (error) {
      setErrors({
        form:
          error instanceof Error ? error.message : 'ذخیره ترمینال ناموفق بود.',
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  return (
    <MasterDataProfileDialog
      open
      title={
        mode === 'view'
          ? 'مشخصات ترمینال'
          : mode === 'edit'
            ? 'ویرایش ترمینال'
            : 'ایجاد ترمینال'
      }
      onOpenChange={(open) => {
        if (!savingRef.current) onOpenChange(open);
      }}
    >
      {mode === 'view' ? (
        <div className="space-y-4">
          <MasterDataProfileIdentity
            eyebrow="پروفایل ترمینال"
            {...(record ? { record } : {})}
            title={record?.name ?? 'ترمینال'}
          />
          <MasterDataDetailSection title="مشخصات ترمینال">
            <MasterDataDetailItem label="کد" ltr value={record?.code} />
            <MasterDataDetailItem label="عنوان فارسی" value={values.name} />
            <MasterDataDetailItem
              label="عنوان انگلیسی"
              ltr
              value={values.englishName}
            />
            <MasterDataDetailItem label="شهر" value={cityName} />
            <MasterDataDetailItem
              label="نوع ترمینال"
              value={
                terminalTypes.find((item) => item.value === values.terminalType)
                  ?.label
              }
            />
            <MasterDataDetailItem
              label="ساعت فعالیت"
              value={record ? terminalHoursLabel(record) : undefined}
            />
            <MasterDataDetailItem
              label="ترتیب نمایش"
              value={values.displayOrder}
            />
            <MasterDataDetailItem
              label="وضعیت"
              value={
                terminalStatuses.find((item) => item.value === values.status)
                  ?.label
              }
            />
            <MasterDataDetailItem
              label="آخرین تغییر"
              value={terminalUpdatedLabel(record, actorNames)}
            />
          </MasterDataDetailSection>
          <div className="flex justify-end border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              بستن
            </Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event) => void submit(event)}
          noValidate
          className="space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="terminal-code" label="کد">
              <Input
                id="terminal-code"
                readOnly
                value={record?.code ?? 'پس از ثبت، خودکار تولید می‌شود'}
              />
            </FormField>
            {(
              [
                ['name', 'عنوان فارسی'],
                ['englishName', 'عنوان انگلیسی'],
              ] as const
            ).map(([key, label]) => (
              <FormField
                key={key}
                id={`terminal-${key}`}
                label={label}
                required={key === 'name'}
                {...(errors[key] ? { error: errors[key] } : {})}
              >
                <Input
                  id={`terminal-${key}`}
                  value={values[key] ?? ''}
                  disabled={disabled}
                  required={key === 'name'}
                  dir={key === 'name' ? 'rtl' : 'ltr'}
                  maxLength={160}
                  inputMode="text"
                  aria-invalid={Boolean(errors[key])}
                  aria-describedby={
                    errors[key] ? `terminal-${key}-error` : undefined
                  }
                  onChange={(event) => change(key, event.target.value)}
                />
              </FormField>
            ))}
            <FormField
              id="terminal-displayOrder"
              label="ترتیب نمایش"
              {...(errors.displayOrder ? { error: errors.displayOrder } : {})}
            >
              <MasterDataNumberInput
                id="terminal-displayOrder"
                disabled={disabled}
                value={values.displayOrder ?? '0'}
                onChange={(value) => change('displayOrder', value)}
              />
            </FormField>
            {(
              [
                {
                  key: 'terminalType',
                  label: 'نوع ترمینال',
                  options: terminalTypes,
                  required: true,
                },
                {
                  key: 'operatingHoursMode',
                  label: 'ساعت فعالیت',
                  options: terminalHoursModes,
                  required: false,
                },
                {
                  key: 'status',
                  label: 'وضعیت',
                  options: terminalStatuses,
                  required: true,
                },
              ] as const
            ).map(({ key, label, options, required }) => (
              <FormField
                key={key}
                id={`terminal-${key}`}
                label={label}
                required={required}
                {...(errors[key] ? { error: errors[key] } : {})}
              >
                <MasterDataClearableField
                  controlId={`terminal-${key}`}
                  label={label}
                  value={values[key] ?? ''}
                  onClear={() => change(key, '')}
                  disabled={disabled}
                >
                  <Select
                    value={values[key] ?? ''}
                    onValueChange={(value) => change(key, value)}
                    disabled={disabled}
                    required={required}
                  >
                    <SelectTrigger
                      id={`terminal-${key}`}
                      aria-invalid={Boolean(errors[key])}
                      aria-describedby={
                        errors[key] ? `terminal-${key}-error` : undefined
                      }
                    >
                      <SelectValue
                        placeholder={required ? 'انتخاب کنید' : 'تعیین نشده'}
                      />
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
            {values.operatingHoursMode === 'TIME_RANGE'
              ? (['opensAt', 'closesAt'] as const).map((key) => (
                  <FormField
                    key={key}
                    id={`terminal-${key}`}
                    label={key === 'opensAt' ? 'شروع فعالیت' : 'پایان فعالیت'}
                    required
                    {...(errors[key] ? { error: errors[key] } : {})}
                  >
                    <Input
                      id={`terminal-${key}`}
                      required
                      dir="ltr"
                      maxLength={5}
                      value={values[key] ?? ''}
                      placeholder={key === 'opensAt' ? '05:00' : '24:00'}
                      disabled={disabled}
                      aria-invalid={Boolean(errors[key])}
                      aria-describedby={
                        errors[key] ? `terminal-${key}-error` : undefined
                      }
                      onChange={(event) => change(key, event.target.value)}
                    />
                  </FormField>
                ))
              : null}
            <p className="text-xs leading-6 text-muted-foreground sm:col-span-2">
              ساعت فعالیت به وقت محلی فرودگاه است. پایان 24:00 یعنی انتهای روز؛
              پایان زودتر از شروع یعنی ادامه فعالیت تا روز بعد.
            </p>
            {(
              [
                ['city', 'شهر', cityName],
                [
                  'updated',
                  'آخرین تغییر',
                  terminalUpdatedLabel(record, actorNames),
                ],
              ] as const
            ).map(([key, label, value]) => (
              <FormField key={key} id={`terminal-${key}`} label={label}>
                <Input id={`terminal-${key}`} readOnly value={value} />
              </FormField>
            ))}
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
              ذخیره ترمینال
            </Button>
          </div>
        </form>
      )}
    </MasterDataProfileDialog>
  );
}
