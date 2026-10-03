import type { MasterDataRecord } from '@nora/contracts';
import {
  CheckCircle2,
  Globe2,
  MapPin,
  PlaneTakeoff,
  SquareStack,
  Wrench,
} from 'lucide-react';

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

export function currentPageMaintenanceTotal(
  records: readonly MasterDataRecord[],
): number {
  return records.filter(
    (record) => record.attributes.isUnderMaintenance === true,
  ).length;
}

export function terminalKpiItems(
  records: readonly MasterDataRecord[],
  total: number,
  activeTotal: number,
  internationalTotal: number,
): readonly MasterDataKpiItem[] {
  return [
    {
      label: 'کل ترمینال‌ها',
      value: total,
      icon: SquareStack,
      tone: 'sky',
    },
    {
      label: 'ترمینال فعال',
      value: activeTotal,
      icon: CheckCircle2,
      tone: 'emerald',
    },
    {
      label: 'بین‌المللی',
      value: internationalTotal,
      icon: Globe2,
      tone: 'violet',
    },
    {
      label: 'در حال تعمیرات',
      value: currentPageMaintenanceTotal(records),
      icon: Wrench,
      tone: 'amber',
      hint: 'در صفحه جاری',
    },
  ];
}

export function railTerminalKpiItems(
  records: readonly MasterDataRecord[],
  total: number,
  activeTotal: number,
): readonly MasterDataKpiItem[] {
  const linkedCities = new Set(
    records
      .map((record) => record.attributes.cityId)
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      ),
  ).size;
  const definedHours = records.filter((record) => {
    const mode = record.attributes.operatingHoursMode;
    return (
      mode === 'FULL_TIME' ||
      (mode === 'LIMITED' &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(
          String(record.attributes.opensAt ?? ''),
        ) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(
          String(record.attributes.closesAt ?? ''),
        ))
    );
  }).length;
  return [
    { label: 'کل ترمینال‌ها', value: total, icon: SquareStack, tone: 'sky' },
    {
      label: 'ترمینال فعال',
      value: activeTotal,
      icon: CheckCircle2,
      tone: 'emerald',
    },
    {
      label: 'شهرهای مرتبط',
      value: linkedCities,
      icon: MapPin,
      tone: 'violet',
      hint: 'در صفحه جاری',
    },
    {
      label: 'ساعت فعالیت تعریف‌شده',
      value: definedHours,
      icon: SquareStack,
      tone: 'amber',
      hint: 'در صفحه جاری',
    },
  ];
}
