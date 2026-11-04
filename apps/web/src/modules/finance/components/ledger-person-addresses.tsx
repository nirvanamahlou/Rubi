'use client';
import { useState } from 'react';
import type { PersonAddress } from '@nora/contracts';
import { Input } from '@/components/ui/form-controls';
import { useQuery } from '@tanstack/react-query';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { masterDataApi } from '@/modules/master-data/api/client';

export function PersonPlace({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const cities = useQuery({
    queryKey: ['ledger-person', 'cities', search],
    enabled: open,
    queryFn: () =>
      masterDataApi.list(
        'cities',
        {
          search,
          status: 'active',
          sortBy: 'name',
          sortDirection: 'asc',
          page: 1,
          pageSize: 50,
        },
        'accounting',
      ),
  });
  const regions = useQuery({
    queryKey: ['ledger-person', 'regions', search],
    enabled: open && label === 'منطقه جغرافیایی',
    queryFn: () =>
      masterDataApi.list(
        'regions',
        {
          search,
          status: 'active',
          sortBy: 'name',
          sortDirection: 'asc',
          page: 1,
          pageSize: 50,
        },
        'accounting',
      ),
  });
  const places = Array.from(
    new Set(
      [...(cities.data?.data ?? []), ...(regions.data?.data ?? [])].map(
        (c) => c.name,
      ),
    ),
  );
  return (
    <SearchCombobox
      label={label}
      value={value}
      selectedLabel={value}
      onValueChange={onChange}
      remote
      onOpenChange={setOpen}
      onSearchChange={setSearch}
      loading={cities.isFetching || regions.isFetching}
      error={cities.error?.message ?? regions.error?.message}
      optionLimit={50}
      options={places.map((name) => ({ value: name, label: name }))}
    />
  );
}
const columns = [
  ['title', 'عنوان'],
  ['region', 'منطقه جغرافیایی'],
  ['address', 'آدرس'],
  ['phone', 'تلفن'],
  ['postalCode', 'کد پستی'],
  ['fax', 'فاکس'],
  ['email', 'ایمیل'],
] as const;
export function LedgerPersonAddresses({
  rows,
  change,
}: {
  rows: PersonAddress[];
  change: (rows: PersonAddress[]) => void;
}) {
  const [search, setSearch] = useState('');
  function update(
    id: string,
    key: keyof PersonAddress,
    value: string | boolean,
  ) {
    change(
      rows.map((row) =>
        row.id === id
          ? { ...row, [key]: value }
          : key === 'primary' && value
            ? { ...row, primary: false }
            : row,
      ),
    );
  }
  return (
    <fieldset>
      <legend>نشانی</legend>
      <div className="flex flex-wrap items-center gap-3 py-2">
        <button
          type="button"
          onClick={() => {
            setSearch('');
            change([
              ...rows,
              {
                id: crypto.randomUUID(),
                primary: rows.length === 0,
                title: '',
                region: '',
                address: '',
                phone: '',
                postalCode: '',
                fax: '',
                email: '',
              },
            ]);
          }}
        >
          ＋ افزودن نشانی
        </button>
        <input
          className="rounded border px-2"
          aria-label="جستجو در نشانی‌ها"
          placeholder="جستجو…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] text-sm">
          <thead>
            <tr>
              <th>اصلی</th>
              {columns.map(([k, l]) => (
                <th key={k}>{l}</th>
              ))}
              <th>حذف</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) =>
                columns.some(([k]) => r[k].includes(search.trim())),
              )
              .map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label="نشانی اصلی"
                      checked={row.primary}
                      onChange={(e) =>
                        update(row.id, 'primary', e.target.checked)
                      }
                    />
                  </td>
                  {columns.map(([k, l]) => (
                    <td key={k}>
                      {k === 'region' ? (
                        <PersonPlace
                          label={l}
                          value={row[k]}
                          onChange={(v) => update(row.id, k, v)}
                        />
                      ) : (
                        <Input
                          aria-label={l}
                          type={k === 'email' ? 'email' : 'text'}
                          maxLength={
                            k === 'address'
                              ? 1000
                              : k === 'postalCode'
                                ? 20
                                : 160
                          }
                          value={row[k]}
                          onChange={(e) => update(row.id, k, e.target.value)}
                        />
                      )}
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      aria-label="حذف نشانی"
                      onClick={() =>
                        change(rows.filter((r) => r.id !== row.id))
                      }
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </fieldset>
  );
}
