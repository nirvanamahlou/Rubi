'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type HrRecordDto } from '@rubi/contracts';
import { hrHubCards, normalizeSection, type HrSectionId } from './hr.model';
import { canonicalHrLocation, hrGroups, type HrSource } from './hr-navigation';
import { useHrStore } from './hr-store';
import { hrRequest } from './hr-api';
import { HrButton } from './hr-controls';
import type { HrFormTarget } from './hr-record-form';
import { sourceForRecord } from './hr-unified-section';
import { HrServerNotifications } from './hr-server-notifications';
import styles from './hr-workspace.module.css';
import ui from './hr-unified.module.css';

const HrReports = dynamic(() =>
  import('./hr-reports').then((module) => module.HrReports),
);
const HrDashboard = dynamic(() =>
  import('./hr-dashboard').then((module) => module.HrDashboard),
);
const HrUnifiedSection = dynamic(() =>
  import('./hr-unified-section').then((module) => module.HrUnifiedSection),
);
const HrEmployees = dynamic(() =>
  import('./hr-employees').then((module) => module.HrEmployees),
);
const HrEmployeeProfile = dynamic(() =>
  import('./hr-employee-profile').then((module) => module.HrEmployeeProfile),
);
const HrOrganization = dynamic(() =>
  import('./hr-organization').then((module) => module.HrOrganization),
);
const HrInbox = dynamic(() =>
  import('./hr-inbox').then((module) => module.HrInbox),
);
const HrRecordForm = dynamic(() =>
  import('./hr-record-form').then((module) => module.HrRecordForm),
);
const HrRecordDetail = dynamic(() =>
  import('./hr-record-detail').then((module) => module.HrRecordDetail),
);
const workspaceAliases: Record<string, HrSectionId> = {
  expenses: 'expenses',
  'hr-setup': 'organization',
  leaves: 'time',
  payroll: 'payroll',
  performance: 'development',
  recruitment: 'recruitment',
  'shift-attendance': 'time',
  tenure: 'lifecycle',
};
export function HrLiveWorkspace({
  sectionId,
  tabId,
  workspaceId,
  employeeId,
  recordId,
}: {
  sectionId?: string | undefined;
  tabId?: string | undefined;
  workspaceId?: string | undefined;
  employeeId?: string | undefined;
  recordId?: string | undefined;
}) {
  const location = canonicalHrLocation(
    workspaceId
      ? (workspaceAliases[workspaceId] ?? 'home')
      : normalizeSection(sectionId),
    workspaceId === 'leaves' ? 'leave' : tabId,
  );
  const { section } = location;
  const tab = location.tab;
  const store = useHrStore();
  const router = useRouter();
  const [form, setForm] = useState<HrFormTarget | null>(null);
  const [selected, setSelected] = useState<{
    record: HrRecordDto;
    source: HrSource;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const select = (record: HrRecordDto, source: HrSource) => {
    store.remember([record]);
    setSelected({ record, source });
  };
  const ready = Boolean(store.data);
  useEffect(() => {
    if (!recordId || !ready) return;
    let active = true;
    void hrRequest<HrRecordDto>(`/records/${encodeURIComponent(recordId)}`)
      .then((record) => {
        if (active) setSelected({ record, source: sourceForRecord(record) });
      })
      .catch((e) => {
        if (active)
          setNotice(e instanceof Error ? e.message : 'پرونده در دسترس نیست.');
      });
    return () => {
      active = false;
    };
  }, [recordId, ready]);
  const employee = store.data?.employees.find((item) => item.id === employeeId);
  const headerTitle =
    section === 'employee'
      ? (employee?.name ?? 'پرونده کارمند')
      : (hrHubCards.find((item) => item.id === section)?.title ??
        'منابع انسانی');
  useEffect(() => {
    const event = new CustomEvent('rubi:hr-location', {
      detail: { section, tab, title: headerTitle },
    });
    window.dispatchEvent(event);
  }, [section, tab, headerTitle]);
  if (!store.data)
    return (
      <main className={styles.workspace} dir="rtl">
        <div className={ui.loading}>
          {store.error ? (
            <div className={ui.spaced}>
              <p className={ui.error} role="alert">
                {store.error}
              </p>
              <div className={ui.actions}>
                <HrButton
                  onClick={() => void store.refresh().catch(() => undefined)}
                >
                  تلاش مجدد
                </HrButton>
                <Link href="/login?next=%2Fhr">ورود به سامانه</Link>
              </div>
            </div>
          ) : (
            <p role="status">در حال دریافت منابع انسانی…</p>
          )}
        </div>
      </main>
    );
  const data = store.data;
  const cards = hrHubCards.filter((item) => item.id !== 'finance');
  return (
    <main className={styles.workspace} dir="rtl" lang="fa" data-hr-mode="live">
      <HrServerNotifications
        onSelect={async (id) => {
          try {
            const record = await hrRequest<HrRecordDto>(
              `/records/${encodeURIComponent(id)}`,
            );
            select(record, sourceForRecord(record));
          } catch (e) {
            setNotice(e instanceof Error ? e.message : 'پرونده در دسترس نیست.');
          }
        }}
      />
      <div className={ui.actions}>
        <span className={ui.badge} style={{ marginInlineStart: 'auto' }}>
          {store.loading ? 'در حال تازه‌سازی…' : 'اطلاعات سرور'} ·{' '}
          <HrButton onClick={() => void store.refresh().catch(() => undefined)}>
            تازه‌سازی
          </HrButton>
        </span>
      </div>
      {store.error ? (
        <p role="alert" className={ui.error}>
          {store.error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className={ui.notice}>
          {notice}
        </p>
      ) : null}
      {data.workflowWarnings?.length ? (
        <div className={ui.notice}>
          {data.workflowWarnings.map((warning) => (
            <p key={warning.recordId}>
              <Link href={`/hr?record=${warning.recordId}`}>
                {warning.message}
              </Link>
            </p>
          ))}
        </div>
      ) : null}
      {section === 'reports' ? (
        <HrReports store={store} />
      ) : section === 'home' ? (
        <div className={ui.spaced}>
          <header className={ui.heading}>
            <div>
              <h1>منابع انسانی</h1>
              <p>پرونده کارکنان و فرایندهای مرتبط در یک فضای کاری</p>
            </div>
          </header>
          <div className={ui.grid}>
            {cards.map((card) => {
              const count =
                card.id === 'employees'
                  ? data.employees.length
                  : data.records.filter((item) => item.section === card.id)
                      .length;
              const Icon = card.icon;
              return (
                <Link
                  href={`/hr?section=${card.id}`}
                  key={card.id}
                  className={ui.card}
                >
                  <Icon size={25} />
                  <h2>
                    {card.id === 'payroll' ? 'حقوق و ارتباط مالی' : card.title}
                  </h2>
                  <p>{card.description}</p>
                  <span>
                    {card.id === 'employees'
                      ? '۸ بخش پرونده شخصی'
                      : `${hrGroups[card.id]?.length ?? 1} بخش`}{' '}
                    {!['dashboard', 'reports', 'settings'].includes(card.id)
                      ? `· ${card.id === 'requests' ? data.records.filter((item) => /انتظار|بررسی/.test(item.status)).length.toLocaleString('fa-IR') : count.toLocaleString('fa-IR')} رکورد`
                      : ''}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : section === 'dashboard' ? (
        <HrDashboard store={store} onSelect={select} />
      ) : section === 'employees' ? (
        <HrEmployees
          store={store}
          onProfile={(item) =>
            router.push(`/hr?section=employee&employee=${item.id}`)
          }
        />
      ) : section === 'employee' ? (
        employee ? (
          <HrEmployeeProfile
            key={employee.id}
            employee={employee}
            initialTab={tab}
            store={store}
            onForm={setForm}
            onSelect={select}
          />
        ) : (
          <p role="alert" className={ui.error}>
            پرونده کارمند پیدا نشد یا دسترسی ندارید.
          </p>
        )
      ) : section === 'organization' ? (
        <HrOrganization
          store={store}
          initialTab={tab}
          onForm={setForm}
          onSelect={select}
        />
      ) : section === 'requests' ? (
        <HrInbox store={store} onSelect={select} />
      ) : (
        <HrUnifiedSection
          key={`${section}:${tab ?? ''}`}
          section={section}
          initialTab={tab}
          store={store}
          onForm={setForm}
          onSelect={select}
        />
      )}
      {selected && !form ? (
        <HrRecordDetail
          record={selected.record}
          source={selected.source}
          store={store}
          onClose={() => setSelected(null)}
          onForm={setForm}
          onSelect={select}
        />
      ) : null}
      {form ? (
        <HrRecordForm
          target={form}
          store={store}
          onClose={() => setForm(null)}
          onSaved={(record) => {
            setNotice('تغییرات ذخیره شد.');
            if (selected)
              setSelected({
                record:
                  record.id === selected.record.id
                    ? record
                    : (store.data!.records.find(
                        (item) => item.id === selected.record.id,
                      ) ?? selected.record),
                source: selected.source,
              });
            store.remember([record]);
          }}
        />
      ) : null}
    </main>
  );
}
