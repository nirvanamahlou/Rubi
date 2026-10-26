'use client';

import { useEffect, useState } from 'react';
import type { MasterDataRecord } from '@nora/contracts';
import { Alert } from '@/components/ui/surfaces';
import { salesApi } from '../api/client';
import type { SalesFormState } from '../model/sales-form';
import { withCompositeHotel } from '../model/composite-hotel-selection';
import { SearchableReference } from './searchable-reference';

export function CompositeHotelPicker({
  state,
  patch,
}: {
  state: SalesFormState;
  patch: (value: Partial<SalesFormState>) => void;
}) {
  const [options, setOptions] = useState<MasterDataRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const memberIds = [
    state.hotel.hotelId,
    ...(state.hotel.additionalStays ?? []).map((stay) => stay.hotelId),
  ].join(',');
  const selected =
    options.find(
      (record) => String(record.attributes.memberHotelIds ?? '') === memberIds,
    )?.id ?? '';
  useEffect(() => {
    let active = true;
    async function load() {
      const items: MasterDataRecord[] = [];
      for (let page = 1; ; page++) {
        const response = await salesApi.listReferences('composite-hotels', {
          page,
          pageSize: 100,
          search: '',
          status: 'active',
          sortBy: 'name',
          sortDirection: 'asc',
        });
        items.push(...response.data);
        if (!response.data.length || items.length >= response.meta.total) break;
      }
      if (active) setOptions(items);
    }
    void load()
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'دریافت هتل‌های ترکیبی انجام نشد.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <SearchableReference
        label="بارگذاری هتل ترکیبی"
        required={false}
        value={selected}
        options={options}
        disabled={loading}
        onChange={(id) => {
          const record = options.find((option) => option.id === id);
          if (!record) return;
          try {
            const next = withCompositeHotel(state, record);
            patch({
              hotel: next.hotel,
              hotelChildAssignments: next.hotelChildAssignments,
            });
            setError('');
          } catch (cause) {
            setError(
              cause instanceof Error ? cause.message : 'بارگذاری انجام نشد.',
            );
          }
        }}
      />
      {error && <Alert title={error} tone="error" />}
    </section>
  );
}
