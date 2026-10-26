'use client';

import { useEffect, useState } from 'react';
import { brokerEnglishDisplayName } from '@nora/contracts';
import {
  SearchCombobox,
  type SearchOption,
} from '@/components/ui/search-combobox';
import type { Option } from '../hotel-rates/controls';
import { travelRequest } from './travel-workflow-form';

type Broker = { id: string; name: string; englishName?: string };

export function purchaseBrokerOption(broker: Broker): SearchOption {
  return {
    value: broker.id,
    label: brokerEnglishDisplayName(broker),
    searchText: `${broker.name} ${broker.englishName ?? ''}`,
  };
}

export async function loadPurchaseBrokers(requestId: string) {
  const brokers: SearchOption[] = [];
  for (let page = 1; ; page += 1) {
    const result = await travelRequest<{
      data: Broker[];
      meta: { total: number };
    }>(
      `reservations/requests/${encodeURIComponent(requestId)}/voucher-brokers?page=${page}`,
    );
    brokers.push(...result.data.map(purchaseBrokerOption));
    if (!result.data.length || brokers.length >= result.meta.total)
      return brokers;
  }
}

export function selectedPurchaseBrokerLabel(
  options: SearchOption[],
  value: Option | null,
) {
  return (
    options.find((option) => option.value === value?.id)?.label ??
    (value ? brokerEnglishDisplayName(value) : undefined)
  );
}

export function ReservationPurchaseBrokerLookup({
  requestId,
  label,
  value,
  onChange,
}: {
  requestId: string;
  label: string;
  value: Option | null;
  onChange: (value: Option | null) => void;
}) {
  const [directory, setDirectory] = useState<{
    requestId: string;
    options: SearchOption[];
    error?: string;
  }>();
  useEffect(() => {
    let live = true;
    void loadPurchaseBrokers(requestId).then(
      (options) => {
        if (live) setDirectory({ requestId, options });
      },
      (reason: unknown) => {
        if (live)
          setDirectory({
            requestId,
            options: [],
            error: reason instanceof Error ? reason.message : String(reason),
          });
      },
    );
    return () => {
      live = false;
    };
  }, [requestId]);
  const options =
    directory && directory.requestId === requestId ? directory.options : [];
  const error =
    directory?.requestId === requestId ? directory?.error : undefined;
  return (
    <SearchCombobox
      label={label}
      value={value?.id ?? ''}
      selectedLabel={selectedPurchaseBrokerLabel(options, value)}
      options={options}
      loading={directory?.requestId !== requestId && !error}
      error={error}
      onValueChange={(id) => {
        const selected = options.find((option) => option.value === id);
        if (selected) onChange({ id, name: String(selected.label) });
      }}
    />
  );
}
