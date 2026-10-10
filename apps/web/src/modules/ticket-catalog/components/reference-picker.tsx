'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { SearchCombobox } from '@/components/ui/search-combobox';
import {
  asReference,
  listReferences,
  ReferenceApiError,
  type PublishedResource,
} from '../api/references';
import type { Reference } from '../model/catalog';
export function ticketReferenceDisplayName(reference: Pick<Reference, 'name'>) {
  return reference.name.trim();
}
export function ReferencePicker({
  id,
  label,
  resource,
  value,
  onSelect,
  countryId,
  cityId,
  readOnly = false,
}: {
  id: string;
  label: string;
  resource: PublishedResource;
  value: Reference | undefined;
  onSelect: (value: Reference | undefined) => void;
  countryId?: string;
  cityId?: string;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(''),
    [attempt, setAttempt] = useState(0);
  const enabled =
    !readOnly &&
    (resource !== 'cities' || Boolean(countryId)) &&
    (resource !== 'airports' || Boolean(cityId));
  const key = JSON.stringify([resource, search, countryId, cityId, attempt]);
  const [result, setResult] = useState<{
    key: string;
    rows: Reference[];
    error?: string;
  }>();
  useEffect(() => {
    if (!open || !enabled) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      void listReferences(resource, search, 1, abort.signal, {
        ...(countryId ? { countryId } : {}),
        ...(cityId ? { cityId } : {}),
      })
        .then((response) => {
          if (abort.signal.aborted) return;
          setResult({
            key,
            rows: response.data
              .map(asReference)
              .filter((item): item is Reference => Boolean(item))
              .filter(
                (item) =>
                  (resource !== 'cities' || item.countryId === countryId) &&
                  (resource !== 'airports' || item.cityId === cityId),
              )
              .slice(0, 6),
          });
        })
        .catch((error: unknown) => {
          if (!abort.signal.aborted)
            setResult({
              key,
              rows: [],
              error:
                error instanceof ReferenceApiError &&
                error.state === 'forbidden'
                  ? 'مجوز دریافت اطلاعات پایه ندارید (403).'
                  : error instanceof ReferenceApiError &&
                      error.state === 'unauthorized'
                    ? 'برای دریافت اطلاعات وارد شوید (401).'
                    : 'دریافت اطلاعات پایه ناموفق بود؛ دوباره تلاش کنید.',
            });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [open, enabled, resource, search, countryId, cityId, key]);
  const current = result?.key === key ? result : undefined;
  return (
    <div className="min-w-0 space-y-2">
      <label className="text-sm font-semibold" htmlFor={id}>
        {label}
      </label>
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <SearchCombobox
            id={id}
            label={label}
            value={value?.id ?? ''}
            selectedLabel={
              value ? ticketReferenceDisplayName(value) : undefined
            }
            disabled={!enabled}
            remote
            options={(current?.rows ?? []).map((row) => ({
              value: row.id,
              label: ticketReferenceDisplayName(row),
            }))}
            onSearchChange={setSearch}
            onOpenChange={setOpen}
            loading={!current}
            error={current?.error}
            footer={
              current?.error ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAttempt((n) => n + 1)}
                >
                  تلاش دوباره
                </Button>
              ) : undefined
            }
            placeholder={
              resource === 'cities' && !countryId
                ? 'ابتدا کشور را انتخاب کنید'
                : resource === 'airports' && !cityId
                  ? 'ابتدا شهر را انتخاب کنید'
                  : 'جست‌وجو و انتخاب…'
            }
            onValueChange={(id) =>
              onSelect(current?.rows.find((row) => row.id === id))
            }
          />
        </div>
        {value && !readOnly ? (
          <Button
            type="button"
            variant="ghost"
            aria-label={'پاک‌کردن ' + label}
            onClick={() => onSelect(undefined)}
          >
            پاک
          </Button>
        ) : null}
      </div>
    </div>
  );
}
