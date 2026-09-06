'use client';

import {
  isMasterTransportFormResource,
  type MasterDataRecord,
} from '@rubi/contracts';
import { MasterDataTransportMetadata } from './master-data-transport-metadata';
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
import {
  getMasterDataDefinition,
  type MasterDataCatalogItem,
} from '../model/catalog';
import { masterDataApi, type MasterDataLogoChange } from '../api/client';
import { getMasterDataFormFields } from '../model/form-fields';
import { validateMasterDataDraft } from '../model/validation';
import { getReferenceFieldConfig } from '../model/reference-fields';
import { MasterDataClearableField } from './master-data-clearable-field';
import { MasterDataLogoUpload } from './master-data-logo-upload';
import { MasterDataMealServiceForm } from './master-data-meal-service-form';
import { MasterDataNumberInput } from './master-data-number-input';
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
      getMasterDataFormFields(definition).map((field) => [
        field.key,
        field.key === 'displayOrder'
          ? '0'
          : field.key === 'collaborationStatus' ||
              field.key === 'transportStatus'
            ? 'ACTIVE'
            : field.key === 'referenceValidityMode'
              ? 'DAYS'
              : '',
      ]),
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
                : field.key === 'airlineCodes'
                  ? [record.code, record.attributes.icaoCode]
                      .filter(Boolean)
                      .join(' / ')
                  : field.key === 'manufacturerModel'
                    ? [record.attributes.manufacturer, record.attributes.model]
                        .filter(Boolean)
                        .join(' / ')
                    : field.key === 'transportStatus'
                      ? (record.attributes.transportStatus ??
                        (record.status === 'active' ? 'ACTIVE' : 'INACTIVE'))
                      : record.attributes[field.key];
      return [
        field.key,
        value === null || value === undefined ? '' : String(value),
      ];
    }),
  );
}

export function MasterDataLiveForm(
  props: Parameters<typeof GenericMasterDataLiveForm>[0],
) {
  if (props.definition.key === 'meal-services')
    return props.open ? (
      <MasterDataMealServiceForm
        mode={props.mode}
        onOpenChange={props.onOpenChange}
        onPersist={props.onPersist}
        {...(props.record ? { record: props.record } : {})}
      />
    ) : null;
  return <GenericMasterDataLiveForm {...props} />;
}

function GenericMasterDataLiveForm({
  definition,
  mode,
  onOpenChange,
  onPersist,
  open,
  record,
  initialValues,
  lockedFields = [],
}: {
  definition: MasterDataCatalogItem;
  mode: MasterDataFormMode;
  onOpenChange: (open: boolean) => void;
  onPersist: (
    values: Record<string, string>,
    logoChange?: MasterDataLogoChange,
  ) => Promise<void>;
  open: boolean;
  record?: MasterDataRecord;
  initialValues?: Record<string, string>;
  lockedFields?: readonly string[];
}) {
  const [values, setValues] = useState(() => ({
    ...valuesFrom(definition, record),
    ...initialValues,
  }));
  const [referenceForm, setReferenceForm] = useState<{
    field: string;
    definition: MasterDataCatalogItem;
    record?: MasterDataRecord;
    defaults: Record<string, string>;
  } | null>(null);
  const [referenceRevision, setReferenceRevision] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logoChange, setLogoChange] = useState<MasterDataLogoChange>();
  const [saving, setSaving] = useState(false);
  const readonly = mode === 'view';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readonly) return;
    const result = validateMasterDataDraft(definition.key, values);
    setErrors(result.errors);
    if (!result.success) return;
    if (
      isMasterTransportFormResource(definition.key) &&
      record &&
      result.values.transportStatus ===
        (record.attributes.transportStatus ??
          (record.status === 'active' ? 'ACTIVE' : 'INACTIVE'))
    ) {
      delete result.values.transportStatus;
    }
    setSaving(true);
    try {
      await onPersist(result.values, logoChange);
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
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent
          {...(!readonly ? { 'aria-describedby': undefined } : {})}
          className="start-auto left-1/2 max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto p-6"
        >
          <DialogTitle>
            {mode === 'create'
              ? 'ایجاد'
              : mode === 'edit'
                ? 'ویرایش'
                : 'مشاهده'}{' '}
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
            {isMasterTransportFormResource(definition.key) ? (
              <MasterDataTransportMetadata
                resource={definition.key}
                {...(record ? { record } : {})}
              />
            ) : null}
            {getMasterDataFormFields(definition).map((field) => {
              const error = errors[field.key];
              const controlId = `live-${definition.key}-${field.key}`;
              const reference = getReferenceFieldConfig(
                definition.key,
                field.key,
              );
              const updateValue = (value: string) =>
                setValues((current) => ({
                  ...current,
                  [field.key]: value,
                  ...((definition.key === 'suppliers' ||
                    definition.key === 'brokers') &&
                  current[field.key] !== value
                    ? field.key === 'organizationId'
                      ? { primaryContactId: '' }
                      : field.key === 'countryId'
                        ? { cityId: '' }
                        : {}
                    : {}),
                }));
              const canManage =
                (((definition.key === 'suppliers' ||
                  definition.key === 'brokers') &&
                  [
                    'organizationId',
                    'primaryContactId',
                    'serviceCodes',
                  ].includes(field.key)) ||
                  (definition.key === 'cities' && field.key === 'regionId') ||
                  (definition.key === 'hotels' &&
                    ['mealServiceIds', 'facilityIds', 'roomTypeIds'].includes(
                      field.key,
                    ))) &&
                !readonly &&
                !saving;
              const control = reference ? (
                <MasterDataReferenceSelector
                  key={`${field.key}-${reference.scopeField ? values[reference.scopeField] : ''}-${referenceRevision}`}
                  config={reference}
                  disabled={
                    readonly || saving || lockedFields.includes(field.key)
                  }
                  {...(reference.scopeField
                    ? { scopeValue: values[reference.scopeField] ?? '' }
                    : {})}
                  {...(canManage
                    ? {
                        onManage: (related?: MasterDataRecord) =>
                          setReferenceForm({
                            field: field.key,
                            definition: getMasterDataDefinition(
                              reference.target,
                            ),
                            ...(related ? { record: related } : {}),
                            defaults:
                              reference.target === 'organizations'
                                ? related
                                  ? {}
                                  : { roleCodes: reference.requiredRole ?? '' }
                                : reference.target === 'organization-contacts'
                                  ? {
                                      organizationId:
                                        values.organizationId ?? '',
                                      ...(related
                                        ? {}
                                        : { preferredChannel: 'PHONE' }),
                                    }
                                  : reference.target === 'regions'
                                    ? { countryId: values.countryId ?? '' }
                                    : {},
                          }),
                      }
                    : {})}
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
              ) : field.key === 'logoFileReference' ? (
                <MasterDataLogoUpload
                  disabled={readonly || saving}
                  label={field.label}
                  onChange={setLogoChange}
                  {...(logoChange ? { pending: logoChange } : {})}
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
                  includeTime={definition.key !== 'baggage-rules'}
                  onChange={updateValue}
                  placeholder={field.placeholder}
                  readOnly={readonly}
                  value={values[field.key] ?? ''}
                />
              ) : field.type === 'number' ? (
                <MasterDataNumberInput
                  aria-invalid={Boolean(error)}
                  disabled={readonly || saving}
                  id={controlId}
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
                  onChange={(event) => updateValue(event.target.value)}
                  placeholder={field.placeholder}
                  readOnly={readonly}
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
                  (field.type === 'select' ||
                    field.type === 'datetime-local') ? (
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
      {referenceForm ? (
        <MasterDataLiveForm
          key={`${referenceForm.field}-${referenceForm.record?.id ?? 'new'}`}
          definition={referenceForm.definition}
          mode={referenceForm.record ? 'edit' : 'create'}
          open
          initialValues={referenceForm.defaults}
          lockedFields={
            referenceForm.definition.key === 'organization-contacts'
              ? ['organizationId']
              : []
          }
          {...(referenceForm.record ? { record: referenceForm.record } : {})}
          onOpenChange={(next) => {
            if (!next) setReferenceForm(null);
          }}
          onPersist={async (draft, nestedLogoChange) => {
            const resource = referenceForm.definition.key;
            const response = await masterDataApi.persistWithLogo({
              resource,
              values: draft,
              title:
                `${referenceForm.definition.singularLabel} ${draft.name ?? draft.legalName ?? referenceForm.record?.name ?? ''}`.trim(),
              ...(referenceForm.record
                ? { existing: referenceForm.record }
                : {}),
              ...(nestedLogoChange ? { logoChange: nestedLogoChange } : {}),
            });
            const field = referenceForm.field;
            const config = getReferenceFieldConfig(definition.key, field)!;
            const selectedValue =
              config.payload === 'code' ? response.data.code : response.data.id;
            setValues((current) => ({
              ...current,
              [field]: config.multiple
                ? [
                    ...new Set([
                      ...(current[field] ?? '').split(',').filter(Boolean),
                      selectedValue,
                    ]),
                  ].join(',')
                : selectedValue,
              ...(field === 'organizationId' &&
              current.organizationId !== selectedValue
                ? { primaryContactId: '' }
                : {}),
            }));
            setReferenceRevision((revision) => revision + 1);
            setReferenceForm(null);
          }}
        />
      ) : null}
    </>
  );
}
