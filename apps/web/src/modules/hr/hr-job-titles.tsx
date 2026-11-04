'use client';
import { useState } from 'react';
import type { HrRecordDto } from '@nora/contracts';
import {
  HrButton,
  HrConfirmDelete,
  HrPanel,
  HrTable,
  HrExportButton,
  HrPdfButton,
} from './hr-controls';
import { useHrReferenceData } from './hr-reference-data';
import type { HrStore } from './hr-store';
import type { HrSource } from './hr-navigation';
import type { HrFormTarget } from './hr-record-form';
import { normalizeHrText } from './hr-data-utils';
import ui from './hr-unified.module.css';

export function HrJobTitles({
  store,
  onForm,
}: {
  store: HrStore;
  onForm: (target: HrFormTarget) => void;
}) {
  const references = useHrReferenceData(store);
  const [search, setSearch] = useState('');
  const [removing, setRemoving] = useState<HrRecordDto | null>(null);
  const source: HrSource = {
    section: 'organization',
    tab: 'positions',
    label: 'عنوان‌های شغلی',
    action: 'افزودن عنوان شغلی',
  };
  const owned = references.data.records.filter(
    (r) =>
      r.section === 'organization' && r.tab === 'positions' && !r.deletedAt,
  );
  const titles =
    store.data!.jobTitles ??
    owned.map((r) => ({
      id: r.id,
      name: r.values[1] || r.values[0] || '',
      status: r.status,
    }));
  const filtered = titles.filter((title) =>
    normalizeHrText(title.name).includes(normalizeHrText(search)),
  );
  const dataset = {
    columns: ['عنوان شغلی', 'وضعیت'],
    rows: filtered.map((title) => [title.name, title.status]),
    recordIds: filtered.map((title) => title.id),
    totalLabel: '',
  };
  return (
    <HrPanel
      title="عنوان‌های شغلی"
      actions={
        <>
          <HrExportButton data={dataset} name="hr-job-titles" />
          <HrPdfButton data={dataset} title="عنوان‌های شغلی" />
          {store.data!.capabilities.write ? (
            <HrButton primary onClick={() => onForm({ source })}>
              افزودن عنوان شغلی
            </HrButton>
          ) : null}
        </>
      }
    >
      <label className={ui.field}>
        جست‌وجو
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {references.error ? <p role="alert">{references.error}</p> : null}
      <HrTable
        data={dataset}
        {...(store.data!.capabilities.write
          ? {
              rowActions: (index: number) => {
                const title = filtered[index]!;
                const record = owned.find((r) => r.id === title.id);
                return record ? (
                  <>
                    <HrButton
                      aria-label={`ویرایش ${title.name}`}
                      onClick={() => onForm({ source, record })}
                    >
                      ویرایش
                    </HrButton>
                    <HrButton
                      aria-label={`حذف ${title.name}`}
                      onClick={() => setRemoving(record)}
                    >
                      حذف
                    </HrButton>
                  </>
                ) : null;
              },
            }
          : {})}
      />
      {removing ? (
        <HrConfirmDelete
          title={removing.values[1] || removing.values[0] || removing.code}
          onClose={() => setRemoving(null)}
          onConfirm={() => store.remove(removing)}
        />
      ) : null}
    </HrPanel>
  );
}
