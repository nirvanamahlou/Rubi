'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { DatePicker } from '@/components/ui/date-picker';
import { assistantCopy as c, type AssistantText } from '@/i18n/assistant-copy';
import type { AssistantReportFilters } from './model';
import styles from './executive-workspace.module.css';

const option = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(200),
});
export const filterOptionsSchema = z.object({
  version: z.literal(2),
  source: z.literal('sales.assistant.filter-options.v2'),
  observedAt: z.iso.datetime(),
  cities: z.array(option).max(1000),
  branches: z.array(option).max(1000),
  incomplete: z.boolean(),
});

export function AssistantReportFilterControls({
  value,
  onChange,
  disabled,
  t,
}: {
  value: AssistantReportFilters | undefined;
  onChange: (filters: AssistantReportFilters | undefined) => void;
  disabled: boolean;
  t: (text: AssistantText) => string;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<z.infer<
    typeof filterOptionsSchema
  > | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open || disabled) return;
    const controller = new AbortController();
    void fetch('/api/assistant/v2/filter-options', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('OPTIONS_UNAVAILABLE');
        return filterOptionsSchema.parse(await response.json());
      })
      .then((result) => {
        if (!controller.signal.aborted) {
          setOptions(result);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [open, disabled]);
  const update = (key: keyof AssistantReportFilters, next: string) => {
    const result = { ...value };
    if (next) result[key] = next;
    else delete result[key];
    onChange(Object.keys(result).length ? result : undefined);
  };
  return (
    <details
      className={styles.reportFilters}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{t(c.reportFilters)}</summary>
      <p>{t(c.filterHelp)}</p>
      <div className={styles.reportFilterGrid}>
        <label>
          {t(c.filterStart)}
          <DatePicker
            calendarSystem="persian"
            placeholder={t(c.filterAll)}
            value={value?.startDate ?? ''}
            onChange={(date) => update('startDate', date)}
            disabled={disabled}
            aria-label={t(c.filterStart)}
          />
        </label>
        <label>
          {t(c.filterEnd)}
          <DatePicker
            calendarSystem="persian"
            placeholder={t(c.filterAll)}
            value={value?.endDate ?? ''}
            onChange={(date) => update('endDate', date)}
            disabled={disabled}
            aria-label={t(c.filterEnd)}
          />
        </label>
        {(['originId', 'destinationId', 'branchId'] as const).map((key) => (
          <label key={key}>
            {t(
              key === 'originId'
                ? c.filterOrigin
                : key === 'destinationId'
                  ? c.filterDestination
                  : c.filterBranch,
            )}
            <select
              value={value?.[key] ?? ''}
              disabled={disabled || !options || failed}
              onChange={(event) => update(key, event.target.value)}
            >
              <option value="">{t(c.filterAll)}</option>
              {(key === 'branchId' ? options?.branches : options?.cities)?.map(
                (item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ),
              )}
            </select>
          </label>
        ))}
      </div>
      {failed && <p role="status">{t(c.filterOptionsUnavailable)}</p>}
      {options?.incomplete && (
        <p role="status">{t(c.filterOptionsIncomplete)}</p>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(undefined)}
      >
        {t(c.filterReset)}
      </button>
    </details>
  );
}
