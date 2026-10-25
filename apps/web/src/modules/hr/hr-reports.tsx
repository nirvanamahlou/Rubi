'use client';
import { DatePicker } from '@/components/ui/date-picker';
import { HrButton } from './hr-controls';
import { RequiredFieldLabel } from './required-field-label';
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
import { hrRequest } from './hr-api';
import { HrReportPeoplePicker } from './hr-report-people-picker';
import { HrReportChoices, HrCoefficientTree } from './hr-report-choices';
import {
  radanReportForm,
  radanDefaultReportRange,
  radanCoefficientTree,
  coefficientPaths,
} from './radan-report-fields';
import type {
  HrEmployeeDto,
  HrAttendanceReportSnapshotDto,
  HrRecordDto,
} from '@nora/contracts';
import { allHrRecords, type HrStore } from './hr-store';
import { employeeGroups, hrGroups } from './hr-navigation';
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

export function HrReports({
  store,
  initialTopic = 'employees',
}: {
  store: HrStore;
  initialTopic?: string;
}) {
  const [records, setRecords] = useState<HrRecordDto[]>([]);
  const [loadedRange, setLoadedRange] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [draftRange, setDraftRange] = useState(() =>
    radanDefaultReportRange(initialTopic.slice(6)),
  );
  const [topic, setTopic] = useState(initialTopic);
  const [filters, setFilters] = useState(emptyRadanFilters);
  const [coefficients, setCoefficients] = useState<string[]>([]);
  const [peopleFields, setPeopleFields] = useState<string[]>([]);
  const references = useHrReferenceData(store, !topic.startsWith('radan:'));
  const radan = topic.startsWith('radan:');
  const reportId = topic.slice(6);
  const unavailable = radan && unavailableRadanReports.has(reportId);
  const [error, setError] = useState('');
  const [snapshotEmployees, setSnapshotEmployees] = useState<HrEmployeeDto[]>(
    [],
  );
  const [snapshotReferences, setSnapshotReferences] = useState<HrRecordDto[]>(
    [],
  );
  const form = radanReportForm(reportId);
  const requestKey = JSON.stringify([range, store.revision, radan]);
  useEffect(() => {
    let active = true;
    const query = {
      ...(range.from ? { from: range.from } : {}),
      ...(range.to ? { to: range.to } : {}),
    };
    const load = async () => {
      try {
        if (radan) {
          const snapshot = await hrRequest<HrAttendanceReportSnapshotDto>(
            `/reports/attendance-data?${new URLSearchParams(query)}`,
          );
          if (!active) return;
          setRecords(snapshot.records);
          setSnapshotEmployees(snapshot.employees);
          setSnapshotReferences(snapshot.references);
        } else {
          const items = await allHrRecords(query);
          if (!active) return;
          setRecords(items);
        }
        setLoadedRange(requestKey);
        setError('');
      } catch (e) {
        if (active) {
          setLoadedRange('');
          setRecords([]);
          setSnapshotEmployees([]);
          setSnapshotReferences([]);
          setError(e instanceof Error ? e.message : 'دریافت گزارش انجام نشد.');
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [range, store.revision, radan, requestKey]);
  const people = radan ? snapshotEmployees : store.data!.employees;
  const referenceRecords = radan ? snapshotReferences : references.data.records;
  const groupOptions = referenceRecords
    .filter(
      (record) =>
        record.section === 'organization' &&
        record.tab === 'groups' &&
        record.status === 'فعال' &&
        !record.deletedAt,
    )
    .map((record) => ({
      id: record.id,
      label: record.values[0] ?? record.code,
    }));
  const sources = Array.from(
    new Map(
      [
        ...Object.values(hrGroups).flatMap((groups) =>
          groups.flatMap((group) => group.sources),
        ),
        ...employeeGroups
          .flatMap((group) => group.sources)
          .filter((source) => source.section !== 'employee'),
      ].map((source) => [`${source.section}.${source.tab}`, source]),
    ).values(),
  );
  const source = sources.find(
    (item) => `${item.section}.${item.tab}` === topic,
  );
  const title = radan
    ? (radanReports.find(([id]) => id === reportId)?.[1] ?? 'گزارش کارکرد')
    : (source?.label ?? 'کارکنان');
  const selection = useHrRowSelection(
    JSON.stringify([
      topic,
      range,
      filters,
      coefficients,
      peopleFields,
      store.revision,
    ]),
  );
  const reportReady =
    !radan ||
    (Boolean(range.to) &&
      (!form.requiredFrom || Boolean(range.from)) &&
      (!form.requiredGroups ||
        filters.groupIds === undefined ||
        filters.groupIds.length > 0));
  const currentRecords =
    reportReady && loadedRange === requestKey ? records : [];
  const baseData = radan
    ? buildRadanReport(
        reportId,
        currentRecords,
        people,
        { ...filters, coefficients, from: range.from, to: range.to },
        referenceRecords,
      )
    : source
      ? recordsDataset(source.section, source.tab, currentRecords)
      : employeeDataset(
          people.filter(
            (item) =>
              (!range.from || item.startedAtValue >= range.from) &&
              (!range.to || item.startedAtValue <= range.to),
          ),
          store.data!.branches,
        );
  const optionalPeople = [
    'نقش',
    'شیفت',
    'تنظیمات',
    'الگو',
    'سیاست',
    'آخرین تردد',
    'نام دستگاه',
  ];
  const data =
    radan && reportId === 'people' && peopleFields.length
      ? {
          ...baseData,
          columns: [...baseData.columns, ...peopleFields],
          rows: baseData.rows.map((row, index) => {
            const employeeId = baseData.recordIds?.[index],
              employee = people.find((e) => e.id === employeeId);
            const own = referenceRecords.filter(
              (r) => r.employeeId === employeeId && !r.deletedAt,
            );
            return [
              ...row,
              ...peopleFields.map((label) => {
                if (label === 'شیفت')
                  return (
                    own
                      .filter((r) => r.tab === 'shift' && r.status === 'فعال')
                      .map((r) => r.values[0])
                      .join('، ') || '—'
                  );
                if (label === 'الگو')
                  return (
                    own
                      .filter(
                        (r) =>
                          r.tab === 'patternAssignments' && r.status === 'فعال',
                      )
                      .map(
                        (r) =>
                          referenceRecords.find((p) => p.id === r.parentId)
                            ?.values[0],
                      )
                      .filter(Boolean)
                      .join('، ') || '—'
                  );
                if (label === 'تنظیمات')
                  return (
                    referenceRecords.find(
                      (r) =>
                        r.branchId === employee?.branchId &&
                        r.tab === 'calculationSettings' &&
                        r.status === 'فعال',
                    )?.values[0] ?? '—'
                  );
                if (label === 'سیاست')
                  return (
                    referenceRecords
                      .filter(
                        (r) =>
                          r.branchId === employee?.branchId &&
                          r.tab === 'leavePolicies' &&
                          r.status === 'فعال',
                      )
                      .map((r) => r.values[0])
                      .join('، ') || '—'
                  );
                const last = currentRecords
                  .filter((record) => record.employeeId === employeeId)
                  .filter((r) => r.tab === 'checkins')
                  .sort((a, b) =>
                    (b.data.startsAt ?? '').localeCompare(
                      a.data.startsAt ?? '',
                    ),
                  )[0];
                if (label === 'آخرین تردد') return last?.data.startsAt ?? '—';
                if (label === 'نام دستگاه')
                  return last?.values[last.columns.indexOf('دستگاه')] ?? '—';
                return '—';
              }),
            ];
          }),
        }
      : baseData;
  const exportData = radan
    ? reportReady && loadedRange === requestKey
      ? data
      : { ...data, rows: [] }
    : selectedHrDataset(data, selection.selectedIds);
  return (
    <div className={ui.spaced}>
      <header className={ui.heading}>
        <h1>گزارش‌های منابع انسانی</h1>
      </header>
      <div className={ui.filters}>
        {!radan || form.from ? (
          <label>
            <RequiredFieldLabel required={radan && form.requiredFrom}>
              از تاریخ
            </RequiredFieldLabel>
            <DatePicker
              value={draftRange.from}
              onChange={(from) => setDraftRange({ ...draftRange, from })}
            />
          </label>
        ) : null}
        <label>
          <RequiredFieldLabel required={radan}>
            {reportId === 'presence' ? 'تاریخ' : 'تا تاریخ'}
          </RequiredFieldLabel>
          <DatePicker
            value={draftRange.to}
            onChange={(to) => setDraftRange({ ...draftRange, to })}
          />
        </label>
        <HrButton
          onClick={() => {
            if (
              radan &&
              (!draftRange.to || (form.requiredFrom && !draftRange.from))
            ) {
              setError('بازه تاریخ گزارش را تکمیل کنید.');
              return;
            }
            if (
              draftRange.from &&
              draftRange.to &&
              draftRange.from > draftRange.to
            ) {
              setError('پایان باید پس از شروع باشد.');
              return;
            }
            setError('');
            setRange(
              reportId === 'presence'
                ? { from: draftRange.to, to: draftRange.to }
                : draftRange,
            );
          }}
        >
          گرفتن گزارش
        </HrButton>
        <HrButton
          onClick={() => {
            setDraftRange({ from: '', to: '' });
            setRange({ from: '', to: '' });
            setFilters(emptyRadanFilters);
            setCoefficients([]);
            setPeopleFields([]);
          }}
        >
          بازنشانی
        </HrButton>
      </div>
      <HrRangeBar
        onApply={(from, to) => setRange({ from, to })}
        actions={
          <>
            <HrExportButton data={exportData} name={`hr-report-${topic}`} />
            <HrPdfButton data={exportData} title={title} />
          </>
        }
      />
      <HrPanel title={title}>
        <div className={ui.filters}>
          <label>
            موضوع گزارش
            <NativeSearchSelect
              value={topic}
              onChange={(event) => {
                setTopic(event.target.value);
                setDraftRange(
                  radanDefaultReportRange(event.target.value.slice(6)),
                );
                setRange({ from: '', to: '' });
                setFilters(emptyRadanFilters);
                setCoefficients([]);
                setPeopleFields([]);
              }}
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
              <HrReportPeoplePicker
                people={people}
                value={filters.employeeIds ?? []}
                disabled={loadedRange !== requestKey}
                onChange={(employeeIds) =>
                  setFilters({ ...filters, employeeIds })
                }
              />
              <HrReportChoices
                title="گروه‌ها"
                required={form.requiredGroups}
                options={groupOptions}
                value={
                  filters.groupIds ?? groupOptions.map((group) => group.id)
                }
                onChange={(groupIds) => {
                  const next = { ...filters };
                  if (groupIds.length === groupOptions.length)
                    delete next.groupIds;
                  else next.groupIds = groupIds;
                  setFilters(next);
                }}
              />
              {form.coefficients ? (
                <fieldset className={ui.reportChoices}>
                  <legend>ضرایب</legend>
                  <label>
                    <input
                      type="checkbox"
                      checked={
                        coefficients.length === coefficientPaths().length
                      }
                      onChange={(e) =>
                        setCoefficients(
                          e.target.checked ? coefficientPaths() : [],
                        )
                      }
                    />
                    همه ({coefficientPaths().length} / {coefficients.length})
                  </label>
                  <HrCoefficientTree
                    nodes={radanCoefficientTree}
                    value={coefficients}
                    onChange={setCoefficients}
                  />
                </fieldset>
              ) : null}
              {form.peopleFields ? (
                <HrReportChoices
                  title="ستون‌های افراد"
                  options={optionalPeople.map((label) => ({
                    id: label,
                    label,
                  }))}
                  value={peopleFields}
                  onChange={setPeopleFields}
                />
              ) : null}
              {form.contractTypes ? (
                <HrReportChoices
                  title="نوع قرارداد"
                  options={HR_RADAN_CONTRACT_TYPES.map((label) => ({
                    id: label,
                    label,
                  }))}
                  value={filters.contractTypes ?? []}
                  onChange={(contractTypes) =>
                    setFilters({ ...filters, contractTypes })
                  }
                />
              ) : null}
              {form.sortOptions.length ? (
                <label>
                  مرتب‌سازی بر اساس
                  <NativeSearchSelect
                    value={filters.sort}
                    onChange={(event) =>
                      setFilters({ ...filters, sort: event.target.value })
                    }
                  >
                    {form.sortOptions.map((value) => (
                      <option key={value} value={value}>
                        {
                          (
                            {
                              code: 'کد پرسنلی',
                              name: 'نام',
                              lastName: 'نام خانوادگی',
                              identification: 'کد شناسایی',
                            } as Record<string, string>
                          )[value]
                        }
                      </option>
                    ))}
                  </NativeSearchSelect>
                </label>
              ) : null}
              {form.units.length ? (
                <label>
                  نوع گزارش
                  <NativeSearchSelect
                    value={
                      filters.unit === 'minutes' ? 'default' : filters.unit
                    }
                    onChange={(event) =>
                      setFilters({
                        ...filters,
                        unit: event.target.value as
                          'clock' | 'days' | 'default',
                      })
                    }
                  >
                    <option value="default">پیش فرض</option>
                    <option value="clock">ساعت</option>
                    <option value="days">روز</option>
                  </NativeSearchSelect>
                </label>
              ) : null}
              {form.aggregate ? (
                <>
                  <label>
                    <input
                      type="checkbox"
                      disabled={['people'].includes(reportId)}
                      checked={filters.aggregate}
                      onChange={(e) =>
                        setFilters({ ...filters, aggregate: e.target.checked })
                      }
                    />
                    به صورت مجموع
                  </label>
                </>
              ) : null}
            </>
          ) : null}
        </div>
        {unavailable ? (
          <p role="status">
            ساختار این گزارش مشاهده شد؛ منبع نتیجهٔ آن در این سامانه در دسترس
            نیست.
          </p>
        ) : null}
        {!radan && references.error ? (
          <p role="alert">{references.error}</p>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
        {(
          radan
            ? loadedRange === requestKey
            : !references.loading && !references.error
        ) ? (
          <>
            {!reportReady ? (
              <p role="status">
                تاریخ و انتخاب‌های اجباری گزارش را تکمیل کنید.
              </p>
            ) : null}
            <HrTable
              data={reportReady ? data : { ...data, rows: [] }}
              {...selection}
            />
          </>
        ) : (
          <p role="status">در حال دریافت گزینه‌ها…</p>
        )}
      </HrPanel>
      {store.data!.capabilities.audit ? <HrAudit store={store} /> : null}
    </div>
  );
}
