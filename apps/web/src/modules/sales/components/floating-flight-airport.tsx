'use client';
import { useEffect, useMemo, useState } from 'react';
import type { SalesFlightAirportV1 } from '@nora/contracts';
import { listReferences } from '@/modules/ticket-catalog/api/references';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { Button } from '@/components/ui/button';

export async function loadFloatingAirports(
  countryId: string,
  workflow: 'sales' | 'reservations',
  signal?: AbortSignal,
) {
  const airports: SalesFlightAirportV1[] = [];
  for (let page = 1; page <= 100; page++) {
    const result = await listReferences(
      'airports',
      '',
      page,
      signal,
      { countryId },
      workflow,
    );
    for (const row of result.data) {
      const code = String(row.attributes.iataCode || row.code)
        .trim()
        .toUpperCase();
      if (
        typeof row.attributes.cityId === 'string' &&
        /^[A-Z]{3}$/.test(code) &&
        !airports.some((item) => item.id === row.id)
      )
        airports.push({
          id: row.id,
          cityId: String(row.attributes.cityId),
          countryId,
          code,
          name: String(row.attributes.englishName || row.name),
        });
    }
    if (page * result.meta.pageSize >= result.meta.total) return airports;
    if (!result.data.length) break;
  }
  throw new Error('دریافت مرجع اطلاعات پایه ممکن نشد.');
}

export function preferredFloatingAirport(
  rows: readonly SalesFlightAirportV1[],
  cityId: string,
) {
  return rows.find((airport) => airport.cityId === cityId) ?? rows[0];
}

export function FloatingFlightAirport({
  cityId,
  countryId,
  workflow = 'sales',
  value,
  onChange,
  label = 'فرودگاه مقصد',
  preferredId,
}: {
  cityId: string;
  countryId: string;
  workflow?: 'sales' | 'reservations';
  value: SalesFlightAirportV1 | undefined;
  onChange: (airport: SalesFlightAirportV1 | undefined) => void;
  label?: string;
  preferredId?: string | undefined;
}) {
  const [result, setResult] = useState<{
    countryId: string;
    rows: SalesFlightAirportV1[];
    error: string;
  }>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!countryId) return;
    const abort = new AbortController();
    void loadFloatingAirports(countryId, workflow, abort.signal)
      .then((rows) => {
        if (!abort.signal.aborted) setResult({ countryId, rows, error: '' });
      })
      .catch((cause: unknown) => {
        if (!abort.signal.aborted)
          setResult({
            countryId,
            rows: [],
            error:
              cause instanceof Error
                ? cause.message
                : 'دریافت مرجع اطلاعات پایه ممکن نشد.',
          });
      });
    return () => abort.abort();
  }, [countryId, workflow, retry]);
  const ready = result?.countryId === countryId;
  const rows = useMemo(
    () => (result?.countryId === countryId ? result.rows : []),
    [result, countryId],
  );
  useEffect(() => {
    const preferred = rows.find((airport) => airport.id === preferredId);
    if (preferred && value?.id !== preferred.id) onChange(preferred);
    else if (rows[0] && (!value || value.countryId !== countryId))
      onChange(
        rows.find((airport) => airport.id === preferredId) ??
          preferredFloatingAirport(rows, cityId),
      );
    else if (ready && value && value.countryId !== countryId)
      onChange(undefined);
  }, [rows, value, cityId, countryId, onChange, ready, preferredId]);
  return (
    <div className="grid gap-2">
      <SearchCombobox
        label={label}
        value={value?.countryId === countryId ? value.id : ''}
        selectedLabel={
          value?.countryId === countryId
            ? `${value.name} · ${value.code}`
            : undefined
        }
        placeholder="جست‌وجو و انتخاب…"
        loading={!ready && !!countryId}
        disabled={
          !countryId ||
          !ready ||
          !rows.length ||
          !!rows.find((airport) => airport.id === preferredId)
        }
        options={rows.map((airport) => ({
          value: airport.id,
          label: `${airport.name} · ${airport.code}`,
        }))}
        onValueChange={(id) => {
          const airport = rows.find((item) => item.id === id);
          if (airport) onChange(airport);
        }}
      />
      {ready && result.error ? (
        <>
          <p role="alert" className="text-xs text-destructive">
            {result.error}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setRetry((current) => current + 1)}
          >
            دریافت دوباره
          </Button>
        </>
      ) : null}
    </div>
  );
}
