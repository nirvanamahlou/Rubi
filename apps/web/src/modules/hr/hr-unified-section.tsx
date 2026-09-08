'use client';
import { useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { getHrResource, type HrRecordDto } from '@rubi/contracts';
import type { HrSectionId } from './hr.model';
import { screenMeta, sectionTabs } from './hr.model';
import {
  hrGroups,
  resolveHrGroup,
  type HrGroup,
  type HrSource,
} from './hr-navigation';
import { hrApi, hrRequest } from './hr-api';
import { allHrRecords, type HrStore } from './hr-store';
import { recordsDataset, hrCompanies } from './hr-live-data';
import {
  HrButton,
  HrConfirmDelete,
  HrPanel,
  HrRangeBar,
  HrTable,
  HrTabs,
} from './hr-controls';
import type { HrFormTarget } from './hr-record-form';
import { HrImport } from './hr-import';
import { ShiftCalendar } from './shift-calendar';
import { SectionReports } from './section-reports';
import ui from './hr-unified.module.css';
import { parseSavedHrFilter } from './hr-filters';

export function sourceForRecord(record: HrRecordDto): HrSource {
  return (
    Object.values(hrGroups)
      .flatMap((groups) => groups.flatMap((group) => group.sources))
      .find(
        (source) =>
          source.section === record.section && source.tab === record.tab,
      ) ?? {
      section: record.section as HrSectionId,
      tab: record.tab,
      label:
        sectionTabs[record.section as HrSectionId]?.find(
          (tab) => tab.id === record.tab,
        )?.label ?? 'پرونده',
      action: 'افزودن',
    }
  );
}
export function HrUnifiedSection({
  section,
  initialTab,
  store,
  onForm,
  onSelect,
  embedded = false,
}: {
  embedded?: boolean;
  section: HrSectionId;
  initialTab?: string | undefined;
  store: HrStore;
  onForm: (target: HrFormTarget) => void;
  onSelect: (record: HrRecordDto, source: HrSource) => void;
}) {
  const fallback: HrGroup[] = [
    {
      id: 'records',
      label: screenMeta[section].title,
      sources: (sectionTabs[section] ?? []).map((tab) => ({
        section,
        tab: tab.id,
        label: tab.label,
        action: `افزودن ${tab.label}`,
      })),
    },
  ];
  const groups = hrGroups[section] ?? fallback;
  const first = resolveHrGroup(
    groups,
    initialTab === 'roster' ? 'shift' : initialTab,
  );
  const [groupId, setGroupId] = useState(first.id);
  const group = groups.find((item) => item.id === groupId) ?? first;
  const [sourceTab, setSourceTab] = useState(
    first.sources.find((item) => item.tab === initialTab)?.tab ??
      first.sources[0]!.tab,
  );
  const source =
    group.sources.find((item) => item.tab === sourceTab) ?? group.sources[0]!;
  const definition = getHrResource(source.section, source.tab);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [branchId, setBranchId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<HrRecordDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [removing, setRemoving] = useState<HrRecordDto | null>(null);
  const [importing, setImporting] = useState(false);
  const [calendar, setCalendar] = useState(initialTab === 'roster');
  const [busy, setBusy] = useState(false);
  const [expiry, setExpiry] = useState('');
  const [calendarItems, setCalendarItems] = useState<HrRecordDto[]>([]);
  const { remember } = store;
  const sourceSection = source.section;
  const activeTab = source.tab;
  const companies = hrCompanies(store.data!);
  const company = companies.find((item) => item.id === branchId);
  const requestQuery = {
    section: sourceSection,
    tab: activeTab,
    ...(query ? { search: query } : {}),
    ...(status ? { status } : {}),
    ...(employeeId ? { employeeId } : {}),
    ...(branchId
      ? company?.organizationBranchId
        ? { organizationBranchId: branchId }
        : { branchId }
      : {}),
    ...(range.from ? { from: range.from } : {}),
    ...(range.to ? { to: range.to } : {}),
    ...(expiry
      ? expiry === 'expired'
        ? { expired: 'true' }
        : { expiresWithin: expiry }
      : {}),
  };
  const queryKey = JSON.stringify(requestQuery);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      void hrApi.records
        .list({
          ...(JSON.parse(queryKey) as Record<string, string>),
          page,
          pageSize: 20,
        })
        .then((result) => {
          if (active) {
            setItems(result.items);
            setTotal(result.total);
            remember(result.items);
          }
        })
        .catch((e) => {
          if (active)
            setError(
              e instanceof Error ? e.message : 'دریافت فهرست انجام نشد.',
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [queryKey, page, store.revision, remember]);
  useEffect(() => {
    if (!calendar) return;
    let active = true;
    void allHrRecords(JSON.parse(queryKey) as Record<string, string>)
      .then((result) => {
        if (active) setCalendarItems(result);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'دریافت تقویم انجام نشد.');
      });
    return () => {
      active = false;
    };
  }, [calendar, queryKey, store.revision]);
  const currentItems = items;
  const dataset = recordsDataset(source.section, source.tab, currentItems);
  const writable = Boolean(
    definition &&
    !definition.readOnly &&
    (store.data!.capabilities.write || definition.selfService),
  );
  const switchGroup = (id: string) => {
    const next = groups.find((item) => item.id === id)!;
    setGroupId(id);
    setSourceTab(next.sources[0]!.tab);
    setPage(1);
    setCalendar(false);
    setStatus('');
    setExpiry('');
  };
  const exportData = async (pdf: boolean) => {
    setBusy(true);
    setError('');
    try {
      const all = await allHrRecords(requestQuery);
      const data = recordsDataset(source.section, source.tab, all);
      if (pdf) {
        const { downloadSectionPdf } = await import('./section-report-pdf');
        await downloadSectionPdf(source.label, [
          { id: source.tab, title: source.label, data },
        ]);
      } else {
        const { downloadHrXlsx } = await import('./hr-xlsx');
        await downloadHrXlsx(`hr-${source.section}-${source.tab}.xlsx`, [
          [...data.columns, 'کد پرسنلی', 'شناسه پرونده مرتبط'],
          ...all.map((record) => [
            record.code,
            ...record.values,
            record.status,
            store.data!.employees.find(
              (employee) => employee.id === record.employeeId,
            )?.personnelCode ?? '',
            record.parentId ?? '',
          ]),
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خروجی انجام نشد.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={ui.spaced}>
      {!embedded ? (
        <header className={ui.heading}>
          <div>
            <h1>{screenMeta[section].title}</h1>
            <p>{screenMeta[section].description}</p>
          </div>
        </header>
      ) : null}
      <HrRangeBar
        key={`${range.from}:${range.to}`}
        initialRange={range}
        onApply={(from, to) => {
          setRange({ from, to });
          setPage(1);
        }}
        actions={
          <>
            <HrButton disabled={busy} onClick={() => void exportData(false)}>
              خروجی اکسل
            </HrButton>
            <HrButton disabled={busy} onClick={() => void exportData(true)}>
              گزارش PDF
            </HrButton>
            {writable && !calendar ? (
              <>
                <HrButton onClick={() => setImporting(true)}>
                  ورودی اکسل
                </HrButton>
                <HrButton
                  primary
                  onClick={() =>
                    onForm({ source, ...(employeeId ? { employeeId } : {}) })
                  }
                >
                  <Plus size={15} />
                  {source.action}
                </HrButton>
              </>
            ) : null}
          </>
        }
      />
      {!embedded ? (
        <HrTabs
          items={groups}
          value={group.id}
          onChange={switchGroup}
          label={`بخش‌های ${screenMeta[section].title}`}
        />
      ) : null}
      <HrPanel
        title={group.label}
        actions={
          group.id === 'shifts' ? (
            <HrTabs
              items={[
                { id: 'list', label: 'تعریف شیفت' },
                { id: 'calendar', label: 'تقویم کارکنان' },
              ]}
              value={calendar ? 'calendar' : 'list'}
              onChange={(id) => setCalendar(id === 'calendar')}
              label="نمای شیفت"
            />
          ) : undefined
        }
      >
        <div className={ui.filters}>
          {!embedded && group.sources.length > 1 ? (
            <label>
              نمایش
              <select
                value={source.tab}
                onChange={(event) => {
                  setSourceTab(event.target.value);
                  setPage(1);
                }}
              >
                {group.sources.map((item) => (
                  <option key={`${item.section}.${item.tab}`} value={item.tab}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            جست‌وجو
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="عنوان، کد یا نام"
            />
          </label>
          <label>
            شرکت / شعبه
            <select
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                setEmployeeId('');
                setPage(1);
              }}
            >
              <option value="">همه شرکت‌های مجاز</option>
              {companies.map((branch) => (
                <option value={branch.id} key={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          {definition?.employeeRequired ? (
            <label>
              کارمند
              <select
                value={employeeId}
                onChange={(event) => {
                  setEmployeeId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">همه کارکنان مجاز</option>
                {store
                  .data!.employees.filter(
                    (item) =>
                      !branchId ||
                      (item.organizationBranchId || item.branchId) === branchId,
                  )
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name} · {item.personnelCode}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          <label>
            وضعیت
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">همه وضعیت‌ها</option>
              {Array.from(
                new Set([
                  'پیش‌نویس',
                  'در انتظار تأیید',
                  'تأییدشده',
                  'ردشده',
                  'لغوشده',
                  'فعال',
                  ...items.map((item) => item.status),
                ]),
              ).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          {section === 'contracts' && source.tab === 'active' ? (
            <label>
              پایان قرارداد
              <select
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
              >
                <option value="">همه قراردادها</option>
                <option value="30">تا ۳۰ روز آینده</option>
                <option value="90">تا ۹۰ روز آینده</option>
                <option value="expired">منقضی‌شده</option>
              </select>
            </label>
          ) : null}
          <HrButton
            onClick={() => {
              window.localStorage.setItem(
                `rubi.hr.filters.${source.section}.${source.tab}`,
                JSON.stringify({
                  status,
                  branchId,
                  from: range.from,
                  to: range.to,
                  expiry,
                }),
              );
              setNotice('فیلتر این بخش ذخیره شد.');
            }}
          >
            ذخیره فیلتر
          </HrButton>
          <HrButton
            onClick={() => {
              const saved = parseSavedHrFilter(
                window.localStorage.getItem(
                  `rubi.hr.filters.${source.section}.${source.tab}`,
                ),
                companies.map((item) => item.id),
              );
              if (saved) {
                setStatus(saved.status);
                setBranchId(saved.branchId);
                setRange({ from: saved.from, to: saved.to });
                setExpiry(saved.expiry);
                setPage(1);
              } else setNotice('فیلتر ذخیره‌شده‌ای برای این بخش وجود ندارد.');
            }}
          >
            فیلتر ذخیره‌شده
          </HrButton>
          <HrButton
            onClick={() => {
              setQuery('');
              setStatus('');
              setEmployeeId('');
              setBranchId('');
              setPage(1);
              setExpiry('');
              setRange({ from: '', to: '' });
            }}
          >
            پاک‌کردن فیلتر
          </HrButton>
        </div>
        {error ? (
          <p role="alert" className={ui.error}>
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className={ui.notice}>
            {notice}
          </p>
        ) : null}
        {loading ? (
          <p role="status">در حال دریافت اطلاعات…</p>
        ) : calendar ? (
          <ShiftCalendar
            shifts={recordsDataset('time', 'shift', calendarItems)}
          />
        ) : (
          <>
            <HrTable
              data={dataset}
              onOpen={(index) => onSelect(currentItems[index]!, source)}
              {...(writable
                ? {
                    onEdit: (index: number) =>
                      onForm({ source, record: currentItems[index]! }),
                    onDelete: (index: number) =>
                      setRemoving(currentItems[index]!),
                  }
                : {})}
            />
            <div className={ui.pagination}>
              <span>{total.toLocaleString('fa-IR')} نتیجه</span>
              <HrButton disabled={page === 1} onClick={() => setPage(page - 1)}>
                قبلی
              </HrButton>
              <span>{page.toLocaleString('fa-IR')}</span>
              <HrButton
                disabled={page * 20 >= total}
                onClick={() => setPage(page + 1)}
              >
                بعدی
              </HrButton>
            </div>
          </>
        )}
        {section === 'time' &&
        group.id === 'work' &&
        store.data!.capabilities.write ? (
          <details>
            <summary className={ui.detailsSummary}>
              محاسبه و بستن کارکرد
            </summary>
            <div className={ui.actions}>
              <HrButton
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    await hrRequest('/attendance/process', {
                      method: 'POST',
                      headers: {
                        'content-type': 'application/json',
                        'Idempotency-Key': crypto.randomUUID(),
                      },
                      body: JSON.stringify({
                        ...(company ? { branchId: company.branchId } : {}),
                        date:
                          range.from || new Date().toISOString().slice(0, 10),
                      }),
                    });
                    await store.mutated();
                    setNotice(
                      'کارکرد با تردد، شیفت و مرخصی تأییدشده محاسبه شد.',
                    );
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : 'محاسبه انجام نشد.',
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <RefreshCw size={14} />
                محاسبه روز انتخاب‌شده
              </HrButton>
              <HrButton
                disabled={busy || !range.from || !range.to}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    await hrRequest('/attendance/close', {
                      method: 'POST',
                      headers: {
                        'content-type': 'application/json',
                        'Idempotency-Key': crypto.randomUUID(),
                      },
                      body: JSON.stringify({
                        ...(company ? { branchId: company.branchId } : {}),
                        from: range.from,
                        to: range.to,
                      }),
                    });
                    await store.mutated();
                    setNotice('بازه کارکرد بسته شد و مبانی پرداخت آماده است.');
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : 'بستن دوره انجام نشد.',
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                بستن بازه و آماده‌سازی مبانی پرداخت
              </HrButton>
            </div>
          </details>
        ) : null}
      </HrPanel>
      <SectionReports
        title={`${source.label} · صفحه جاری`}
        reports={[{ id: source.tab, title: source.label, data: dataset }]}
      >
        <span />
      </SectionReports>
      {removing ? (
        <HrConfirmDelete
          title={removing.code}
          onClose={() => setRemoving(null)}
          onConfirm={() => store.remove(removing)}
        />
      ) : null}
      {importing ? (
        <HrImport
          source={source}
          store={store}
          branchId={company?.branchId || store.data!.branches[0]?.id || ''}
          organizationBranchId={company?.organizationBranchId}
          onClose={() => setImporting(false)}
        />
      ) : null}
    </div>
  );
}
