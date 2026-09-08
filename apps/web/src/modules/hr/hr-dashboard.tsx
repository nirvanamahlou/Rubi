'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { HrRecordDto } from '@rubi/contracts';
import { getHrResource } from '@rubi/contracts';
import { allHrRecords, type HrStore } from './hr-store';
import { HrButton, HrPanel, HrRangeBar, HrPdfButton } from './hr-controls';
import { hrCompanies } from './hr-live-data';
import { sourceForRecord } from './hr-unified-section';
import type { HrSource } from './hr-navigation';
import ui from './hr-unified.module.css';

export function HrDashboard({
  store,
  onSelect,
}: {
  store: HrStore;
  onSelect: (record: HrRecordDto, source: HrSource) => void;
}) {
  const [branch, setBranch] = useState('');
  const [unit, setUnit] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [records, setRecords] = useState<HrRecordDto[]>([]);
  const [error, setError] = useState('');
  const [now] = useState(() => new Date());
  useEffect(() => {
    let active = true;
    void allHrRecords({
      ...(branch ? { organizationBranchId: branch } : {}),
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
  }, [branch, range, store.revision]);
  const employees = store.data!.employees.filter(
    (item) =>
      (!branch || (item.organizationBranchId || item.branchId) === branch) &&
      (!unit || item.unit === unit),
  );
  const ids = new Set(employees.map((item) => item.id));
  const scoped = records.filter(
    (item) => !unit || Boolean(item.employeeId && ids.has(item.employeeId)),
  );
  const today = now.toISOString().slice(0, 10);
  const read = (record: HrRecordDto, label: string) =>
    record.values[record.columns.indexOf(label)] ?? '';
  const pending = scoped.filter(
    (item) =>
      getHrResource(item.section, item.tab)?.approval &&
      /انتظار|بررسی/.test(item.status),
  );
  const attendance = scoped.filter(
    (item) =>
      item.section === 'time' &&
      item.tab === 'attendance' &&
      read(item, 'تاریخ کارکرد') === today,
  );
  const expiring = scoped.filter(
    (item) =>
      item.section === 'contracts' &&
      item.tab === 'active' &&
      item.status === 'تأییدشده' &&
      item.data.contractState !== 'ENDED' &&
      Date.parse(read(item, 'تاریخ پایان')) >= now.getTime() &&
      Date.parse(read(item, 'تاریخ پایان')) <= now.getTime() + 30 * 86400000,
  );
  const leaves = scoped.filter(
    (item) =>
      item.section === 'time' &&
      item.tab === 'leave' &&
      item.status === 'تأییدشده' &&
      read(item, 'از تاریخ') <= today &&
      read(item, 'تا تاریخ') >= today,
  );
  const incomplete = employees.filter(
    (item) => !item.unit || !item.position || !item.grade,
  );
  const overtime = scoped
    .filter(
      (item) =>
        item.section === 'time' &&
        item.tab === 'overtime' &&
        item.status === 'تأییدشده',
    )
    .reduce((sum, item) => sum + Number(item.data.minutes ?? 0) / 60, 0);
  const metrics = [
    {
      label: 'کارکنان فعال',
      value: employees.filter((item) => item.status === 'فعال').length,
      href: '/hr?section=employees',
    },
    {
      label: 'حاضر امروز',
      value: attendance.filter((item) => Number(read(item, 'ساعت کارکرد')) > 0)
        .length,
      href: '/hr?section=time&tab=attendance',
    },
    {
      label: 'در مرخصی',
      value: leaves.length,
      href: '/hr?section=time&tab=leave',
    },
    {
      label: 'نیازمند رسیدگی',
      value: pending.length + incomplete.length,
      href: '/hr?section=requests',
    },
    {
      label: 'قرارداد نزدیک پایان',
      value: expiring.length,
      href: '/hr?section=contracts',
    },
    {
      label: 'درخواست در انتظار',
      value: pending.length,
      href: '/hr?section=requests',
    },
    {
      label: 'اضافه‌کاری مصوب',
      value: overtime,
      unit: 'ساعت',
      href: '/hr?section=time&tab=overtime',
    },
    {
      label: 'تکمیل پرونده کارکنان',
      value: employees.length
        ? Math.round(
            ((employees.length - incomplete.length) * 100) / employees.length,
          )
        : 0,
      unit: '٪',
      href: '/hr?section=employees',
    },
  ];
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + index, 1),
    );
    const end = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
    )
      .toISOString()
      .slice(0, 10);
    return {
      label: date.toLocaleDateString('fa-IR', {
        month: 'short',
        year: 'numeric',
      }),
      count: employees.filter((item) => item.startedAtValue < end).length,
    };
  });
  const max = Math.max(1, ...months.map((month) => month.count));
  return (
    <div className={ui.spaced}>
      <header className={ui.heading}>
        <div>
          <h1>داشبورد منابع انسانی</h1>
          <p>وضعیت کارکنان، کارکرد، قرارداد و درخواست‌ها در شرکت‌های مجاز</p>
        </div>
      </header>
      <HrRangeBar
        onApply={(from, to) => setRange({ from, to })}
        actions={
          <HrPdfButton
            title="نمای کلی منابع انسانی"
            data={{
              columns: ['شاخص', 'مقدار'],
              rows: metrics.map((item) => [
                item.label,
                String(item.value) + ' ' + (item.unit ?? ''),
              ]),
              totalLabel: '',
            }}
          />
        }
      />
      <HrPanel title="فیلتر داشبورد">
        <div className={ui.filters}>
          <label>
            شرکت / شعبه
            <select
              value={branch}
              onChange={(event) => {
                setBranch(event.target.value);
                setUnit('');
              }}
            >
              <option value="">همه شرکت‌ها</option>
              {hrCompanies(store.data!).map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            واحد
            <select
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            >
              <option value="">همه واحدها</option>
              {Array.from(
                new Set(
                  store
                    .data!.employees.filter(
                      (item) =>
                        !branch ||
                        (item.organizationBranchId || item.branchId) === branch,
                    )
                    .map((item) => item.unit),
                ),
              ).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <HrButton
            onClick={() => {
              setBranch('');
              setUnit('');
            }}
          >
            پاک‌کردن فیلتر
          </HrButton>
        </div>
      </HrPanel>
      {error ? (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      ) : null}
      <div className={ui.grid}>
        {metrics.map((item) => (
          <Link href={item.href} className={ui.card} key={item.label}>
            <span>{item.label}</span>
            <strong className={ui.metric}>
              {item.value.toLocaleString('fa-IR')} {item.unit}
            </strong>
          </Link>
        ))}
      </div>
      <div className={ui.twoColumns}>
        <HrPanel title="روند شروع همکاری کارکنان">
          <svg
            viewBox="0 0 600 210"
            role="img"
            aria-label="تعداد کارکنانی که تا هر ماه شروع به همکاری کرده‌اند"
          >
            <path
              d={`M 10 180 ${months.map((month, index) => `L ${10 + index * 52} ${180 - (month.count / max) * 145}`).join(' ')} L 582 180 Z`}
              fill="#e1efff"
            />
            <polyline
              points={months
                .map(
                  (month, index) =>
                    `${10 + index * 52},${180 - (month.count / max) * 145}`,
                )
                .join(' ')}
              stroke="#197bf0"
              fill="none"
              strokeWidth="3"
            />
            {months.map((month, index) => (
              <circle
                key={month.label}
                cx={10 + index * 52}
                cy={180 - (month.count / max) * 145}
                r="4"
                fill="#197bf0"
              >
                <title>
                  {month.label}: {month.count}
                </title>
              </circle>
            ))}
          </svg>
          <div className={ui.actions}>
            <span>{months[0]!.label}</span>
            <span style={{ marginInlineStart: 'auto' }}>
              {months.at(-1)!.label}
            </span>
          </div>
        </HrPanel>
        <HrPanel title="ترکیب کارکنان">
          <div className={ui.spaced}>
            {Array.from(new Set(employees.map((item) => item.kind))).map(
              (kind) => {
                const count = employees.filter(
                  (item) => item.kind === kind,
                ).length;
                return (
                  <div key={kind}>
                    <div className={ui.actions}>
                      <span>{kind}</span>
                      <strong style={{ marginInlineStart: 'auto' }}>
                        {count.toLocaleString('fa-IR')}
                      </strong>
                    </div>
                    <progress
                      value={count}
                      max={employees.length || 1}
                      style={{ width: '100%' }}
                      aria-label={kind}
                    />
                  </div>
                );
              },
            )}
          </div>
        </HrPanel>
      </div>
      <HrPanel title="نیازمند رسیدگی">
        <div className={ui.spaced}>
          {pending.slice(0, 10).map((record) => (
            <HrButton
              key={record.id}
              onClick={() => onSelect(record, sourceForRecord(record))}
            >
              {sourceForRecord(record).label} · {record.code}
            </HrButton>
          ))}
          {!pending.length ? (
            <p className={ui.muted}>درخواست در انتظاری وجود ندارد.</p>
          ) : null}
        </div>
      </HrPanel>
    </div>
  );
}
