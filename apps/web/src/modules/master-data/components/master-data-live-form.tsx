'use client';
import { MasterDataBrokerForm } from './master-data-broker-form';

import {
  isMasterTransportFormResource,
  type MasterDataRecord,
} from '@nora/contracts';
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
import {
  masterDataApi,
  type MasterDataLogoChange,
  type MasterDataManifestFileChange,
} from '../api/client';
import { getMasterDataFormFields } from '../model/form-fields';
import { supplierEditValues } from '../model/supplier-phone-draft';
import { validateMasterDataDraft } from '../model/validation';
import { getReferenceFieldConfig } from '../model/reference-fields';
import { MasterDataClearableField } from './master-data-clearable-field';
import { MasterDataLogoUpload } from './master-data-logo-upload';
import { MasterDataMealServiceForm } from './master-data-meal-service-form';
import { MasterDataManifestTemplateForm } from './master-data-manifest-template-form';
import { MasterDataNumberInput } from './master-data-number-input';
import { MasterDataAirlineBaggageEditor } from './master-data-airline-baggage-editor';
import {
  MasterDataReferenceSelector,
  OrganizationRoleSelector,
} from './master-data-reference-selector';
import { useMasterDataDialogFocusRestore } from './use-master-data-dialog-focus-restore';
import {
  MasterDataDetailItem,
  MasterDataDetailSection,
  MasterDataProfileIdentity,
} from './master-data-profile-details';

export type MasterDataFormMode = 'create' | 'view' | 'edit';

export function appendMasterDataReferenceValue(
  currentValue: string | undefined,
  selectedValue: string,
) {
  return [
    ...new Set([
      ...(currentValue ?? '').split(',').filter(Boolean),
      selectedValue,
    ]),
  ].join(',');
}

export function withAppendedMasterDataReference(
  current: Record<string, string>,
  field: string,
  selectedValue: string,
) {
  return {
    ...current,
    [field]: appendMasterDataReferenceValue(current[field], selectedValue),
  };
}

export function masterDataFormValuesFrom(
  definition: MasterDataCatalogItem,
  record?: MasterDataRecord,
): Record<string, string> {
  if (!record)
    return Object.fromEntries(
      getMasterDataFormFields(definition).map((field) => [
        field.key,
        definition.key === 'payment-methods' && field.key === 'channel'
          ? 'OTHER'
          : definition.key === 'cabin-classes' && field.key === 'cabinType'
            ? 'ECONOMY'
            : field.key === 'displayOrder'
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
          : field.key === 'status'
            ? record.status
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
                      ? [
                          record.attributes.manufacturer,
                          record.attributes.model,
                        ]
                          .filter(Boolean)
                          .join(' / ')
                      : field.key === 'includedMeals'
                        ? record.attributes.includedMealsJson
                        : field.key === 'transportStatus'
                          ? (record.attributes.transportStatus ??
                            (record.status === 'active'
                              ? 'ACTIVE'
                              : 'INACTIVE'))
                          : record.attributes[field.key];
      return [
        field.key,
        value === null || value === undefined ? '' : String(value),
      ];
    }),
  );
}

export function masterDataRecordTitle(
  definition: MasterDataCatalogItem,
  record?: MasterDataRecord,
) {
  if (definition.key !== 'cabin-classes' || !record)
    return record?.name ?? definition.singularLabel;
  const cabinType = String(record.attributes.cabinType ?? '');
  return (
    definition.fields
      .find((field) => field.key === 'cabinType')
      ?.options?.find((option) => option.value === cabinType)?.label ??
    record.name
  );
}

export function MasterDataLiveForm(
  props: Parameters<typeof GenericMasterDataLiveForm>[0],
) {
  if (props.definition.key === 'brokers')
    return props.open ? (
      <MasterDataBrokerForm
        mode={props.mode}
        onOpenChange={props.onOpenChange}
        onPersist={props.onPersist}
        {...(props.record ? { record: props.record } : {})}
      />
    ) : null;
  if (props.definition.key === 'meal-services' && props.mode !== 'view')
    return props.open ? (
      <MasterDataMealServiceForm
        mode={props.mode}
        onOpenChange={props.onOpenChange}
        onPersist={props.onPersist}
        {...(props.record ? { record: props.record } : {})}
      />
    ) : null;
  if (props.definition.key === 'manifest-templates' && props.mode !== 'view')
    return props.open ? (
      <MasterDataManifestTemplateForm
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
    manifestFileChange?: MasterDataManifestFileChange,
  ) => Promise<void>;
  open: boolean;
  record?: MasterDataRecord;
  initialValues?: Record<string, string>;
  lockedFields?: readonly string[];
}) {
  const [values, setValues] = useState(() => ({
    ...masterDataFormValuesFrom(definition, record),
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
  const [supplierPhoneTouched, setSupplierPhoneTouched] = useState(false);
  const readonly = mode === 'view';
  const focusRestore = useMasterDataDialogFocusRestore();
  const fields = getMasterDataFormFields(definition, mode);

  function displayValue(field: (typeof fields)[number], value: string): string {
    const option = field.options?.find((item) => item.value === value);
    if (option) return option.label;
    if (record && (field.key.endsWith('Id') || field.key.endsWith('Ids'))) {
      const nameKey = field.key.endsWith('Ids')
        ? `${field.key.slice(0, -3)}Names`
        : `${field.key.slice(0, -2)}Name`;
      const relatedName = record.attributes[nameKey];
      if (relatedName !== null && relatedName !== undefined)
        return Array.isArray(relatedName)
          ? relatedName.map(String).join('، ')
          : String(relatedName);
    }
    if (value === 'true') return 'بله';
    if (value === 'false') return 'خیر';
    if (value.trim().startsWith('[')) {
      try {
        const list = JSON.parse(value) as unknown;
        if (Array.isArray(list)) return list.map(String).join('، ');
      } catch {
        // Preserve non-JSON values exactly as received.
      }
    }
    return value;
  }

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
      await onPersist(
        definition.key === 'suppliers' && mode === 'edit'
          ? supplierEditValues(result.values, supplierPhoneTouched)
          : result.values,
        logoChange,
      );
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
          {...focusRestore}
          aria-describedby={undefined}
          className="start-auto left-1/2 max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto p-6"
        >
          <DialogTitle className={readonly ? 'sr-only' : undefined}>
            {mode === 'create'
              ? 'ایجاد'
              : mode === 'edit'
                ? 'ویرایش'
                : 'مشاهده'}{' '}
            {definition.singularLabel}
          </DialogTitle>
          {record && !readonly ? (
            <div className="mt-4 flex gap-2">
              <Badge>نسخه {record.version.toLocaleString('fa-IR')}</Badge>
            </div>
          ) : null}

          {readonly ? (
            <div className="mt-5 space-y-4">
              <MasterDataProfileIdentity
                eyebrow={`پروفایل ${definition.singularLabel}`}
                {...(record ? { record } : {})}
                title={masterDataRecordTitle(definition, record)}
              />
              <MasterDataDetailSection title="مشخصات ثبت‌شده">
                {fields.map((field) => (
                  <MasterDataDetailItem
                    key={field.key}
                    label={field.label}
                    ltr={
                      field.key.toLowerCase().includes('code') ||
                      field.key.toLowerCase().includes('phone') ||
                      field.key.toLowerCase().includes('email') ||
                      field.key.toLowerCase().includes('url')
                    }
                    value={displayValue(field, values[field.key] ?? '')}
                  />
                ))}
              </MasterDataDetailSection>
              {definition.key === 'airlines' ? (
                <MasterDataAirlineBaggageEditor
                  {...(record ? { airline: record } : {})}
                  readOnly
                />
              ) : null}
              <div className="flex justify-end border-t border-border pt-4">
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    بستن
                  </Button>
                </DialogClose>
              </div>
            </div>
          ) : (
            <form
              className="mt-6 space-y-5"
              noValidate
              onSubmit={(event) => void submit(event)}
            >
              {definition.key === 'suppliers' && mode === 'create' ? (
                <Alert
                  title="شناسه تأمین‌کننده خودکار است"
                  description="پس از ذخیره، سامانه یک شناسه یکتا برای تأمین‌کننده ایجاد می‌کند."
                />
              ) : null}
              {isMasterTransportFormResource(definition.key) ? (
                <MasterDataTransportMetadata
                  resource={definition.key}
                  {...(record ? { record } : {})}
                />
              ) : null}
              {fields.map((field) => {
                const error = errors[field.key];
                const controlId = `live-${definition.key}-${field.key}`;
                const helpId = `${controlId}-help`;
                const errorId = `${controlId}-error`;
                const describedBy = error
                  ? errorId
                  : field.hint
                    ? helpId
                    : undefined;
                const reference = getReferenceFieldConfig(
                  definition.key,
                  field.key,
                );
                const isHotelInlineReference =
                  definition.key === 'hotels' &&
                  ['mealServiceIds', 'roomTypeIds', 'facilityIds'].includes(
                    field.key,
                  );
                const isTransportInlineFacility =
                  ['train-types', 'bus-types'].includes(definition.key) &&
                  field.key === 'facilityIds';
                const isSupplierInlineService =
                  definition.key === 'suppliers' &&
                  field.key === 'serviceCodes';
                const updateValue = (value: string) => {
                  if (
                    definition.key === 'suppliers' &&
                    field.key === 'primaryPhone'
                  )
                    setSupplierPhoneTouched(true);
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
                };
                const canManage =
                  (((definition.key === 'suppliers' ||
                    definition.key === 'brokers') &&
                    [
                      'organizationId',
                      'primaryContactId',
                      'serviceCodes',
                    ].includes(field.key)) ||
                    (definition.key === 'cities' && field.key === 'regionId') ||
                    isTransportInlineFacility ||
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
                          onManage: (
                            related?: MasterDataRecord,
                            searchQuery?: string,
                          ) => {
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
                                    : {
                                        roleCodes: reference.requiredRole ?? '',
                                        ...(searchQuery
                                          ? { legalName: searchQuery }
                                          : {}),
                                      }
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
                                      : (isHotelInlineReference ||
                                            isTransportInlineFacility ||
                                            isSupplierInlineService) &&
                                          searchQuery
                                        ? { name: searchQuery }
                                        : {},
                            });
                          },
                        }
                      : {})}
                    createOnlyWhenEmpty={
                      definition.key === 'suppliers' &&
                      mode === 'create' &&
                      field.key === 'organizationId'
                    }
                    alwaysShowCreate={
                      isHotelInlineReference ||
                      isTransportInlineFacility ||
                      isSupplierInlineService
                    }
                    id={controlId}
                    {...(describedBy ? { ariaDescribedby: describedBy } : {})}
                    invalid={Boolean(error)}
                    label={field.label}
                    onChange={updateValue}
                    required={Boolean(field.required)}
                    value={values[field.key] ?? ''}
                  />
                ) : field.key === 'roleCodes' ? (
                  <OrganizationRoleSelector
                    {...(describedBy ? { ariaDescribedby: describedBy } : {})}
                    disabled={readonly || saving}
                    id={controlId}
                    invalid={Boolean(error)}
                    onChange={updateValue}
                    required={Boolean(field.required)}
                    value={values[field.key] ?? ''}
                  />
                ) : field.key === 'logoFileReference' ? (
                  <MasterDataLogoUpload
                    disabled={readonly || saving}
                    label={field.label}
                    onChange={setLogoChange}
                    {...(logoChange ? { pending: logoChange } : {})}
                    {...(record ? { record } : {})}
                    value={values[field.key] ?? ''}
                  />
                ) : field.type === 'select' ? (
                  <Select
                    disabled={readonly || saving}
                    onValueChange={updateValue}
                    required={Boolean(field.required)}
                    value={values[field.key] ?? ''}
                  >
                    <SelectTrigger
                      aria-describedby={describedBy}
                      aria-invalid={Boolean(error)}
                      id={controlId}
                    >
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
                    aria-describedby={describedBy}
                    aria-invalid={Boolean(error)}
                    disabled={readonly || saving}
                    id={controlId}
                    includeTime={definition.key !== 'baggage-rules'}
                    onChange={updateValue}
                    placeholder={field.placeholder}
                    readOnly={readonly}
                    required={Boolean(field.required)}
                    value={values[field.key] ?? ''}
                  />
                ) : field.type === 'number' ? (
                  <MasterDataNumberInput
                    aria-describedby={describedBy}
                    aria-invalid={Boolean(error)}
                    disabled={readonly || saving}
                    id={controlId}
                    onChange={updateValue}
                    placeholder={field.placeholder}
                    readOnly={readonly}
                    required={Boolean(field.required)}
                    value={values[field.key] ?? ''}
                  />
                ) : (
                  <Input
                    aria-describedby={describedBy}
                    aria-invalid={Boolean(error)}
                    disabled={readonly || saving}
                    dir={
                      field.key.toLowerCase().includes('code')
                        ? 'ltr'
                        : undefined
                    }
                    id={controlId}
                    onChange={(event) => updateValue(event.target.value)}
                    placeholder={field.placeholder}
                    readOnly={readonly}
                    required={Boolean(field.required)}
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
                    {definition.key === 'suppliers' &&
                    field.key === 'primaryPhone' &&
                    mode === 'edit' &&
                    record?.attributes.primaryPhoneMasked ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {supplierPhoneTouched ? (
                          <span>
                            {values.primaryPhone
                              ? 'شمارهٔ جدید پس از ذخیره جایگزین می‌شود.'
                              : 'شمارهٔ فعلی پس از ذخیره پاک می‌شود.'}
                          </span>
                        ) : (
                          <>
                            <span>
                              شمارهٔ فعلی:{' '}
                              {String(record.attributes.primaryPhoneMasked)}
                            </span>
                            <Button
                              onClick={() => updateValue('')}
                              type="button"
                              variant="outline"
                            >
                              پاک‌کردن شمارهٔ ثبت‌شده
                            </Button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </FormField>
                );
              })}
              {definition.key === 'airlines' ? (
                <MasterDataAirlineBaggageEditor
                  {...(record ? { airline: record } : {})}
                  disabled={saving}
                  readOnly={readonly}
                />
              ) : null}
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
          )}
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
            setValues((current) =>
              config.multiple
                ? withAppendedMasterDataReference(current, field, selectedValue)
                : {
                    ...current,
                    [field]: selectedValue,
                    ...(field === 'organizationId' &&
                    current.organizationId !== selectedValue
                      ? { primaryContactId: '' }
                      : {}),
                  },
            );
            setReferenceRevision((revision) => revision + 1);
            if (
              definition.key === 'suppliers' &&
              mode === 'create' &&
              field === 'organizationId' &&
              !referenceForm.record
            ) {
              setReferenceForm({
                field: 'primaryContactId',
                definition: getMasterDataDefinition('organization-contacts'),
                defaults: {
                  organizationId: selectedValue,
                  preferredChannel: 'PHONE',
                  isPrimary: 'true',
                },
              });
            } else {
              setReferenceForm(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
