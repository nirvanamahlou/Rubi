import type { MasterDataRecord } from '@nora/contracts';
import { CheckCircle2, MapPin, PlaneTakeoff, SquareStack } from 'lucide-react';

import type { MasterDataKpiItem } from './master-data-kpi-grid';

export function currentPageTerminalTotal(
  records: readonly MasterDataRecord[],
): number | '—' {
  let total = 0;
  for (const record of records) {
    const count = record.attributes.terminalCount;
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0)
      return '—';
    total += count;
    if (!Number.isSafeInteger(total)) return '—';
  }
  return total;
}

export function airportKpiItems(
  records: readonly MasterDataRecord[],
  total: number,
  activeTotal: number,
): readonly MasterDataKpiItem[] {
  const coveredCities = new Set(
    records
      .map((record) => record.attributes.cityName)
      .filter((value): value is string => typeof value === 'string' && !!value),
  ).size;

  return [
    {
      label: 'کل فرودگاه‌ها',
      value: total,
      icon: PlaneTakeoff,
      tone: 'sky',
    },
    {
      label: 'فرودگاه فعال',
      value: activeTotal,
      icon: CheckCircle2,
      tone: 'emerald',
    },
    {
      label: 'شهرهای مرتبط',
      value: coveredCities,
      icon: MapPin,
      tone: 'violet',
      hint: 'در صفحه جاری',
    },
    {
      label: 'ترمینال‌های مرتبط',
      value: currentPageTerminalTotal(records),
      icon: SquareStack,
      tone: 'amber',
      hint: 'در صفحه جاری',
    },
  ];
}
