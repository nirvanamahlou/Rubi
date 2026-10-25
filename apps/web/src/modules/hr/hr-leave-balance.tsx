'use client';
import { useEffect, useRef, useState } from 'react';
import type { HrRecordDto } from '@nora/contracts';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { useRouteAccess } from '@/modules/iam/access-context';
import { hrRequest } from './hr-api';
import type { HrStore } from './hr-store';
import { currentPersianYear, minuteText } from './hr-radan-tools';
import {
  HrButton,
  HrPanel,
  HrTabs,
  HrTable,
  HrExportButton,
} from './hr-controls';
import { useHrReferenceData } from './hr-reference-data';
import ui from './hr-unified.module.css';

type Person = {
  id: string;
  name: string;
  personnelCode: string;
  unit: string;
  branchId: string;
};
type LeaveReport = {
  year: number;
  items: {
    id: string;
    name: string;
    personnelCode: string;
    balanceMinutes: number;
  }[];
  records: HrRecordDto[];
};
const views = [
  { id: 'grant', label: 'افزودن مانده مرخصی' },
  { id: 'cardex', label: 'کاردکس مانده مرخصی' },
  { id: 'report', label: 'گزارش مانده مرخصی' },
  { id: 'userTransfer', label: 'انتقال مرخصی کاربر' },
  { id: 'generalTransfer', label: 'انتقال مرخصی عمومی' },
];
const months = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];
const transferFields = [
  ['greaterThan', 'مانده مرخصی بیشتر از'],
  ['greaterCarry', 'مقدار انتقال'],
  ['greaterBurn', 'مقدار سوخت'],
  ['greaterBuyback', 'مقدار بازخرید'],
  ['lessThan', 'مانده مرخصی کمتر از'],
  ['lessCarry', 'مقدار انتقال'],
  ['lessBurn', 'مقدار سوخت'],
  ['lessBuyback', 'مقدار بازخرید'],
] as const;

export function HrLeaveBalance({
  store,
  initialView = 'grant',
}: {
  store: HrStore;
  initialView?: string;
}) {
  const allowed = useRouteAccess();
  const refs = useHrReferenceData(store);
  const [view, setView] = useState(initialView);
  const [year, setYear] = useState(String(currentPersianYear()));
  const [selectedMonths, setMonths] = useState(months.map((_, i) => i + 1));
  const [duration, setDuration] = useState('16:20');
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [picker, setPicker] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [pickerSearch, setPickerSearch] = useState('');
  const [zoom, setZoom] = useState(100);
  const [sort, setSort] = useState('code');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [report, setReport] = useState<LeaveReport | null>(null);
  const [transfer, setTransfer] = useState<Record<string, string>>(
    Object.fromEntries(transferFields.map(([field]) => [field, '00:00'])),
  );
  const [userTransfer, setUserTransfer] = useState<Person | null>(null);
  const [ruleId, setRuleId] = useState('');
  const lock = useRef(false);
  const generation = useRef(0);
  const command = useRef({ payload: '', key: crypto.randomUUID() });
  const canWrite =
    store.data!.capabilities.write && store.data!.capabilities.approve;
  const canTransfer =
    canWrite && allowed('/hr?section=time&tab=leaveTransferRules');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setReport(null);
    generation.current++;
    hrRequest<{ items: Person[] }>('/leave/personnel')
      .then((result) => {
        if (!active) return;
        setPeople(result.items);
        setSelected((ids) =>
          ids.filter((id) => result.items.some((person) => person.id === id)),
        );
      })
      .catch((e: unknown) => {
        if (active) {
          setPeople([]);
          setError(e instanceof Error ? e.message : 'دریافت فهرست انجام نشد.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh, store.revision]);
  const invalidate = () => {
    generation.current++;
    setReport(null);
    setNotice('');
  };
  const changeSelected = (ids: string[]) => {
    invalidate();
    setSelected(ids);
  };
  const run = async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'عملیات انجام نشد.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const submit = async (input: object) => {
    const payload = JSON.stringify(input);
    if (command.current.payload !== payload)
      command.current = { payload, key: crypto.randomUUID() };
    await hrRequest('/leave/minutes', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Idempotency-Key': command.current.key,
      },
      body: payload,
    });
    command.current = { payload: '', key: crypto.randomUUID() };
    invalidate();
    await store.mutated();
    setNotice('درخواست ثبت شد.');
  };
  const filtered = people
    .filter((person) =>
      `${person.name} ${person.personnelCode}`.includes(search.trim()),
    )
    .sort(
      (a, b) =>
        (sort === 'code'
          ? a.personnelCode.localeCompare(b.personnelCode, 'fa', {
              numeric: true,
            })
          : a.name.localeCompare(b.name, 'fa')) || a.id.localeCompare(b.id),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const pagePeople = filtered.slice(
    (Math.min(page, pages) - 1) * 20,
    Math.min(page, pages) * 20,
  );
  const yearField = (label: string) => (
    <label>
      {label}
      <NativeSearchSelect
        value={year}
        onChange={(e) => {
          invalidate();
          setYear(e.target.value);
        }}
        disabled={busy}
      >
        {Array.from({ length: 14 }, (_, i) => currentPersianYear() - 6 + i).map(
          (value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ),
        )}
      </NativeSearchSelect>
    </label>
  );
  const reportData = report
    ? {
        totalLabel: 'پرسنل',
        columns: ['کد پرسنلی', 'نام و نام خانوادگی', 'مانده ساعت:دقیقه'],
        rows: report.items.map((item) => [
          item.personnelCode,
          item.name,
          minuteText(item.balanceMinutes),
        ]),
      }
    : null;
  const cardexData = report
    ? {
        totalLabel: 'گردش مرخصی',
        columns: [
          'کارمند',
          'سال شمسی',
          'ماه',
          'نوع مرخصی',
          'عملیات',
          'ساعت و دقیقه',
        ],
        rows: report.records.map((record) => [
          ...record.values.slice(0, 5),
          minuteText(Number(record.values[5])),
        ]),
      }
    : null;
  const pickerPeople = people.filter((person) =>
    `${person.name} ${person.personnelCode} ${person.unit}`.includes(
      pickerSearch.trim(),
    ),
  );
  const openPicker = () => {
    setDraft(selected);
    setPickerSearch('');
    setZoom(100);
    setPicker(true);
  };
  const toggleDraft = (ids: string[], checked: boolean) =>
    setDraft((current) =>
      checked
        ? [...new Set([...current, ...ids])]
        : current.filter((id) => !ids.includes(id)),
    );
  return (
    <HrPanel title="مانده مرخصی">
      <HrTabs
        items={views}
        value={view}
        onChange={(id) => {
          if (busy) return;
          invalidate();
          setView(id);
          setSelected([]);
          setError('');
          setPage(1);
        }}
        label="بخش‌های مانده مرخصی"
      />
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {view === 'grant' || view === 'generalTransfer' ? (
        <form
          className={ui.spaced}
          onSubmit={(event) => {
            event.preventDefault();
            void run(() =>
              submit({
                employeeIds: selected,
                year: Number(year),
                type: 'استحقاقی',
                ...(view === 'grant'
                  ? { months: selectedMonths, duration }
                  : { transfer }),
              }),
            );
          }}
        >
          <h3>
            {view === 'grant' ? 'فرم مانده مرخصی' : 'فرم انتقال خودکار مرخصی'}
          </h3>
          <div className={ui.filters}>
            {yearField(view === 'grant' ? 'سال' : 'انتقال از سال')}
            {view === 'grant' ? (
              <>
                <label>
                  ماه
                  <select
                    multiple
                    required
                    disabled={busy}
                    value={
                      selectedMonths.length === 12
                        ? ['all']
                        : selectedMonths.map(String)
                    }
                    onChange={(e) => {
                      const ids = Array.from(
                        e.target.selectedOptions,
                        (option) => option.value,
                      );
                      setMonths(
                        ids.includes('all')
                          ? months.map((_, i) => i + 1)
                          : ids.map(Number),
                      );
                    }}
                  >
                    <option value="all">همه</option>
                    {months.map((month, i) => (
                      <option key={month} value={i + 1}>
                        {month}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ساعت و دقیقه
                  <input
                    required
                    dir="ltr"
                    placeholder="16:20"
                    value={duration}
                    disabled={busy}
                    onChange={(e) => setDuration(e.target.value)}
                  />
                </label>
              </>
            ) : (
              transferFields.map(([field, label]) => (
                <label key={field}>
                  {label}
                  <input
                    required
                    dir="ltr"
                    placeholder="00:00"
                    disabled={busy}
                    value={transfer[field]}
                    onChange={(e) =>
                      setTransfer((current) => ({
                        ...current,
                        [field]: e.target.value,
                      }))
                    }
                  />
                </label>
              ))
            )}
            <div>
              <span>{view === 'grant' ? 'کاربران' : 'درخواست کننده‌ها'}</span>
              <HrButton disabled={busy || loading} onClick={openPicker}>
                افزودن
              </HrButton>
              <span aria-live="polite">{selected.length}</span>
            </div>
          </div>
          <HrButton
            primary
            type="submit"
            disabled={
              busy ||
              loading ||
              !selected.length ||
              selected.length > 100 ||
              (view === 'grant'
                ? !canWrite || !selectedMonths.length
                : !canTransfer)
            }
          >
            ثبت درخواست
          </HrButton>
        </form>
      ) : (
        <div className={ui.spaced}>
          {view !== 'userTransfer' ? (
            <>
              <h3>فرم گزارش مانده مرخصی کاربر</h3>
              <div className={ui.filters}>
                {yearField('انتخاب سال')}
                <HrButton
                  disabled={
                    busy || loading || !selected.length || selected.length > 100
                  }
                  onClick={() =>
                    void run(async () => {
                      const requestGeneration = generation.current;
                      const result = await hrRequest<LeaveReport>(
                        `/leave/report?${new URLSearchParams({ year, employeeIds: selected.join(',') })}`,
                      );
                      if (requestGeneration === generation.current)
                        setReport(result);
                    })
                  }
                >
                  گرفتن گزارش
                </HrButton>
              </div>
            </>
          ) : null}
          <h3>پرسنل</h3>
          <div className={ui.filters}>
            <label className={ui.field}>
              جست‌وجو
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              مرتب‌سازی
              <NativeSearchSelect
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
              >
                <option value="code">کد پرسنلی</option>
                <option value="name">اسم و فامیل</option>
              </NativeSearchSelect>
            </label>
            <HrButton
              disabled={busy || loading}
              onClick={() => setRefresh((value) => value + 1)}
            >
              به‌روزرسانی
            </HrButton>
          </div>
          <label>
            <input
              type="checkbox"
              disabled={busy || loading || !pagePeople.length}
              checked={
                !!pagePeople.length &&
                pagePeople.every((person) => selected.includes(person.id))
              }
              onChange={(e) =>
                changeSelected(
                  e.target.checked
                    ? [
                        ...new Set([
                          ...selected,
                          ...pagePeople.map((person) => person.id),
                        ]),
                      ]
                    : selected.filter(
                        (id) => !pagePeople.some((person) => person.id === id),
                      ),
                )
              }
            />
            انتخاب صفحه
          </label>
          {loading ? (
            <p role="status">در حال دریافت اطلاعات...</p>
          ) : (
            pagePeople.map((person) => (
              <div key={person.id} className={ui.filters}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(person.id)}
                    disabled={busy}
                    onChange={(e) =>
                      changeSelected(
                        e.target.checked
                          ? [...selected, person.id]
                          : selected.filter((id) => id !== person.id),
                      )
                    }
                  />
                  {person.personnelCode} — {person.name}
                </label>
                {view === 'userTransfer' && canTransfer ? (
                  <HrButton
                    onClick={() => {
                      setRuleId('');
                      setUserTransfer(person);
                    }}
                  >
                    انتقال مرخصی
                  </HrButton>
                ) : null}
              </div>
            ))
          )}
          <div className={ui.filters}>
            <HrButton
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              صفحه قبل
            </HrButton>
            <span>
              {Math.min(page, pages)} / {pages}
            </span>
            <HrButton
              disabled={page >= pages}
              onClick={() => setPage((value) => value + 1)}
            >
              صفحه بعد
            </HrButton>
            <span>انتخاب‌شده: {selected.length} / 100</span>
          </div>
          {reportData ? (
            <>
              <HrTable data={reportData} />
              <HrExportButton name="گزارش مانده مرخصی" data={reportData} />
              {view === 'cardex' && cardexData ? (
                <>
                  <HrTable data={cardexData} />
                  <HrExportButton name="کاردکس مانده مرخصی" data={cardexData} />
                </>
              ) : null}
            </>
          ) : null}
        </div>
      )}
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent>
          <DialogTitle>کاربران</DialogTitle>
          <DialogDescription>انتخاب از چارت سازمانی</DialogDescription>
          <div className={ui.spaced}>
            <label className={ui.field}>
              جست‌وجو
              <input
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
              />
            </label>
            <div className={ui.filters}>
              <HrButton
                onClick={() => setZoom((value) => Math.max(50, value - 10))}
              >
                −
              </HrButton>
              <span>{zoom}%</span>
              <HrButton
                onClick={() => setZoom((value) => Math.min(150, value + 10))}
              >
                +
              </HrButton>
              <HrButton onClick={() => setZoom(100)}>بازنشانی</HrButton>
            </div>
            <div
              style={{
                maxHeight: '45vh',
                overflow: 'auto',
                fontSize: `${zoom}%`,
              }}
            >
              {[...new Set(pickerPeople.map((person) => person.unit))]
                .sort()
                .map((unit) => {
                  const members = pickerPeople.filter(
                    (person) => person.unit === unit,
                  );
                  return (
                    <details open key={unit}>
                      <summary>{unit || 'بدون واحد'}</summary>
                      <label>
                        <input
                          type="checkbox"
                          checked={members.every((person) =>
                            draft.includes(person.id),
                          )}
                          onChange={(e) =>
                            toggleDraft(
                              members.map((person) => person.id),
                              e.target.checked,
                            )
                          }
                        />
                        انتخاب واحد
                      </label>
                      {members.map((person) => (
                        <div key={person.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={draft.includes(person.id)}
                              onChange={(e) =>
                                toggleDraft([person.id], e.target.checked)
                              }
                            />
                            {person.personnelCode} — {person.name}
                          </label>
                        </div>
                      ))}
                    </details>
                  );
                })}
            </div>
            <span>{draft.length} / 100</span>
            <div className={ui.filters}>
              <HrButton onClick={() => setPicker(false)}>لغو</HrButton>
              <HrButton
                primary
                disabled={draft.length > 100}
                onClick={() => {
                  changeSelected(draft);
                  setPicker(false);
                }}
              >
                تایید
              </HrButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!userTransfer}
        onOpenChange={(open) => {
          if (!busy && !open) setUserTransfer(null);
        }}
      >
        <DialogContent>
          <DialogTitle>انتقال مرخصی کاربر</DialogTitle>
          <DialogDescription>{userTransfer?.name}</DialogDescription>
          <label>
            قاعده انتقال
            <NativeSearchSelect
              value={ruleId}
              onChange={(e) => setRuleId(e.target.value)}
            >
              <option value="">انتخاب قاعده</option>
              {refs.data.records
                .filter(
                  (rule) =>
                    rule.section === 'time' &&
                    rule.tab === 'leaveTransferRules' &&
                    rule.status === 'فعال' &&
                    rule.branchId === userTransfer?.branchId,
                )
                .map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {rule.values[0]} — {rule.values[1]}
                  </option>
                ))}
            </NativeSearchSelect>
          </label>
          <HrButton
            disabled={
              busy || !ruleId || refs.loading || !!refs.error || !canTransfer
            }
            onClick={() =>
              void run(async () => {
                const rule = refs.data.records.find(
                  (rule) => rule.id === ruleId,
                );
                await submit({
                  employeeIds: [userTransfer!.id],
                  year: Number(rule!.values[1]),
                  type: 'استحقاقی',
                  ruleId,
                });
                setUserTransfer(null);
              })
            }
          >
            ثبت درخواست
          </HrButton>
          {error ? <p role="alert">{error}</p> : null}
          <HrButton disabled={busy} onClick={() => setUserTransfer(null)}>
            لغو
          </HrButton>
        </DialogContent>
      </Dialog>
    </HrPanel>
  );
}
