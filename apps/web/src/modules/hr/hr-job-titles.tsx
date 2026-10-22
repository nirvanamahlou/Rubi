'use client';
import { useState } from 'react';
import type { HrRecordDto } from '@nora/contracts';
import { HrButton, HrConfirmDelete, HrPanel, HrStatus } from './hr-controls';
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
  return (
    <HrPanel
      title="عنوان‌های شغلی"
      actions={
        store.data!.capabilities.write ? (
          <HrButton primary onClick={() => onForm({ source })}>
            افزودن عنوان شغلی
          </HrButton>
        ) : null
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
      <div className={ui.tableScroll}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th>عنوان شغلی</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {titles
              .filter((title) =>
                normalizeHrText(title.name).includes(normalizeHrText(search)),
              )
              .map((title) => {
                const record = owned.find((r) => r.id === title.id);
                return (
                  <tr key={title.id}>
                    <td>{title.name}</td>
                    <td>
                      <HrStatus>{title.status}</HrStatus>
                    </td>
                    <td>
                      {store.data!.capabilities.write && record ? (
                        <div className={ui.actions}>
                          <HrButton onClick={() => onForm({ source, record })}>
                            ویرایش
                          </HrButton>
                          <HrButton onClick={() => setRemoving(record)}>
                            حذف
                          </HrButton>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
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
