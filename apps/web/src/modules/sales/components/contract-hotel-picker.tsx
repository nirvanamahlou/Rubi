'use client';

import { useEffect, useState } from 'react';
import type { MasterDataRecord } from '@nora/contracts';
import { Alert } from '@/components/ui/surfaces';
import { salesApi } from '../api/client';
import type { SalesFormState } from '../model/sales-form';
import {
  withCompositeHotel,
  contractHotelChoices,
  selectedContractHotelKey,
  compositeHotelChoice,
  hotelsAtContractDestination,
} from '../model/composite-hotel-selection';
import { SearchableReference } from './searchable-reference';

export function ContractHotelPicker({
  state,
  patch,
  hotels,
  onHotelChange,
  refreshRevision = 0,
}: {
  state: SalesFormState;
  patch: (value: Partial<SalesFormState>) => void;
  hotels: readonly MasterDataRecord[];
  onHotelChange: (hotelId: string) => void;
  refreshRevision?: number;
}) {
  const [options, setOptions] = useState<MasterDataRecord[]>([]);
  const [error, setError] = useState('');
  const allowComposite = !state.tour;
  const composites = allowComposite
    ? hotelsAtContractDestination(options, state.destinationId)
    : [];
  useEffect(() => {
    let active = true;
    if (!allowComposite) return;
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
      if (active) {
        setOptions(items);
        setError('');
      }
    }
    void load().catch((cause) => {
      if (active)
        setError(
          cause instanceof Error
            ? cause.message
            : 'دریافت هتل‌های ترکیبی انجام نشد.',
        );
    });
    return () => {
      active = false;
    };
  }, [allowComposite, refreshRevision]);
  return (
    <div className="min-w-0 space-y-2">
      <SearchableReference
        label="هتل"
        value={selectedContractHotelKey(state, composites)}
        options={contractHotelChoices(
          hotelsAtContractDestination(hotels, state.destinationId),
          composites,
        )}
        showAllOptionsOnOpen
        preferEnglishName
        onChange={(id) => {
          const record = compositeHotelChoice(id, composites);
          if (!record) {
            onHotelChange(id);
            return;
          }
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
      {allowComposite && error && <Alert title={error} tone="error" />}
    </div>
  );
}
