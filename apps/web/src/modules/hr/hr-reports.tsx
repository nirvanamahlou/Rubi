'use client';
import { NativeSearchSelect } from '@/components/ui/native-search-select';

import { useEffect, useState } from 'react';
import { HR_RADAN_CONTRACT_TYPES } from '@nora/contracts';
import {
  radanReports,
  unavailableRadanReports,
  buildRadanReport,
  emptyRadanFilters,
} from './radan-reports';
import { useHrReferenceData } from './hr-reference-data';
import type { HrRecordDto } from '@nora/contracts';
import { allHrRecords, type HrStore } from './hr-store';
import { hrGroups } from './hr-navigation';
import { recordsDataset } from './hr-live-data';
import { employeeDataset } from './hr-employees';
import {
  HrExportButton,
  HrPanel,
  HrPdfButton,
  HrRangeBar,
  HrTable,
} from './hr-controls';
import { HrAudit } from './hr-audit';
import ui from './hr-unified.module.css';
import { selectedHrDataset, useHrRowSelection } from './hr-row-selection';

export function HrReports({ store }: { store: HrStore }) {
  const [records, setRecords] = useState<HrRecordDto[]>([]);
  const [loadedRange, setLoadedRange] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [topic, setTopic] = useState('employees');
  const [filters, setFilters] = useState(emptyRadanFilters);
  const references = useHrReferenceData(store);
  const radan = topic.startsWith('radan:');
  const reportId = topic.slice(6);
  const unavailable = radan && unavailableRadanReports.has(reportId);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void allHrRecords({
      ...(range.from ? { from: range.from } : {}),
      ...(range.to ? { to: range.to } : {}),
    })
      .then((items) => {
        if (active) {
          setRecords(items);
          setLoadedRange(JSON.stringify(range));
          setError('');
        }
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'دریافت گزارش انجام نشد.');
      });
    return () => {
      active = false;
    };
  }, [range, store.revision]);
  const sources = Array.from(
    new Map(
      Object.values(hrGroups)
        .flatMap((groups) => groups.flatMap((group) => group.sources))
        .map((source) => [`${source.section}.${source.tab}`, source]),
    ).values(),
  );
  const source = sources.find(
    (item) => `${item.section}.${item.tab}` === topic,
  );
  const title = radan
    ? (radanReports.find(([id]) => id === reportId)?.[1] ?? 'گزارش کارکرد')
    : (source?.label ?? 'کارکنان');
  const selection = useHrRowSelection(JSON.stringify([topic, range, filters]));
  const currentRecords = loadedRange === JSON.stringify(range) ? records : [];
  const data = radan
    ? buildRadanReport(
        reportId,
        currentRecords,
        store.data!.employees,
        filters,
        references.data.records,
      )
    : source
      ? recordsDataset(source.section, source.tab, currentRecords)
      : employeeDataset(
          store.data!.employees.filter(
            (item) =>
              (!range.from || item.startedAtValue >= range.from) &&
              (!range.to || item.startedAtValue <= range.to),
          ),
          store.data!.branches,
        );
  return (
    <div className={ui.spaced}>
      <header className={ui.heading}>
        <h1>گزارش‌های منابع انسانی</h1>
      </header>
      <HrRangeBar
        onApply={(from, to) => setRange({ from, to })}
        actions={
          <>
            <HrExportButton
              data={selectedHrDataset(data, selection.selectedIds)}
              name={`hr-report-${topic}`}
            />
            <HrPdfButton
              data={selectedHrDataset(data, selection.selectedIds)}
              title={title}
            />
          </>
        }
      />
      <HrPanel title={title}>
        <div className={ui.filters}>
          <label>
            موضوع گزارش
            <NativeSearchSelect
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            >
              <option value="employees">کارکنان</option>
              <optgroup label="گزارش‌های حضور و غیاب">
                {radanReports.map(([id, label]) => (
                  <option key={id} value={`radan:${id}`}>
                    {label}
                  </option>
                ))}
              </optgroup>
              {sources.map((item) => (
                <option
                  value={`${item.section}.${item.tab}`}
                  key={`${item.section}.${item.tab}`}
                >
                  {item.label}
                </option>
              ))}
            </NativeSearchSelect>
          </label>
          {radan ? (
            <>
              <label>
                کارمند
                <NativeSearchSelect
                  value={filters.employeeId}
                  onChange={(e) =>
                    setFilters({ ...filters, employeeId: e.target.value })
                  }
                >
                  <option value="">همه کارکنان مجاز</option>
                  {store.data!.employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </NativeSearchSelect>
              </label>
              <label>
                گروه
                <NativeSearchSelect
                  value={filters.groupId}
                  onChange={(e) =>
                    setFilters({ ...filters, groupId: e.target.value })
                  }
                >
                  <option value="">همه گروه‌ها</option>
                  {references.data.records
                    .filter(
                      (r) =>
                        r.section === 'organization' &&
                        r.tab === 'groups' &&
                        !r.deletedAt &&
                        r.status === 'فعال',
                    )
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.values[0]}
                      </option>
                    ))}
                </NativeSearchSelect>
              </label>
              <label>
                نوع قرارداد
                <NativeSearchSelect
                  value={filters.contractType}
                  onChange={(e) =>
                    setFilters({ ...filters, contractType: e.target.value })
                  }
                >
                  <option value="">همه قراردادها</option>
                  {HR_RADAN_CONTRACT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </NativeSearchSelect>
              </label>
              <label>
                مرتب‌سازی بر اساس
                <NativeSearchSelect
                  value={filters.sort}
                  onChange={(e) =>
                    setFilters({ ...filters, sort: e.target.value })
                  }
                >
                  <option value="code">کد پرسنلی</option>
                  <option value="name">نام</option>
                  <option value="lastName">نام خانوادگی</option>
                </NativeSearchSelect>
              </label>
              <label>
                نوع گزارش
                <NativeSearchSelect
                  value={filters.unit}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      unit: e.target.value as 'clock' | 'minutes',
                    })
                  }
                >
                  <option value="clock">ساعت</option>
                  <option value="minutes">دقیقه</option>
                </NativeSearchSelect>
              </label>
              <label>
                <input
                  type="checkbox"
                  disabled={['leave', 'mission', 'remote', 'people'].includes(
                    reportId,
                  )}
                  checked={filters.aggregate}
                  onChange={(e) =>
                    setFilters({ ...filters, aggregate: e.target.checked })
                  }
                />
                به صورت مجموع
              </label>
            </>
          ) : null}
        </div>
        {unavailable ? (
          <p role="status">
            ساختار این گزارش مشاهده شد؛ منبع نتیجهٔ آن در این سامانه در دسترس
            نیست.
          </p>
        ) : null}
        {references.error ? <p role="alert">{references.error}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        {!references.loading && !references.error ? (
          <HrTable data={data} {...selection} />
        ) : (
          <p role="status">در حال دریافت گزینه‌ها…</p>
        )}
      </HrPanel>
      {store.data!.capabilities.audit ? <HrAudit store={store} /> : null}
    </div>
  );
}
