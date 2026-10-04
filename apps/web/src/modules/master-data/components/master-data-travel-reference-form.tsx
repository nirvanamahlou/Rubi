'use client';

import type { MasterDataRecord } from '@nora/contracts';
import { Plus, Save, X } from 'lucide-react';
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
import { getMasterDataDefinition } from '../model/catalog';
import { getReferenceFieldConfig } from '../model/reference-fields';
import {
  travelReferenceFieldLimit,
  travelReferenceFormValues,
  travelReferenceMutationValues,
  normalizeRequiredDocumentNames,
  requiredDocumentNames,
  type TravelReferenceMutationValue,
  transferUsageLabel,
  validateTravelReferenceForm,
  type TravelReferenceResource,
} from '../model/travel-reference-form';
import { MasterDataClearableField } from './master-data-clearable-field';
import { MasterDataProfileDialog } from './master-data-profile-dialog';
import { MasterDataReferenceSelector } from './master-data-reference-selector';

export function MasterDataTravelReferenceForm({
  resource,
  record,
  onOpenChange,
  onPersist,
}: {
  resource: TravelReferenceResource;
  record?: MasterDataRecord;
  onOpenChange: (open: boolean) => void;
  onPersist: (
    values: Record<string, TravelReferenceMutationValue>,
  ) => Promise<void>;
}) {
  const definition = getMasterDataDefinition(resource);
  const [values, setValues] = useState(() =>
    travelReferenceFormValues(resource, record),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [documentName, setDocumentName] = useState('');
  const savingRef = useRef(false);
  const change = (key: string, value: string) =>
    setValues((current) => ({
      ...current,
      [key]: value,
      ...(key === 'referenceValidityMode' && value === 'PASSPORT_EXPIRY'
        ? { referenceValidityDays: '' }
        : {}),
    }));
  const documents = requiredDocumentNames(values.requiredDocumentNames);
  const addDocument = () => {
    const next = normalizeRequiredDocumentNames([...documents, documentName]);
    if (!documentName.trim()) return;
    if (documentName.trim().length > 160 || next.length > 50) {
      setErrors((current) => ({
        ...current,
        requiredDocumentNames: 'حداکثر ۵۰ نام تا ۱۶۰ نویسه مجاز است.',
      }));
      return;
    }
    change('requiredDocumentNames', JSON.stringify(next));
    setDocumentName('');
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors.requiredDocumentNames;
      return nextErrors;
    });
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;
    const result = validateTravelReferenceForm(resource, values);
    setErrors(result.errors);
    if (!result.success) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onPersist(
        travelReferenceMutationValues(resource, result.values, record),
      );
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : 'ذخیره خدمت ناموفق بود.',
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  return (
    <MasterDataProfileDialog
      open
      title={`${record ? 'ویرایش' : 'ایجاد'} ${definition.singularLabel}`}
      onOpenChange={(open) => {
        if (!savingRef.current) onOpenChange(open);
      }}
    >
      <form
        noValidate
        className="space-y-5"
        onSubmit={(event) => void submit(event)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id={`${resource}-code`} label="کد">
            <Input
              id={`${resource}-code`}
              readOnly
              dir={record ? 'ltr' : 'rtl'}
              value={record?.code ?? 'پس از ثبت، خودکار تولید می‌شود'}
            />
          </FormField>
          {definition.fields.map((field) => {
            if (
              field.key === 'referenceValidityDays' &&
              values.referenceValidityMode === 'PASSPORT_EXPIRY'
            )
              return null;
            const id = `${resource}-${field.key}`;
            const reference = getReferenceFieldConfig(resource, field.key);
            const common = {
              id,
              disabled: saving,
              'aria-invalid': Boolean(errors[field.key]),
              'aria-describedby': errors[field.key]
                ? `${id}-error`
                : field.hint
                  ? `${id}-help`
                  : undefined,
            };
            return (
              <FormField
                key={field.key}
                id={id}
                label={field.key === 'name' ? 'عنوان فارسی' : field.label}
                {...(field.required ? { required: true } : {})}
                {...(errors[field.key] ? { error: errors[field.key] } : {})}
                {...(field.hint ? { description: field.hint } : {})}
              >
                {field.key === 'requiredDocumentNames' ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        {...common}
                        maxLength={160}
                        placeholder={field.placeholder}
                        value={documentName}
                        onChange={(event) =>
                          setDocumentName(event.target.value)
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={saving || !documentName.trim()}
                        onClick={addDocument}
                      >
                        <Plus className="size-4" aria-hidden="true" /> افزودن
                        مدرک
                      </Button>
                    </div>
                    {documents.length ? (
                      <ul
                        className="flex flex-wrap gap-2"
                        aria-label="مدارک مورد نیاز"
                      >
                        {documents.map((name) => (
                          <li
                            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-sm"
                            key={name}
                          >
                            <span>{name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={saving}
                              aria-label={`حذف ${name}`}
                              onClick={() =>
                                change(
                                  'requiredDocumentNames',
                                  JSON.stringify(
                                    documents.filter((item) => item !== name),
                                  ),
                                )
                              }
                            >
                              <X className="size-3.5" aria-hidden="true" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        مدرکی ثبت نشده است.
                      </p>
                    )}
                  </div>
                ) : reference ? (
                  <MasterDataReferenceSelector
                    config={reference}
                    id={id}
                    label={field.label}
                    disabled={saving}
                    value={values[field.key] ?? ''}
                    onChange={(value) => change(field.key, value)}
                  />
                ) : field.type === 'select' ? (
                  <MasterDataClearableField
                    controlId={id}
                    label={field.label}
                    value={values[field.key] ?? ''}
                    onClear={() => change(field.key, '')}
                    disabled={saving}
                  >
                    <Select
                      value={values[field.key] ?? ''}
                      onValueChange={(value) => change(field.key, value)}
                      disabled={saving}
                    >
                      <SelectTrigger {...common}>
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
                  </MasterDataClearableField>
                ) : field.key === 'description' ? (
                  <Textarea
                    {...common}
                    maxLength={1000}
                    value={values[field.key] ?? ''}
                    onChange={(event) => change(field.key, event.target.value)}
                  />
                ) : (
                  <Input
                    {...common}
                    type={field.type === 'number' ? 'number' : 'text'}
                    {...(field.type === 'number'
                      ? {
                          min: field.key === 'displayOrder' ? 0 : 1,
                          max:
                            field.key === 'displayOrder'
                              ? 2147483647
                              : field.key === 'referenceValidityDays'
                                ? 3650
                                : 100,
                          step: 1,
                        }
                      : { maxLength: travelReferenceFieldLimit(field.key) })}
                    placeholder={field.placeholder}
                    value={values[field.key] ?? ''}
                    onChange={(event) => change(field.key, event.target.value)}
                  />
                )}
              </FormField>
            );
          })}
          <FormField
            id={`${resource}-status`}
            label="وضعیت"
            required
            {...(errors.status ? { error: errors.status } : {})}
          >
            <MasterDataClearableField
              controlId={`${resource}-status`}
              label="وضعیت"
              value={values.status ?? ''}
              onClear={() => change('status', '')}
              disabled={saving}
            >
              <Select
                value={values.status ?? ''}
                onValueChange={(value) => change('status', value)}
                disabled={saving}
              >
                <SelectTrigger
                  id={`${resource}-status`}
                  aria-invalid={Boolean(errors.status)}
                  aria-describedby={
                    errors.status ? `${resource}-status-error` : undefined
                  }
                >
                  <SelectValue placeholder="انتخاب کنید" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">فعال</SelectItem>
                  <SelectItem value="inactive">غیرفعال</SelectItem>
                </SelectContent>
              </Select>
            </MasterDataClearableField>
          </FormField>
          {resource === 'transfer-types' ? (
            <FormField id="transfer-usage" label="استفاده">
              <Input
                id="transfer-usage"
                readOnly
                value={transferUsageLabel(record)}
              />
            </FormField>
          ) : null}
        </div>
        {errors.form ? (
          <Alert title="ذخیره نشد" description={errors.form} tone="error" />
        ) : null}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            انصراف
          </Button>
          <Button type="submit" loading={saving} disabled={saving}>
            <Save className="size-4" aria-hidden="true" />
            ذخیره
          </Button>
        </div>
      </form>
    </MasterDataProfileDialog>
  );
}
