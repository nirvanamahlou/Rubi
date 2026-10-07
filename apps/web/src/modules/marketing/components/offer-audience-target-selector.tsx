'use client';

import type { CustomerSummary, MasterDataRecord } from '@nora/contracts';
import { ExternalLink, RefreshCw } from 'lucide-react';
import Link from '@/i18n/link';
import { useCallback, useEffect, useState, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { SearchCombobox } from '@/components/ui/search-combobox';
import {
  FormField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import {
  customersApi,
  CustomersApiError,
} from '@/modules/customers/api/client';
import {
  masterDataApi,
  MasterDataApiError,
} from '@/modules/master-data/api/client';

export type OfferAudienceTargetKind = 'none' | 'customer' | 'agency';

export interface OfferAudienceTargetReference {
  kind: Exclude<OfferAudienceTargetKind, 'none'>;
  id: string;
  label: string;
}

interface AudienceOption {
  id: string;
  label: string;
}

type LookupState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

function AudienceSelect({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  options: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([optionValue, label]) => (
          <SelectItem key={optionValue} value={optionValue}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function customerOptions(
  records: readonly CustomerSummary[],
): AudienceOption[] {
  return records
    .filter((record) => record.currentConsentStatus === 'granted')
    .map((record) => ({ id: record.id, label: record.displayName }));
}

function agencyOptions(records: readonly MasterDataRecord[]): AudienceOption[] {
  return records.map((record) => ({ id: record.id, label: record.name }));
}

function lookupErrorMessage(error: unknown) {
  if (
    (error instanceof CustomersApiError ||
      error instanceof MasterDataApiError) &&
    error.status === 401
  )
    return 'نشست معتبر نیست؛ دوباره وارد سامانه شوید.';
  if (
    (error instanceof CustomersApiError ||
      error instanceof MasterDataApiError) &&
    error.status === 403
  )
    return 'مجوز مشاهده این مخاطبان برای شما فعال نیست.';
  return 'دریافت مخاطبان از بخش مرجع ناموفق بود.';
}

export function OfferAudienceTargetSelector({
  kind,
  value,
  onKindChange,
  onChange,
}: {
  kind: OfferAudienceTargetKind;
  value: OfferAudienceTargetReference | null;
  onKindChange: (kind: OfferAudienceTargetKind) => void;
  onChange: (target: OfferAudienceTargetReference | null) => void;
}) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<AudienceOption[]>([]);
  const [state, setState] = useState<LookupState>('idle');
  const [error, setError] = useState('');
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const lookupKey = JSON.stringify([kind, search]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const requestId = ++generation.current;
    if (kind === 'none') {
      setOptions([]);
      setState('idle');
      return;
    }
    setState('loading');
    setError('');
    try {
      const nextOptions =
        kind === 'customer'
          ? customerOptions(
              (
                await customersApi.list({
                  search,
                  kind: 'all',
                  status: 'active',
                  role: 'customer',
                  branchId: 'all',
                  acquaintanceMethodId: 'all',
                  createdFrom: null,
                  createdTo: null,
                  updatedFrom: null,
                  updatedTo: null,
                  sortBy: 'displayName',
                  sortDirection: 'asc',
                  page: 1,
                  pageSize: 20,
                })
              ).data,
            )
          : agencyOptions(
              (
                await masterDataApi.list('organizations', {
                  search,
                  status: 'active',
                  sortBy: 'name',
                  sortDirection: 'asc',
                  page: 1,
                  pageSize: 20,
                  organizationRole: 'AGENCY',
                })
              ).data,
            );
      if (requestId !== generation.current) return;
      setLoadedKey(lookupKey);
      setOptions(nextOptions);
      setState(nextOptions.length ? 'ready' : 'empty');
    } catch (caught) {
      if (requestId !== generation.current) return;
      setLoadedKey(lookupKey);
      setOptions([]);
      setError(lookupErrorMessage(caught));
      setState('error');
    }
  }, [kind, search, lookupKey]);

  useEffect(() => {
    if (kind === 'none') return;
    const timer = window.setTimeout(() => void load(), 300);
    return () => {
      window.clearTimeout(timer);
      invalidate();
    };
  }, [kind, load, search, invalidate]);

  return (
    <section
      aria-label="مخاطب هدف پیشنهاد"
      className="grid gap-4 rounded-2xl border border-border bg-primary/5 p-4 sm:col-span-2 sm:grid-cols-2"
    >
      <FormField id="offer-audience-kind" label="مخاطب هدف (اختیاری)">
        <AudienceSelect
          ariaLabel="نوع مخاطب هدف پیشنهاد"
          onChange={(nextKind) => {
            const normalized = nextKind as OfferAudienceTargetKind;
            invalidate();
            setLoadedKey(null);
            setSearch('');
            setOptions([]);
            setState('idle');
            onChange(null);
            onKindChange(normalized);
          }}
          options={[
            ['none', 'بدون مخاطب مشخص'],
            ['customer', 'مشتریان'],
            ['agency', 'آژانس‌ها'],
          ]}
          value={kind}
        />
      </FormField>

      {kind !== 'none' ? (
        <>
          <FormField
            id="offer-audience-reference"
            label={kind === 'customer' ? 'انتخاب مشتری' : 'انتخاب آژانس'}
            required
          >
            <SearchCombobox
              id="offer-audience-reference"
              label="مرجع مخاطب هدف"
              value={value?.id ?? ''}
              selectedLabel={value?.label}
              options={options.map((option) => ({
                value: option.id,
                label: option.label,
              }))}
              remote
              loading={
                loadedKey !== lookupKey ||
                state === 'loading' ||
                state === 'idle'
              }
              error={state === 'error' ? error : undefined}
              onSearchChange={setSearch}
              onValueChange={(id) => {
                const selected = options.find((option) => option.id === id);
                onChange(
                  selected
                    ? { kind, id: selected.id, label: selected.label }
                    : null,
                );
              }}
            />
          </FormField>
          <div className="flex min-h-10 items-center gap-2 text-sm sm:self-end">
            {state === 'loading' ? (
              <span aria-live="polite" className="text-muted-foreground">
                در حال دریافت مخاطبان…
              </span>
            ) : state === 'empty' ? (
              <span aria-live="polite" className="text-muted-foreground">
                {kind === 'customer'
                  ? 'مشتری فعال دارای رضایت مارکتینگ پیدا نشد.'
                  : 'آژانس فعالی پیدا نشد.'}
              </span>
            ) : state === 'error' ? (
              <>
                <span className="text-destructive" role="alert">
                  {error}
                </span>
                <Button
                  onClick={() => void load()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" className="size-4" /> تلاش
                  دوباره
                </Button>
              </>
            ) : value ? (
              <span aria-live="polite" className="font-bold text-primary">
                متصل به «{value.label}»
              </span>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <Button asChild size="sm" type="button" variant="ghost">
              <Link
                href={
                  kind === 'customer' && value
                    ? `/customers?customerId=${encodeURIComponent(value.id)}`
                    : kind === 'customer'
                      ? '/customers'
                      : '/organizations'
                }
              >
                <ExternalLink aria-hidden="true" className="size-4" />
                {kind === 'customer'
                  ? 'بازکردن بخش مشتریان'
                  : 'بازکردن بخش آژانس‌ها'}
              </Link>
            </Button>
          </div>
          {kind === 'customer' ? (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              فقط مشتریان فعال با رضایت جاری مارکتینگ قابل انتخاب‌اند؛ مارکتینگ
              فقط شناسه مرجع را نگه می‌دارد.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
