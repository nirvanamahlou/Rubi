'use client';

import {
  ArrowLeft,
  ClipboardCheck,
  Headphones,
  Smile,
  Users,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import type { AffairsReport } from '../api/customer-affairs-client';
import { stageLabel, statusLabel } from './customer-affairs-workspace';
import { Button } from '@/components/ui/button';
import s from './affairs-report-panel.module.css';

const number = (value: number) =>
  value.toLocaleString('fa-IR', { maximumFractionDigits: 1 });
const actionLabels: Record<string, string> = {
  OPEN: 'باز',
  IN_PROGRESS: 'در حال انجام',
  DONE: 'تکمیل‌شده',
  COMPLETED: 'تکمیل‌شده',
  CANCELLED: 'لغوشده',
  CLOSED: 'بسته',
};
const requestOrder = [
  'NEW',
  'CONTACTED',
  'QUALIFYING',
  'QUALIFIED',
  'HANDOFF_PROPOSED',
  'HANDED_OFF',
  'NURTURE',
  'LOST',
];
const ticketOrder = [
  'NEW',
  'TRIAGED',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'WAITING_EXTERNAL',
  'REOPENED',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
];
const tone = (key: string) =>
  [
    'RESOLVED',
    'CLOSED',
    'DONE',
    'COMPLETED',
    'QUALIFIED',
    'HANDED_OFF',
  ].includes(key)
    ? 'var(--ca-teal)'
    : ['LOST', 'CANCELLED'].includes(key)
      ? 'var(--muted-foreground)'
      : key.startsWith('WAITING') || key === 'NURTURE'
        ? 'var(--ca-amber)'
        : 'var(--primary)';
type Row = { key: string; count: number };
const total = (rows: Row[]) => rows.reduce((sum, row) => sum + row.count, 0);

function Distribution({
  title,
  rows,
  labels,
  order,
  onOpen,
}: {
  title: string;
  rows: Row[];
  labels: Record<string, string>;
  order: string[];
  onOpen: () => void;
}) {
  const count = total(rows);
  const sorted = [...rows].sort((a, b) => {
    const rank = (key: string) =>
      order.includes(key) ? order.indexOf(key) : order.length;
    return rank(a.key) - rank(b.key);
  });
  return (
    <section className={s.card} aria-label={title}>
      <header className={s.cardHeader}>
        <div>
          <h3>{title}</h3>
          <p>تعداد و سهم هر وضعیت از کل</p>
        </div>
        <span className={s.badge}>{number(count)} پرونده</span>
      </header>
      <div className={s.rows}>
        {sorted.length ? (
          sorted.map((row) => (
            <div
              className={s.row}
              key={row.key}
              style={{ '--report-color': tone(row.key) } as CSSProperties}
            >
              <div className={s.rowLabel}>
                <span>
                  <i aria-hidden="true" />
                  {labels[row.key] ?? row.key}
                </span>
                <span>
                  <strong>{number(row.count)}</strong>
                  <small>
                    {number(count ? (row.count / count) * 100 : 0)}٪
                  </small>
                </span>
              </div>
              <div className={s.track} aria-hidden="true">
                <span
                  style={{ width: `${count ? (row.count / count) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className={s.empty}>هنوز پرونده‌ای ثبت نشده است.</p>
        )}
      </div>
      <footer className={s.footer}>
        <Button variant="ghost" onClick={onOpen}>
          مشاهده پرونده‌ها <ArrowLeft size={15} aria-hidden="true" />
        </Button>
      </footer>
    </section>
  );
}

export function AffairsReportPanel({
  report,
  showRequests,
  onTickets,
  onRequests,
}: {
  report: AffairsReport;
  showRequests: boolean;
  onTickets: () => void;
  onRequests: () => void;
}) {
  const requests = report.leadStages.map((x) => ({
    key: x.stage,
    count: x._count._all,
  }));
  const tickets = report.ticketStatuses.map((x) => ({
    key: x.status,
    count: x._count._all,
  }));
  const actions = report.correctiveActions.map((x) => ({
    key: x.status,
    count: x._count._all,
  }));
  const average = report.satisfaction.average;
  const pendingActions = total(
    actions.filter((x) => ['OPEN', 'IN_PROGRESS'].includes(x.key)),
  );
  const metrics = [
    ...(showRequests
      ? [
          {
            label: 'درخواست‌های مشتریان',
            value: number(total(requests)),
            hint: 'در همه مراحل',
            icon: Users,
            color: 'var(--primary)',
          },
        ]
      : []),
    {
      label: 'تیکت‌های پشتیبانی',
      value: number(total(tickets)),
      hint: 'در همه وضعیت‌ها',
      icon: Headphones,
      color: 'var(--ca-purple)',
    },
    {
      label: 'پاسخ‌های رضایت‌سنجی',
      value: number(report.satisfaction.count),
      hint: 'پاسخ ثبت‌شده',
      icon: Smile,
      color: 'var(--ca-teal)',
    },
    {
      label: 'اقدام اصلاحی در جریان',
      value: number(pendingActions),
      hint: 'باز و در حال انجام',
      icon: ClipboardCheck,
      color: 'var(--ca-amber)',
    },
  ];
  return (
    <div className={s.report}>
      <header className={s.heading}>
        <p className={s.timestamp}>
          آخرین دریافت: {new Date(report.generatedAt).toLocaleString('fa-IR')}
          <br />
          در محدوده دسترسی شما · همه تاریخ‌ها
        </p>
      </header>
      <div className={s.metrics}>
        {metrics.map(({ label, value, hint, icon: Icon, color }) => (
          <article
            className={s.metric}
            key={label}
            style={{ '--report-color': color } as CSSProperties}
          >
            <span className={s.metricIcon}>
              <Icon size={22} aria-hidden="true" />
            </span>
            <div>
              <p>{label}</p>
              <strong>{value}</strong>
              <small>{hint}</small>
            </div>
          </article>
        ))}
      </div>
      <div className={s.distributions}>
        {showRequests && (
          <Distribution
            title="وضعیت درخواست‌های مشتریان"
            rows={requests}
            labels={stageLabel}
            order={requestOrder}
            onOpen={onRequests}
          />
        )}
        <Distribution
          title="وضعیت تیکت‌های پشتیبانی"
          rows={tickets}
          labels={statusLabel}
          order={ticketOrder}
          onOpen={onTickets}
        />
      </div>
      <div className={s.bottom}>
        <section
          className={`${s.card} ${s.satisfaction}`}
          aria-label="رضایت مشتری"
        >
          <header className={s.cardHeader}>
            <div>
              <h3>رضایت مشتری</h3>
              <p>میانگین امتیاز پاسخ‌های ثبت‌شده</p>
            </div>
            <Smile size={23} aria-hidden="true" />
          </header>
          <div className={s.scoreBody}>
            <div className={s.score}>
              <strong>{average === null ? '—' : number(average)}</strong>
              <span>از ۵</span>
            </div>
            <div>
              <p>{number(report.satisfaction.count)} پاسخ ثبت‌شده</p>
              <p className={s.note}>
                {average === null
                  ? 'پس از دریافت اولین پاسخ، امتیاز نمایش داده می‌شود.'
                  : 'این امتیاز میانگین پاسخ‌هاست، نه درصد رضایت.'}
              </p>
            </div>
          </div>
          <footer className={s.footer}>
            <Button variant="ghost" onClick={onTickets}>
              مشاهده پرونده‌های پشتیبانی{' '}
              <ArrowLeft size={15} aria-hidden="true" />
            </Button>
          </footer>
        </section>
        <section className={s.card} aria-label="اقدام‌های اصلاحی">
          <header className={s.cardHeader}>
            <div>
              <h3>اقدام‌های اصلاحی</h3>
              <p>پیگیری نتیجه بازخورد مشتریان</p>
            </div>
            <span className={s.badge}>{number(total(actions))} اقدام</span>
          </header>
          <div className={s.actionGrid}>
            {actions.length ? (
              actions.map((row) => (
                <div
                  className={s.action}
                  key={row.key}
                  style={{ '--report-color': tone(row.key) } as CSSProperties}
                >
                  <span>{actionLabels[row.key] ?? row.key}</span>
                  <strong>{number(row.count)}</strong>
                </div>
              ))
            ) : (
              <p className={s.empty}>اقدام اصلاحی ثبت نشده است.</p>
            )}
          </div>
          <p className={s.note}>
            جزئیات و ثبت نتیجه از داخل پرونده پشتیبانی در دسترس است.
          </p>
        </section>
      </div>
    </div>
  );
}
