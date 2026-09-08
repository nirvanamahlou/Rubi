'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarCheck2,
  CalendarDays,
  CircleAlert,
  ClipboardList,
  Clock3,
  FileClock,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import type { HrRecordDto } from '@rubi/contracts';
import { getHrResource } from '@rubi/contracts';
import { allHrRecords, type HrStore } from './hr-store';
import {
  HrButton,
  HrEmpty,
  HrLoading,
  HrPanel,
  HrRangeBar,
  HrPdfButton,
  HrStatus,
} from './hr-controls';
import { hrCompanies } from './hr-live-data';
import { sourceForRecord } from './hr-record-source';
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
  const queryKey = JSON.stringify([
    branch,
    range.from,
    range.to,
    store.revision,
  ]);
  const [report, setReport] = useState<{
    key: string;
    records: HrRecordDto[];
    error: string;
  } | null>(null);
  const loading = report?.key !== queryKey;
  const records = loading ? [] : (report?.records ?? []);
  const error = loading ? '' : (report?.error ?? '');
  const [now] = useState(() => new Date());
  useEffect(() => {
    let active = true;
    void allHrRecords({
      ...(branch ? { organizationBranchId: branch } : {}),
      ...(range.from ? { from: range.from } : {}),
      ...(range.to ? { to: range.to } : {}),
    })
      .then((items) => {
        if (active) setReport({ key: queryKey, records: items, error: '' });
      })
      .catch((e) => {
        if (active)
          setReport({
            key: queryKey,
            records: [],
            error: e instanceof Error ? e.message : 'دریافت گزارش انجام نشد.',
          });
      });
    return () => {
      active = false;
    };
  }, [branch, range.from, range.to, queryKey]);
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
      icon: UsersRound,
      tone: 'blue',
      value: employees.filter((item) => item.status === 'فعال').length,
      href: '/hr?section=employees',
    },
    {
      label: 'حاضر امروز',
      icon: CalendarCheck2,
      tone: 'success',
      value: attendance.filter((item) => Number(read(item, 'ساعت کارکرد')) > 0)
        .length,
      href: '/hr?section=time&tab=attendance',
    },
    {
      label: 'در مرخصی',
      icon: CalendarDays,
      tone: 'violet',
      value: leaves.length,
      href: '/hr?section=time&tab=leave',
    },
    {
      label: 'نیازمند رسیدگی',
      icon: CircleAlert,
      tone: 'warning',
      value: pending.length + incomplete.length,
      href: '/hr?section=requests',
    },
    {
      label: 'قرارداد نزدیک پایان',
      icon: FileClock,
      tone: 'warning',
      value: expiring.length,
      href: '/hr?section=contracts',
    },
    {
      label: 'درخواست در انتظار',
      icon: ClipboardList,
      tone: 'blue',
      value: pending.length,
      href: '/hr?section=requests',
    },
    {
      label: 'اضافه‌کاری مصوب',
      icon: Clock3,
      tone: 'violet',
      value: overtime,
      unit: 'ساعت',
      href: '/hr?section=time&tab=overtime',
    },
    {
      label: 'تکمیل پرونده کارکنان',
      icon: ShieldCheck,
      tone: 'success',
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
            disabled={loading || Boolean(error)}
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
      >
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
      </HrRangeBar>
      {error ? (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      ) : null}
      <div className={ui.metricsGrid} aria-busy={loading}>
        {metrics.map((item) => (
          <Link href={item.href} className={ui.metricCard} key={item.label}>
            <span className={ui.metricIcon} data-tone={item.tone}>
              <item.icon size={23} aria-hidden="true" />
            </span>
            <div>
              <small>{item.label}</small>
              <strong>
                {loading || error ? '—' : item.value.toLocaleString('fa-IR')}
                <span>{item.unit}</span>
              </strong>
            </div>
          </Link>
        ))}
      </div>
      <div className={ui.twoColumns}>
        <HrPanel
          title="روند شروع همکاری کارکنان"
          description="۱۲ ماه گذشته؛ تعداد تجمعی شروع همکاری"
        >
          <svg
            className={ui.chart}
            viewBox="0 0 600 210"
            role="img"
            aria-label="تعداد کارکنانی که تا هر ماه شروع به همکاری کرده‌اند"
          >
            {[35, 107, 180].map((y) => (
              <line
                key={y}
                x1="10"
                x2="582"
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="4 4"
              />
            ))}
            <path
              d={`M 10 180 ${months.map((month, index) => `L ${10 + index * 52} ${180 - (month.count / max) * 145}`).join(' ')} L 582 180 Z`}
              fill="var(--secondary)"
            />
            <polyline
              points={months
                .map(
                  (month, index) =>
                    `${10 + index * 52},${180 - (month.count / max) * 145}`,
                )
                .join(' ')}
              stroke="var(--primary)"
              fill="none"
              strokeWidth="3"
            />
            {months.map((month, index) => (
              <circle
                key={month.label}
                cx={10 + index * 52}
                cy={180 - (month.count / max) * 145}
                r="4"
                fill="var(--surface)"
                stroke="var(--primary)"
                strokeWidth="2"
              >
                <title>
                  {month.label}: {month.count}
                </title>
              </circle>
            ))}
          </svg>
          <div className={ui.actions} dir="ltr">
            <span dir="rtl">{months[0]!.label}</span>
            <span dir="rtl" style={{ marginLeft: 'auto' }}>
              {months.at(-1)!.label}
            </span>
          </div>
        </HrPanel>
        <HrPanel
          title="ترکیب کارکنان"
          description="توزیع کارکنان بر اساس نوع همکاری"
        >
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
                      className={ui.progress}
                      value={count}
                      max={employees.length || 1}
                      aria-label={kind}
                    />
                  </div>
                );
              },
            )}
          </div>
        </HrPanel>
      </div>
      <HrPanel
        title="نیازمند رسیدگی"
        actions={
          <Link href="/hr?section=requests" className={ui.link}>
            مشاهده همه درخواست‌ها
          </Link>
        }
      >
        {loading ? (
          <HrLoading label="در حال دریافت درخواست‌ها…" />
        ) : error ? (
          <HrEmpty
            title="دریافت درخواست‌ها انجام نشد."
            description="برای تلاش دوباره، به‌روزرسانی را بزنید."
          />
        ) : (
          <div className={ui.attentionList}>
            {pending.slice(0, 10).map((record) => (
              <button
                type="button"
                className={ui.attentionItem}
                key={record.id}
                onClick={() => onSelect(record, sourceForRecord(record))}
              >
                <span>
                  <strong>{sourceForRecord(record).label}</strong>
                  <small>
                    {store.data!.employees.find(
                      (employee) => employee.id === record.employeeId,
                    )?.name ?? record.code}
                  </small>
                </span>
                <HrStatus>{record.status}</HrStatus>
                <ArrowLeft size={17} aria-hidden="true" />
              </button>
            ))}
            {!pending.length ? (
              <HrEmpty
                title="درخواست در انتظاری وجود ندارد."
                description="درخواست‌های نیازمند رسیدگی در این قسمت نمایش داده می‌شوند."
              />
            ) : null}
          </div>
        )}
      </HrPanel>
    </div>
  );
}
