'use client';

import type { MasterDataRecord } from '@rubi/contracts';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox, Input } from '@/components/ui/form-controls';
import { Alert, Badge, EmptyState, Skeleton } from '@/components/ui/surfaces';
import { masterDataApi, MasterDataApiError } from '../api/client';
import { MasterDataClearSelection } from './master-data-clearable-field';
import {
  hasOrganizationRole,
  mapReferenceOption,
  ORGANIZATION_ROLE_OPTIONS,
  resolveReferenceSelectorState,
  toggleOrganizationRole,
  type ReferenceFieldConfig,
  type ReferenceSelectorState,
} from '../model/reference-fields';

export function MasterDataReferenceSelector({
  config,
  disabled,
  id,
  label = 'انتخاب',
  onChange,
  value,
  scopeValue,
  refreshKey = 0,
  onManage,
}: {
  config: ReferenceFieldConfig;
  disabled: boolean;
  id: string;
  label?: string;
  onChange: (value: string) => void;
  value: string;
  scopeValue?: string;
  refreshKey?: number;
  onManage?: (record?: MasterDataRecord) => void;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<readonly MasterDataRecord[]>([]);
  const [savedSelection, setSavedSelection] = useState<MasterDataRecord | null>(null);
  const [state, setState] = useState<ReferenceSelectorState>('loading');

  useEffect(() => {
    if (config.multiple || config.payload !== 'id' || !value) return;
    let active = true;
    void masterDataApi.detail(config.target, value).then(({ data }) => {
      if (active && (!config.scopeField || !scopeValue || String(data.attributes[config.scopeField] ?? '') === scopeValue))
        setSavedSelection(data);
    }).catch(() => { if (active) setSavedSelection(null); });
    return () => { active = false; };
  }, [config.multiple, config.payload, config.target, config.scopeField, scopeValue, value, refreshKey]);

  useEffect(() => {
    if (config.scopeField === 'organizationId' && !scopeValue) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setState(resolveReferenceSelectorState({ loading: true }));
      try {
        const response = await masterDataApi.list(config.target, {
          search: query,
          status: 'active',
          sortBy: 'name',
          sortDirection: 'asc',
          page: 1,
          pageSize: 100,
          ...(config.scopeField && scopeValue ? { [config.scopeField]: scopeValue } : {}),
        });
        if (!active) return;
        const compatible = response.data.filter((record) =>
          hasOrganizationRole(record, config.requiredRole),
        );
        setOptions(compatible);
        setState(
          resolveReferenceSelectorState({ optionCount: compatible.length }),
        );
      } catch (error) {
        if (!active) return;
        setOptions([]);
        setState(
          resolveReferenceSelectorState({
            errorStatus:
              error instanceof MasterDataApiError ? error.status : 500,
          }),
        );
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [config.requiredRole, config.target, config.scopeField, scopeValue, refreshKey, query]);

  const selected = useMemo(
    () =>
      options.find((record) => mapReferenceOption(config, record) === value) ??
      (savedSelection?.id === value ? savedSelection : undefined),
    [config, options, value, savedSelection],
  );
  const selectedValues = useMemo(
    () =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [value],
  );
  const selectedOptions = useMemo(
    () =>
      options.filter((record) =>
        selectedValues.includes(mapReferenceOption(config, record)),
      ),
    [config, options, selectedValues],
  );

  function choose(optionValue: string) {
    if (!config.multiple) {
      onChange(optionValue);
      return;
    }
    onChange(
      selectedValues.includes(optionValue)
        ? selectedValues.filter((item) => item !== optionValue).join(',')
        : [...selectedValues, optionValue].join(','),
    );
  }

  if (disabled) {
    return (
      <div className="rounded-xl border border-input bg-muted/40 px-3 py-2.5 text-sm">
        {config.multiple
          ? selectedOptions.length
            ? selectedOptions
                .map((record) => `${record.name} (${record.code})`)
                .join('، ')
            : selectedValues.length
              ? `${selectedValues.length.toLocaleString('fa-IR')} مرجع ثبت‌شده`
              : '—'
          : selected
            ? `${selected.name} (${selected.code})`
            : value
              ? 'مرجع ثبت‌شده'
              : '—'}
      </div>
    );
  }

  if (config.scopeField === 'organizationId' && !scopeValue)
    return <p className="text-sm text-muted-foreground">ابتدا سازمان را انتخاب کنید.</p>;

  return (
    <div className="space-y-2">
      {onManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => onManage()} size="sm" type="button" variant="outline">
            {config.target === 'organizations' ? 'افزودن سازمان' : config.target === 'organization-contacts' ? 'افزودن مخاطب' : 'افزودن خدمت'}
          </Button>
          {!config.multiple && selected ? <Button onClick={() => onManage(selected)} size="sm" type="button" variant="ghost">
            {config.target === 'organizations' ? 'ویرایش سازمان و نوع شخصیت' : 'ویرایش مخاطب'}
          </Button> : null}
          {config.target === 'organizations' && selected ? <Badge>
            نوع شخصیت: {selected.attributes.personType === 'NATURAL' ? 'حقیقی' : selected.attributes.personType === 'LEGAL' ? 'حقوقی' : 'ثبت نشده'}
          </Badge> : null}
        </div>
      ) : null}
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 p-2">
          <div className="flex flex-wrap gap-1.5">
            {config.multiple ? (
              selectedOptions.length ? (
                selectedOptions.map((record) => (
                  <Badge
                    key={record.id}
                  >{`${record.name} · ${record.code}`}</Badge>
                ))
              ) : (
                <Badge>
                  {selectedValues.length.toLocaleString('fa-IR')} مرجع انتخاب
                  شده
                </Badge>
              )
            ) : (
              <Badge>
                {selected
                  ? `${selected.name} · ${selected.code}`
                  : 'مرجع انتخاب شده'}
              </Badge>
            )}
          </div>
          <MasterDataClearSelection
            controlId={id}
            label={label}
            value={value}
            onClear={() => {
              onChange('');
              setQuery('');
            }}
          />
        </div>
      ) : null}
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute end-3 top-3.5 size-4 text-muted-foreground"
        />
        <Input
          aria-autocomplete="list"
          aria-controls={`${id}-options`}
          aria-expanded={state === 'ready'}
          className="pe-10"
          id={id}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="جست‌وجوی عنوان یا کد"
          role="combobox"
          value={query}
        />
      </div>
      <div
        aria-multiselectable={config.multiple || undefined}
        className="max-h-48 overflow-y-auto rounded-xl border border-border p-2"
        id={`${id}-options`}
        role="listbox"
      >
        {state === 'loading' ? (
          <div aria-label="در حال بارگذاری گزینه‌ها" className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : state === 'forbidden' ? (
          <Alert
            description="مجوز master_data.read برای دریافت گزینه‌های این فیلد لازم است."
            title="دسترسی انتخاب مرجع وجود ندارد"
            tone="error"
          />
        ) : state === 'error' ? (
          <Alert
            description="دریافت گزینه‌ها از Backend ناموفق بود؛ جست‌وجو را دوباره تغییر دهید."
            title="خطای دریافت مرجع"
            tone="error"
          />
        ) : state === 'empty' ? (
          <EmptyState
            description="مرجع فعال و سازگار با این فیلد پیدا نشد."
            title="گزینه‌ای وجود ندارد"
          />
        ) : (
          <div className="grid gap-1">
            {options.map((record) => {
              const optionValue = mapReferenceOption(config, record);
              const optionSelected = config.multiple
                ? selectedValues.includes(optionValue)
                : optionValue === value;
              return (
                <button
                  aria-selected={optionSelected}
                  className="rounded-lg px-3 py-2 text-start text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-selected:bg-primary aria-selected:text-primary-foreground"
                  key={record.id}
                  onClick={() => choose(optionValue)}
                  role="option"
                  type="button"
                >
                  <span className="font-semibold">{record.name}</span>
                  {config.target === 'organization-contacts' ? <span className="ms-2 text-xs" dir="ltr">
                    {String(record.attributes.phoneMasked || record.attributes.emailMasked || '—')}
                  </span> : null}
                  <span className="ms-2 font-mono text-xs" dir="ltr">
                    {record.code}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function OrganizationRoleSelector({
  disabled,
  id,
  onChange,
  value,
}: {
  disabled: boolean;
  id: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const selected = new Set(value.split(',').filter(Boolean));
  return (
    <fieldset className="grid gap-2 rounded-xl border border-border p-3">
      <legend className="px-1 text-xs font-semibold text-muted-foreground">
        یک یا چند Role را انتخاب کنید
      </legend>
      {value && !disabled ? (
        <div className="flex justify-end">
          <MasterDataClearSelection
            controlId={id}
            label="نقش‌های انتخاب‌شده"
            value={value}
            onClear={() => onChange('')}
          />
        </div>
      ) : null}
      {ORGANIZATION_ROLE_OPTIONS.map(([code, label], index) => (
        <label className="flex items-center gap-2 text-sm" key={code}>
          <Checkbox
            id={index === 0 ? id : `${id}-${code}`}
            checked={selected.has(code)}
            disabled={disabled}
            onCheckedChange={(checked) =>
              onChange(toggleOrganizationRole(value, code, checked === true))
            }
          />
          <span>{label}</span>
          <span
            className="font-mono text-[10px] text-muted-foreground"
            dir="ltr"
          >
            {code}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
