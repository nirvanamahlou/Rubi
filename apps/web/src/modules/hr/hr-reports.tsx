'use client';
import { DatePicker } from '@/components/ui/date-picker';
import { HrButton } from './hr-controls';
import { RequiredFieldLabel } from './required-field-label';
import { NativeSearchSelect } from '@/components/ui/native-search-select';

import { useEffect, useState } from 'react';
import { HR_RADAN_CONTRACT_TYPES, HR_RADAN_LEAVE_TYPES } from '@nora/contracts';
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
  const [draftRange, setDraftRange] = useState({ from: '', to: '' });
  const [topic, setTopic] = useState('employees');
  const [filters, setFilters] = useState(emptyRadanFilters);
  const [coefficients, setCoefficients] = useState<string[]>([]);
  const [peopleFields, setPeopleFields] = useState<string[]>([]);
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
  const reportReady =
    !radan ||
    (Boolean(range.to) &&
      (['people', 'incompleteDetail', 'presence'].includes(reportId) ||
        Boolean(range.from)) &&
      (![
        'remote',
        'dailyMinutes',
        'totalMinutes',
        'present',
        'forgiveness',
        'arpa',
      ].includes(reportId) ||
        Boolean(filters.employeeId && filters.groupId)));
  const currentRecords =
    reportReady && loadedRange === JSON.stringify(range) ? records : [];
  const baseData = radan
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
  const coefficientOptions = [
    'کارکرد',
    'اضافه‌کار / ساعتی / اول وقت',
    'اضافه‌کار / ساعتی / آخر وقت',
    'اضافه‌کار / ساعتی / خارج وقت',
    'اضافه‌کار / ساعتی / در مرخصی',
    'اضافه‌کار / ساعتی / در مأموریت',
    'اضافه‌کار غیرمجاز / اول وقت',
    'اضافه‌کار غیرمجاز / آخر وقت',
    'اضافه‌کار غیرمجاز / خارج وقت',
    'اضافه‌کار روز تعطیل',
    ...HR_RADAN_LEAVE_TYPES.map((t) => `مرخصی / روزانه / ${t}`),
    ...HR_RADAN_LEAVE_TYPES.slice(0, 4).map((t) => `مرخصی / ساعتی / ${t}`),
    'مأموریت / روزانه / درون‌شهری',
    'مأموریت / روزانه / برون‌شهری',
    'مأموریت / روزانه / برون‌کشوری',
    'مأموریت / ساعتی / درون‌شهری',
    'مأموریت / ساعتی / برون‌شهری',
    'فرجه',
    'شناوری',
    'شب‌کاری',
    'جمعه‌کاری',
    'تأخیر',
    'تعجیل',
    'غیبت / روزانه',
    'غیبت / ساعتی',
    'تأخیر سرویس',
    'دورکاری',
    'ساعت ناهاری',
    'گرد کردن ساعت کاری',
    'نوبت‌کاری / ۱۰ درصد',
    'نوبت‌کاری / ۱۵ درصد',
    'نوبت‌کاری / ۲۲٫۵ درصد',
  ];
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
    radan && reportId === 'general' && coefficients.length
      ? {
          ...baseData,
          columns: ['کارمند', ...coefficients],
          rows: baseData.rows.map((row) => [
            row[baseData.columns.indexOf('کارمند')] ?? '—',
            ...coefficients.map(
              (label) => row[baseData.columns.indexOf(label)] ?? '—',
            ),
          ]),
        }
      : radan && reportId === 'people' && peopleFields.length
        ? {
            ...baseData,
            columns: [...baseData.columns, ...peopleFields],
            rows: baseData.rows.map((row, index) => {
              const employeeId = baseData.recordIds?.[index],
                employee = store.data!.employees.find(
                  (e) => e.id === employeeId,
                );
              const own = references.data.records.filter(
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
                            r.tab === 'patternAssignments' &&
                            r.status === 'فعال',
                        )
                        .map(
                          (r) =>
                            references.data.records.find(
                              (p) => p.id === r.parentId,
                            )?.values[0],
                        )
                        .filter(Boolean)
                        .join('، ') || '—'
                    );
                  if (label === 'تنظیمات')
                    return (
                      references.data.records.find(
                        (r) =>
                          r.branchId === employee?.branchId &&
                          r.tab === 'calculationSettings' &&
                          r.status === 'فعال',
                      )?.values[0] ?? '—'
                    );
                  if (label === 'سیاست')
                    return (
                      references.data.records
                        .filter(
                          (r) =>
                            r.branchId === employee?.branchId &&
                            r.tab === 'leavePolicies' &&
                            r.status === 'فعال',
                        )
                        .map((r) => r.values[0])
                        .join('، ') || '—'
                    );
                  const last = own
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
  return (
    <div className={ui.spaced}>
      <header className={ui.heading}>
        <h1>گزارش‌های منابع انسانی</h1>
      </header>
      <div className={ui.filters}>
        {reportId !== 'presence' ? (
          <label>
            <RequiredFieldLabel
              required={
                radan && !['people', 'incompleteDetail'].includes(reportId)
              }
            >
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
              (!draftRange.to ||
                (!['people', 'incompleteDetail', 'presence'].includes(
                  reportId,
                ) &&
                  !draftRange.from))
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
              onChange={(event) => {
                setTopic(event.target.value);
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
              {reportId === 'general' ? (
                <label>
                  ضرایب
                  <select
                    multiple
                    value={coefficients}
                    onChange={(e) =>
                      setCoefficients(
                        Array.from(e.target.selectedOptions, (o) => o.value),
                      )
                    }
                  >
                    {coefficientOptions.map((label) => (
                      <option key={label}>{label}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {reportId === 'people' ? (
                <label>
                  ستون‌های افراد
                  <select
                    multiple
                    value={peopleFields}
                    onChange={(e) =>
                      setPeopleFields(
                        Array.from(e.target.selectedOptions, (o) => o.value),
                      )
                    }
                  >
                    {optionalPeople.map((label) => (
                      <option key={label}>{label}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {['general', 'total'].includes(reportId) ? (
                <>
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
                </>
              ) : null}
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
                      unit: e.target.value as
                        'clock' | 'minutes' | 'days' | 'default',
                    })
                  }
                >
                  <option value="default">پیش‌فرض</option>
                  <option value="clock">ساعت</option>
                  {reportId === 'total' ? (
                    <option value="days">روز</option>
                  ) : null}
                  <option value="minutes">دقیقه</option>
                </NativeSearchSelect>
              </label>
              {[
                'late',
                'early',
                'absence',
                'mission',
                'leave',
                'overtime',
              ].includes(reportId) ? (
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
        {references.error ? <p role="alert">{references.error}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        {!references.loading && !references.error ? (
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
