'use client';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import type { TodayCallFilters } from './read-client';
import styles from './without-outcome-dialog.module.css';

export function TodayCallFilterControls({
  filters,
  destinations,
  onChange,
}: {
  filters: TodayCallFilters;
  destinations: readonly string[];
  onChange: (key: keyof TodayCallFilters, value: string) => void;
}) {
  const controls: {
    key: keyof TodayCallFilters;
    label: string;
    options: readonly (readonly [string, string])[];
  }[] = [
    {
      key: 'direction',
      label: 'جهت تماس',
      options: [
        ['INBOUND', 'ورودی'],
        ['OUTBOUND', 'خروجی'],
      ],
    },
    {
      key: 'outcome',
      label: 'نتیجه تماس',
      options: [
        ['ANSWERED', 'پاسخ داده شده'],
        ['NO_ANSWER', 'بدون پاسخ'],
        ['BUSY', 'مشغول'],
        ['FAILED', 'ناموفق'],
        ['WRONG_NUMBER', 'اشتباه گرفته شده'],
        ['UNKNOWN', 'نتیجه ثبت‌نشده'],
      ],
    },
    {
      key: 'unit',
      label: 'وصل شده به',
      options: [...new Set(['نامشخص', ...destinations])].map((value) => [
        value,
        value,
      ]),
    },
  ];
  return (
    <div
      className={styles.filters}
      role="group"
      aria-label="فیلترهای تماس‌های امروز"
    >
      {controls.map(({ key, label, options }) => (
        <label key={key} className={styles.filter}>
          <span>{label}</span>
          <NativeSearchSelect
            className={styles.filterControl}
            aria-label={label}
            value={filters[key]}
            optionLimit={Math.max(50, options.length + 1)}
            onChange={(event) => onChange(key, event.target.value)}
          >
            <option value="">همه موارد</option>
            {options.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </NativeSearchSelect>
        </label>
      ))}
    </div>
  );
}
