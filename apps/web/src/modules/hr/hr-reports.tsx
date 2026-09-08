'use client';
import { useEffect, useState } from 'react';
import type { HrRecordDto } from '@rubi/contracts';
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

export function HrReports({ store }: { store: HrStore }) {
  const [records, setRecords] = useState<HrRecordDto[]>([]);
  const [range, setRange] = useState({ from: '', to: '' });
  const [topic, setTopic] = useState('employees');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void allHrRecords({
      ...(range.from ? { from: range.from } : {}),
      ...(range.to ? { to: range.to } : {}),
    })
      .then((items) => {
        if (active) setRecords(items);
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
  const title = source?.label ?? 'کارکنان';
  const data = source
    ? recordsDataset(source.section, source.tab, records)
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
            <HrExportButton data={data} name={`hr-report-${topic}`} />
            <HrPdfButton data={data} title={title} />
          </>
        }
      />
      <HrPanel title={title}>
        <div className={ui.filters}>
          <label>
            موضوع گزارش
            <select
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            >
              <option value="employees">کارکنان</option>
              {sources.map((item) => (
                <option
                  value={`${item.section}.${item.tab}`}
                  key={`${item.section}.${item.tab}`}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <HrTable data={data} />
      </HrPanel>
      {store.data!.capabilities.audit ? <HrAudit store={store} /> : null}
    </div>
  );
}
