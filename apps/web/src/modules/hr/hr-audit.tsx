'use client';
import { useEffect, useState } from 'react';
import { hrRequest } from './hr-api';
import type { HrStore } from './hr-store';
import { HrExportButton, HrPanel, HrPdfButton, HrTable } from './hr-controls';
import ui from './hr-unified.module.css';

interface AuditEvent {
  id: string;
  actorId: string;
  recordId: string | null;
  action: string;
  createdAt: string;
  changes: Record<string, unknown>;
}
const actionNames: Record<string, string> = {
  'employee.create': 'ثبت کارمند',
  'employee.update': 'ویرایش کارمند',
  'employee.delete': 'حذف کارمند',
  'record.create': 'ثبت رکورد',
  'record.update': 'ویرایش رکورد',
  'record.delete': 'حذف رکورد',
  'record.read': 'مشاهده پرونده',
  'employee.read': 'مشاهده کارمند',
  'leave.grant': 'ثبت سهمیه مرخصی',
  'record.transition': 'تغییر وضعیت',
  'bootstrap.read': 'مشاهده منابع انسانی',
};
export function HrAudit({
  store,
  employeeId,
  recordId,
}: {
  store: HrStore;
  employeeId?: string;
  recordId?: string;
}) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({
      ...(employeeId ? { employeeId } : {}),
      ...(recordId ? { recordId } : {}),
    });
    void hrRequest<AuditEvent[]>(`/audit?${query}`)
      .then((items) => {
        if (active) setEvents(items);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'دریافت تاریخچه انجام نشد.',
          );
      });
    return () => {
      active = false;
    };
  }, [employeeId, recordId, store.revision]);
  const data = {
    columns: ['زمان', 'عملیات', 'انجام‌دهنده', 'پرونده'],
    rows: events.map((item) => [
      new Date(item.createdAt).toLocaleString('fa-IR'),
      actionNames[item.action] ?? item.action,
      store.data!.employees.find((person) => person.userId === item.actorId)
        ?.name ?? 'کاربر مجاز سامانه',
      store.data!.records.find((record) => record.id === item.recordId)?.code ??
        '—',
    ]),
    recordIds: events.map((item) => item.id),
    totalLabel: '',
  };
  return (
    <HrPanel title="تاریخچه تغییرات و دسترسی‌ها">
      <div className={ui.actions}>
        <HrExportButton data={data} name="hr-audit" />
        <HrPdfButton data={data} title="تاریخچه منابع انسانی" />
      </div>
      {error ? <p role="alert">{error}</p> : <HrTable data={data} />}
      <p className={ui.muted}>حداکثر ۲۰۰ رویداد اخیر در محدوده دسترسی شما</p>
    </HrPanel>
  );
}
