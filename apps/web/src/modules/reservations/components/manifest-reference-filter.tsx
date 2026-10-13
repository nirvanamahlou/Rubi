'use client';

import { useEffect, useState } from 'react';
import type { MasterDataRecord } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { masterDataApi } from '@/modules/master-data/api/client';

type ManifestReferenceResource = 'countries' | 'cities';

export function manifestReferenceQuery(search: string, countryId?: string) {
  return {
    search,
    status: 'active' as const,
    sortBy: 'name' as const,
    sortDirection: 'asc' as const,
    page: 1,
    pageSize: 25,
    ...(countryId ? { countryId } : {}),
  };
}

export function ManifestReferenceFilter({
  id,
  label,
  resource,
  value,
  countryId,
  onSelect,
}: {
  id: string;
  label: string;
  resource: ManifestReferenceResource;
  value?: MasterDataRecord | undefined;
  countryId?: string | undefined;
  onSelect: (value: MasterDataRecord | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [attempt, setAttempt] = useState(0);
  const enabled = resource !== 'cities' || Boolean(countryId);
  const key = JSON.stringify([resource, search, countryId, attempt]);
  const [result, setResult] = useState<{
    key: string;
    rows: readonly MasterDataRecord[];
    error?: string;
  }>();

  useEffect(() => {
    if (!open || !enabled) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void masterDataApi
        .list(resource, manifestReferenceQuery(search, countryId))
        .then((response) => {
          if (active)
            setResult({
              key,
              rows: response.data.filter(
                (record) => record.status === 'active',
              ),
            });
        })
        .catch(() => {
          if (active)
            setResult({
              key,
              rows: [],
              error: 'دریافت اطلاعات پایه ناموفق بود؛ دوباره تلاش کنید.',
            });
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, enabled, resource, search, countryId, key]);

  const current = result?.key === key ? result : undefined;
  return (
    <div className="min-w-0 space-y-2">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <SearchCombobox
            id={id}
            label={label}
            value={value?.id ?? ''}
            selectedLabel={value?.name}
            disabled={!enabled}
            remote
            options={(current?.rows ?? []).map((record) => ({
              value: record.id,
              label: record.name,
              searchText: [
                record.code,
                typeof record.attributes.englishName === 'string'
                  ? record.attributes.englishName
                  : '',
              ].join(' '),
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
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  تلاش دوباره
                </Button>
              ) : undefined
            }
            placeholder={
              resource === 'cities' && !countryId
                ? 'ابتدا کشور را انتخاب کنید'
                : 'جست‌وجو و انتخاب…'
            }
            onValueChange={(selectedId) =>
              onSelect(current?.rows.find((record) => record.id === selectedId))
            }
          />
        </div>
        {value ? (
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
