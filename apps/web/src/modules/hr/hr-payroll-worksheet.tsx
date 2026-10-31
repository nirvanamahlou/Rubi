'use client';
import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { Plus, Trash2, ArrowRight, Settings2, Download } from 'lucide-react';
import {
  PAYROLL_COLUMNS,
  calculatePayroll,
  emptyPayrollRow,
  EMPLOYMENT_DEFAULTS,
  payrollMonthDays,
  isPayrollInput,
  payrollCell,
  payrollTextInput,
  type HrBootstrapDto,
  type PayrollColumn,
  type PayrollInput,
  type PayrollSnapshot,
  type PayrollWorksheet,
  type PayrollWorksheetSummary,
} from '@nora/contracts';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import {
  HrButton,
  HrLoading,
  HrPanel,
  HrConfirmDelete,
  HrStatus,
} from './hr-controls';
import { hrRequest } from './hr-api';
import styles from './hr-payroll-worksheet.module.css';
import { pastePayrollGrid } from './hr-payroll-grid';
import {
  defaultPayrollListFilters,
  filterPayrollList,
  payrollMonths as monthNames,
  payrollPeriodLabel as periodLabel,
  payrollWorksheetStatusLabels,
  type PayrollListFilters,
} from './hr-payroll-list';

import {
  HrPayrollConfiguration,
  payrollConfiguration,
  type PayConfiguration,
} from './hr-payroll-configuration';
const api = '/payroll-worksheets';
const number = (v: string | bigint | number) =>
  BigInt(v).toLocaleString('fa-IR');
const snapshot = (sheet: PayrollSnapshot): PayrollSnapshot => ({
  rows: sheet.rows,
  rates: sheet.rates,
});
function Cell({
  value,
  label,
  onCommit,
  onError,
  ...props
}: {
  value: string;
  label: string;
  onCommit: (v: string) => void;
  onError: (message: string) => void;
  disabled: boolean;
  id: string;
  field: PayrollColumn;
}) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const [previousValue, setPreviousValue] = useState(value);
  if (previousValue !== value) {
    setPreviousValue(value);
    setDraft(value);
    setInvalid(false);
  }
  const commit = () => {
    try {
      onCommit(payrollCell(props.field as PayrollInput, draft));
      setInvalid(false);
      return true;
    } catch (e) {
      setInvalid(true);
      onError(e instanceof Error ? e.message : 'مقدار سلول معتبر نیست.');
      return false;
    }
  };
  return (
    <input
      aria-label={label}
      aria-invalid={invalid}
      value={draft}
      disabled={props.disabled}
      data-row={props.id}
      data-field={props.field}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (['Enter', 'Tab'].includes(e.key) && !commit()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      inputMode={payrollTextInput(props.field) ? 'text' : 'numeric'}
      onFocus={(e) => e.target.select()}
      autoComplete="off"
    />
  );
}
export function HrPayrollWorksheet({ data }: { data: HrBootstrapDto }) {
  const canRead = data.capabilities.sensitive;
  const writable = data.capabilities.write && canRead;
  const [list, setList] = useState<PayrollWorksheetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [branch, setBranch] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<PayrollWorksheet | null>(null);
  const [draft, setDraft] = useState<PayrollSnapshot | null>(null);
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [query, setQuery] = useState('');
  const [listFilters, setListFilters] = useState<PayrollListFilters>({
    ...defaultPayrollListFilters,
  });
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderBranch, setOrderBranch] = useState(data.branches[0]?.id ?? '');
  const [ratesOpen, setRatesOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const lock = useRef(false);
  const table = useRef<HTMLDivElement>(null);
  const current = draft ? JSON.stringify(draft) : '';
  const dirty = Boolean(sheet && current !== saved);
  const editable = writable && sheet?.status === 'DRAFT' && !busy;
  const pollingSheetId = sheet?.status === 'PENDING_FINANCE' ? sheet.id : null;
  const pollingList =
    !sheet && list.some((item) => item.status === 'PENDING_FINANCE');
  useEffect(() => {
    if (!canRead || (!pollingSheetId && !pollingList)) return;
    let active = true;
    const sync = async () => {
      try {
        if (pollingSheetId) {
          const status = await hrRequest<PayrollWorksheetSummary>(
            `${api}/${pollingSheetId}/status`,
          );
          if (active)
            setSheet((previous) =>
              previous?.id === pollingSheetId
                ? { ...previous, ...status }
                : previous,
            );
        } else {
          const rows = await hrRequest<PayrollWorksheetSummary[]>(api);
          if (active) setList(rows);
        }
      } catch {
        if (active)
          setError('دریافت وضعیت مالی انجام نشد؛ دوباره تلاش می‌شود.');
      }
    };
    const onFocus = () => void sync();
    const timer = window.setInterval(onFocus, 15000);
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [canRead, pollingSheetId, pollingList]);
  async function refresh() {
    setLoading(true);
    setError('');
    try {
      setList(await hrRequest<PayrollWorksheetSummary[]>(api));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'دریافت حقوق انجام نشد.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!canRead) return;
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [canRead]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  async function save() {
    if (!sheet || !draft || !dirty || lock.current || !editable) return;
    lock.current = true;
    setSaving(true);
    setSaveError('');
    const payload = JSON.stringify(draft);
    try {
      const result = await hrRequest<PayrollWorksheet>(`${api}/${sheet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: sheet.version, snapshot: draft }),
      });
      setSheet(result);
      setSaved(payload);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'ذخیره انجام نشد.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  useEffect(() => {
    if (!dirty || saveError || saving || !editable) return;
    const timer = window.setTimeout(() => void save(), 800);
    return () => window.clearTimeout(timer);
    // save captures this draft and version; later edits remain dirty until their own save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, saved, saving, saveError, editable, sheet?.version]);
  function loaded(result: PayrollWorksheet) {
    setSheet(result);
    setDraft(snapshot(result));
    setSaved(JSON.stringify(snapshot(result)));
    setSaveError('');
    setQuery('');
  }
  async function open(id: string) {
    if (busy || lock.current) return;
    setBusy(true);
    setError('');
    try {
      loaded(await hrRequest<PayrollWorksheet>(`${api}/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'دریافت حقوق انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  async function addRow() {
    if (!editable || !draft || draft.rows.length >= 500) return;
    setBusy(true);
    let defaults = { ...EMPLOYMENT_DEFAULTS };
    try {
      defaults = (
        await hrRequest<PayConfiguration>(payrollConfiguration(sheet!.branchId))
      ).values as typeof defaults;
    } catch {
      setError('دریافت حکم کارگزینی انجام نشد.');
      setBusy(false);
      return;
    }
    setBusy(false);
    const row = {
      ...emptyPayrollRow(crypto.randomUUID()),
      ...defaults,
      days: defaults.days || payrollMonthDays(sheet!.period),
    };

    setQuery('');
    setDraft((previous) =>
      previous ? { ...previous, rows: [...previous.rows, row] } : previous,
    );
    window.setTimeout(
      () =>
        table.current
          ?.querySelector<HTMLInputElement>(
            `input[data-row="${row.id}"][data-field="name"]`,
          )
          ?.focus(),
      0,
    );
  }
  async function selectEmployee(rowId: string, employeeId: string) {
    const employee = (data.employees ?? []).find(
      (e) => e.id === employeeId && e.branchId === sheet?.branchId,
    );
    if (!employee || !editable) return;
    setBusy(true);
    try {
      const [defaults, pay] = await Promise.all([
        hrRequest<PayConfiguration>(payrollConfiguration(employee.branchId)),
        hrRequest<PayConfiguration>(
          payrollConfiguration(employee.branchId, employeeId),
        ),
      ]);
      setDraft((previous) =>
        previous
          ? {
              ...previous,
              rows: previous.rows.map((row) =>
                row.id === rowId
                  ? {
                      ...row,
                      ...defaults.values,
                      ...pay.values,
                      overtimeHourly:
                        defaults.values.overtimeHourly ||
                        (
                          (BigInt(pay.values.daily || '0') *
                            BigInt(previous.rates.overtime) *
                            60n +
                            BigInt(previous.rates.dailyMinutes) * 5000n) /
                          (BigInt(previous.rates.dailyMinutes) * 10000n)
                        ).toString(),
                      shortageHourly:
                        defaults.values.shortageHourly ||
                        (
                          (BigInt(pay.values.daily || '0') * 60n +
                            BigInt(previous.rates.dailyMinutes) / 2n) /
                          BigInt(previous.rates.dailyMinutes)
                        ).toString(),
                      employeeId,
                      name: employee.name,
                      days:
                        defaults.values.days || payrollMonthDays(sheet!.period),
                    }
                  : row,
              ),
            }
          : previous,
      );
    } catch {
      setError('دریافت اطلاعات حقوق کارکن انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  function update(id: string, field: PayrollColumn, value: string) {
    if (!editable || !isPayrollInput(field)) return;
    setDraft((previous) =>
      previous
        ? {
            ...previous,
            rows: previous.rows.map((r) =>
              r.id === id ? { ...r, [field]: value } : r,
            ),
          }
        : previous,
    );
  }
  function paste(e: ClipboardEvent<HTMLDivElement>) {
    const target = e.target as HTMLInputElement;
    if (!editable || !draft || !target.dataset.field || !target.dataset.row)
      return;
    const text = e.clipboardData.getData('text/plain');
    if (!/[\t\n]/.test(text)) return;
    e.preventDefault();
    try {
      const rows = pastePayrollGrid(
        draft.rows,
        visible.map((row) => row.id),
        target.dataset.row,
        target.dataset.field,
        text,
        () => crypto.randomUUID(),
      );
      setDraft({ ...draft, rows });
      setQuery('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ورود داده انجام نشد.');
    }
  }
  const visible =
    draft?.rows.filter((row) => !query || row.name.includes(query)) ?? [];
  const calculated = draft
    ? visible.map((row) => calculatePayroll(row, draft.rates))
    : [];
  const total = (key: PayrollColumn | 'remaining') =>
    calculated.reduce(
      (sum, row) => sum + (payrollTextInput(key) ? 0n : BigInt(row[key])),
      0n,
    );
  function exportCsv() {
    if (!draft || !sheet) return;
    const safe = (s: string) =>
      `"${s.replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`;
    const text =
      '\ufeff' +
      [
        ['ردیف', ...PAYROLL_COLUMNS.map(([, v]) => v)].map(safe).join(','),
        ...calculated.map((row, i) =>
          [String(i + 1), ...PAYROLL_COLUMNS.map(([k]) => row[k])]
            .map(safe)
            .join(','),
        ),
      ].join('\r\n');
    const url = URL.createObjectURL(
        new Blob([text], { type: 'text/csv;charset=utf-8' }),
      ),
      a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${sheet.period}.csv`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function transition(approve: boolean) {
    if (!sheet || busy || dirty || saving) return;
    setBusy(true);
    setError('');
    try {
      loaded(
        await hrRequest<PayrollWorksheet>(
          `${api}/${sheet.id}/${approve ? 'approve' : 'reopen'}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ version: sheet.version }),
          },
        ),
      );
      window.dispatchEvent(new Event('nora:finance-inbox-refresh'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'عملیات انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  const filteredList = filterPayrollList(list, data.branches, listFilters);
  const years = Array.from(
    new Set([
      ...list.map((item) => item.period.slice(0, 4)),
      ...(listFilters.year ? [listFilters.year] : []),
    ]),
  )
    .sort()
    .reverse();
  const listFiltersChanged = (
    Object.keys(listFilters) as (keyof PayrollListFilters)[]
  ).some((key) => listFilters[key] !== defaultPayrollListFilters[key]);
  const updateListFilter = <K extends keyof PayrollListFilters>(
    key: K,
    value: PayrollListFilters[K],
  ) => setListFilters((previous) => ({ ...previous, [key]: value }));
  const createButton = (
    <HrButton
      primary
      disabled={!writable || busy || dirty || saving}
      onClick={() => {
        setCreateOpen(true);
        setYear('');
        setMonth('');
        setBranch('');
      }}
    >
      <Plus size={16} />
      افزودن حقوق
    </HrButton>
  );
  if (!canRead)
    return (
      <p role="alert">
        برای مشاهده حقوق، مجوز اطلاعات حساس منابع انسانی لازم است.
      </p>
    );
  return (
    <div className={styles.workspace}>
      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent
          style={{
            maxWidth: 920,
            width: 'calc(100vw - 32px)',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >
          <DialogTitle>حکم کارگزینی</DialogTitle>
          <NativeSearchSelect
            aria-label="شعبه حکم کارگزینی"
            value={orderBranch}
            onChange={(e) => setOrderBranch(e.target.value)}
          >
            {data.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </NativeSearchSelect>
          {orderBranch && (
            <HrPayrollConfiguration
              key={orderBranch}
              branchId={orderBranch}
              writable={writable}
            />
          )}
        </DialogContent>
      </Dialog>
      {sheet ? (
        <div className={styles.actions}>
          <HrButton
            disabled={busy || saving}
            onClick={() => {
              if (
                dirty &&
                !window.confirm('تغییرات ذخیره‌نشده کنار گذاشته شوند؟')
              )
                return;
              setSheet(null);
              setDraft(null);
              setSaveError('');
              void refresh();
            }}
          >
            <ArrowRight size={16} />
            بازگشت به فهرست حقوق
          </HrButton>
          <HrButton onClick={exportCsv}>
            <Download size={16} />
            خروجی اکسل (CSV)
          </HrButton>
          <HrButton onClick={() => window.print()}>گزارش PDF</HrButton>
          <HrButton
            disabled={!editable || saving}
            onClick={() => setRatesOpen(true)}
          >
            <Settings2 size={16} />
            ضرایب محاسبات
          </HrButton>
          {createButton}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      {saveError ? (
        <div role="alert" className={styles.error}>
          {saveError}
          <HrButton
            disabled={saving}
            onClick={() => {
              setSaveError('');
              void save();
            }}
          >
            تلاش دوباره برای ذخیره
          </HrButton>
          <HrButton
            disabled={saving || busy}
            onClick={() => {
              if (
                sheet &&
                window.confirm('تغییرات ذخیره‌نشده کنار گذاشته شوند؟')
              )
                void open(sheet.id);
            }}
          >
            به‌روزرسانی
          </HrButton>
        </div>
      ) : null}
      {sheet && draft ? (
        <>
          <div className={styles.stats}>
            {[
              ['خالص دریافتی ماه', total('net')],
              [
                'بیمه کارمند و مالیات',
                total('employeeInsurance') + total('tax'),
              ],
              ['مساعده', total('advance')],
              ['مانده قابل واریز', total('remaining')],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <span>{String(label)}</span>
                <strong>{number(value ?? 0n)}</strong>
                <small>ریال</small>
              </div>
            ))}
          </div>
          <HrPanel
            title={`${periodLabel(sheet.period)} — ${data.branches.find((b) => b.id === sheet.branchId)?.name ?? ''}`}
            actions={
              <HrButton
                primary
                disabled={!editable || draft.rows.length >= 500}
                onClick={addRow}
              >
                <Plus size={16} />
                افزودن ردیف
              </HrButton>
            }
          >
            <div className={styles.filters}>
              <label>
                جست‌وجوی کارمند
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <div
              className={styles.grid}
              ref={table}
              onPaste={paste}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                const input = e.target as HTMLInputElement;
                if (!input.dataset.row || !input.dataset.field) return;
                e.preventDefault();
                input.blur();
                const index = visible.findIndex(
                    (r) => r.id === input.dataset.row,
                  ),
                  next = visible[index + (e.shiftKey ? -1 : 1)];
                if (next)
                  table.current
                    ?.querySelector<HTMLInputElement>(
                      `input[data-row="${next.id}"][data-field="${input.dataset.field}"]`,
                    )
                    ?.focus();
                else if (!e.shiftKey) addRow();
              }}
            >
              <table>
                <thead>
                  <tr>
                    <th>ردیف</th>
                    {PAYROLL_COLUMNS.map(([key, label]) => (
                      <th key={key}>{label}</th>
                    ))}
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row, index) => {
                    const values = calculatePayroll(row, draft.rates);
                    return (
                      <tr key={row.id}>
                        <td>{number(index + 1)}</td>
                        {PAYROLL_COLUMNS.map(([key, label]) => (
                          <td key={key}>
                            {key === 'name' ? (
                              <NativeSearchSelect
                                aria-label={`کارکن، ردیف ${index + 1}`}
                                value={row.employeeId ?? ''}
                                disabled={!editable}
                                onChange={(e) =>
                                  void selectEmployee(row.id, e.target.value)
                                }
                              >
                                <option value="">
                                  {row.name || 'انتخاب کارکن'}
                                </option>
                                {(data.employees ?? [])
                                  .filter((e) => e.branchId === sheet?.branchId)
                                  .map((e) => (
                                    <option key={e.id} value={e.id}>
                                      {e.name} — {e.personnelCode}
                                    </option>
                                  ))}
                              </NativeSearchSelect>
                            ) : isPayrollInput(key) ? (
                              <Cell
                                id={row.id}
                                field={key}
                                label={`${label}، ردیف ${index + 1}`}
                                value={row[key]}
                                disabled={!editable}
                                onCommit={(value) => update(row.id, key, value)}
                                onError={setError}
                              />
                            ) : (
                              <output
                                aria-label={`${label}، ردیف ${index + 1}`}
                              >
                                {number(values[key])}
                              </output>
                            )}
                          </td>
                        ))}
                        <td>
                          <HrButton
                            variant="ghost"
                            disabled={!editable}
                            aria-label={`حذف ردیف ${index + 1}`}
                            onClick={() => setRemoveId(row.id)}
                          >
                            <Trash2 size={17} />
                          </HrButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>جمع</td>
                    {PAYROLL_COLUMNS.map(([key]) => (
                      <td key={key}>
                        {payrollTextInput(key) ? '' : number(total(key))}
                      </td>
                    ))}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            {!draft.rows.length ? (
              <div className={styles.empty}>هنوز ردیفی ثبت نشده است.</div>
            ) : null}
            <div className={styles.footer}>
              <span>
                {payrollWorksheetStatusLabels[sheet.status]} ·{' '}
                {number(draft.rows.length)} ردیف · ریال
              </span>
              {data.capabilities.approve &&
              writable &&
              ['DRAFT', 'HR_APPROVED'].includes(sheet.status) ? (
                <HrButton
                  disabled={dirty || saving || busy}
                  onClick={() => void transition(true)}
                >
                  تأیید حقوق
                </HrButton>
              ) : null}
              {data.capabilities.approve &&
              writable &&
              ['HR_APPROVED', 'CORRECTION_REQUIRED', 'REJECTED'].includes(
                sheet.status,
              ) ? (
                <HrButton
                  disabled={dirty || saving || busy}
                  onClick={() => void transition(false)}
                >
                  بازگشت به پیش‌نویس
                </HrButton>
              ) : null}
            </div>
          </HrPanel>
        </>
      ) : (
        <HrPanel
          title="تنظیمات حقوق"
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              {createButton}
              <HrButton disabled={!writable} onClick={() => setOrderOpen(true)}>
                حکم کارگزینی
              </HrButton>
            </div>
          }
        >
          <div
            className={styles.listFilters}
            role="search"
            aria-label="فیلتر فهرست حقوق"
          >
            <label>
              جست‌وجو
              <input
                type="search"
                value={listFilters.query}
                onChange={(e) => updateListFilter('query', e.target.value)}
                placeholder="دوره یا شعبه"
              />
            </label>
            <label>
              شعبه
              <NativeSearchSelect
                aria-label="شعبه"
                value={listFilters.branchId}
                onChange={(e) => updateListFilter('branchId', e.target.value)}
              >
                <option value="">همه شعبه‌های مجاز</option>
                {data.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </NativeSearchSelect>
            </label>
            <label>
              سال
              <NativeSearchSelect
                aria-label="سال"
                value={listFilters.year}
                onChange={(e) => updateListFilter('year', e.target.value)}
              >
                <option value="">همه سال‌ها</option>
                {years.map((value) => (
                  <option key={value} value={value}>
                    {Number(value).toLocaleString('fa-IR', {
                      useGrouping: false,
                    })}
                  </option>
                ))}
              </NativeSearchSelect>
            </label>
            <label>
              ماه
              <NativeSearchSelect
                aria-label="ماه"
                value={listFilters.month}
                onChange={(e) => updateListFilter('month', e.target.value)}
              >
                <option value="">همه ماه‌ها</option>
                {monthNames.map((label, index) => (
                  <option
                    key={label}
                    value={String(index + 1).padStart(2, '0')}
                  >
                    {label}
                  </option>
                ))}
              </NativeSearchSelect>
            </label>
            <label>
              وضعیت
              <NativeSearchSelect
                aria-label="وضعیت"
                value={listFilters.status}
                onChange={(e) =>
                  updateListFilter(
                    'status',
                    e.target.value as PayrollListFilters['status'],
                  )
                }
              >
                <option value="">همه وضعیت‌ها</option>
                {Object.entries(payrollWorksheetStatusLabels).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </NativeSearchSelect>
            </label>
            <label>
              ردیف‌های جدول
              <NativeSearchSelect
                aria-label="ردیف‌های جدول"
                value={listFilters.rows}
                onChange={(e) =>
                  updateListFilter(
                    'rows',
                    e.target.value as PayrollListFilters['rows'],
                  )
                }
              >
                <option value="">همه جدول‌ها</option>
                <option value="populated">دارای ردیف</option>
                <option value="empty">جدول‌های خالی</option>
              </NativeSearchSelect>
            </label>
            <label>
              مرتب‌سازی
              <NativeSearchSelect
                aria-label="مرتب‌سازی"
                value={listFilters.sort}
                onChange={(e) =>
                  updateListFilter(
                    'sort',
                    e.target.value as PayrollListFilters['sort'],
                  )
                }
              >
                <option value="periodDesc">جدیدترین دوره</option>
                <option value="periodAsc">قدیمی‌ترین دوره</option>
                <option value="updatedDesc">آخرین تغییر</option>
                <option value="rowsDesc">بیشترین ردیف</option>
              </NativeSearchSelect>
            </label>
          </div>
          <div className={styles.listTools}>
            <span
              role="status"
              aria-live="polite"
              aria-label="تعداد دوره‌های نمایش‌داده‌شده"
            >
              {loading
                ? 'در حال دریافت اطلاعات…'
                : `${number(filteredList.length)} / ${number(list.length)}`}
            </span>
            <div>
              <HrButton
                disabled={!listFiltersChanged}
                onClick={() => setListFilters({ ...defaultPayrollListFilters })}
              >
                پاک‌کردن فیلترها
              </HrButton>
              <HrButton disabled={loading} onClick={() => void refresh()}>
                به‌روزرسانی
              </HrButton>
            </div>
          </div>
          {loading ? (
            <HrLoading />
          ) : (
            <div className={styles.list}>
              <table aria-label="فهرست دوره‌های حقوق">
                <thead>
                  <tr>
                    <th>دوره حقوق</th>
                    <th>شعبه</th>
                    <th>تعداد ردیف</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((item) => (
                    <tr key={item.id}>
                      <td>{periodLabel(item.period)}</td>
                      <td>
                        {data.branches.find((b) => b.id === item.branchId)
                          ?.name ?? ''}
                      </td>
                      <td>{number(item.rowCount)}</td>
                      <td>
                        <HrStatus>
                          {payrollWorksheetStatusLabels[item.status]}
                        </HrStatus>
                      </td>
                      <td>
                        <HrButton
                          disabled={busy}
                          onClick={() => void open(item.id)}
                        >
                          باز کردن جدول
                        </HrButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredList.length ? (
                <div className={styles.empty}>
                  {list.length
                    ? 'حقوقی مطابق این فیلترها یافت نشد.'
                    : 'هنوز حقوقی ثبت نشده است.'}
                </div>
              ) : null}
            </div>
          )}
        </HrPanel>
      )}
      <Dialog
        open={createOpen}
        onOpenChange={(value) => {
          if (!busy) setCreateOpen(value);
        }}
      >
        <DialogContent dir="rtl" aria-describedby={undefined}>
          <DialogTitle>افزودن حقوق</DialogTitle>
          <form
            className={styles.form}
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setError('');
              try {
                const result = await hrRequest<PayrollWorksheet>(api, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    branchId: branch,
                    period: `${year}-${month}`,
                  }),
                });
                loaded(result);
                setCreateOpen(false);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : 'ثبت حقوق انجام نشد.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className={styles.filters}>
              <label>
                سال
                <input
                  value={year}
                  onChange={(e) =>
                    setYear(
                      e.target.value.replace(/[۰-۹]/g, (c) =>
                        String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)),
                      ),
                    )
                  }
                  required
                  inputMode="numeric"
                  pattern="1[34][0-9]{2}"
                  maxLength={4}
                  placeholder="۱۴۰۵"
                  disabled={busy}
                />
              </label>
              <label>
                دوره
                <NativeSearchSelect
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  required
                  disabled={busy}
                >
                  <option value="">انتخاب ماه</option>
                  {monthNames.map((name, index) => (
                    <option
                      key={name}
                      value={String(index + 1).padStart(2, '0')}
                    >
                      {name}
                    </option>
                  ))}
                </NativeSearchSelect>
              </label>
            </div>
            <label>
              شعبه
              <NativeSearchSelect
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                required
                disabled={busy}
              >
                <option value="">انتخاب شعبه</option>
                {data.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </NativeSearchSelect>
            </label>
            {error ? <p role="alert">{error}</p> : null}
            <HrButton primary type="submit" disabled={busy}>
              باز کردن جدول حقوق
            </HrButton>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={ratesOpen} onOpenChange={setRatesOpen}>
        <DialogContent dir="rtl" aria-describedby={undefined}>
          <DialogTitle>ضرایب محاسبات</DialogTitle>
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              setRatesOpen(false);
            }}
          >
            <span>مبالغ ورودی به ریال</span>
            {draft
              ? (
                  Object.entries({
                    employee: 'بیمه کارمند (%)',
                    unemployment: 'بیمه بیکاری (%)',
                    employer: 'بیمه کارفرما (%)',
                    overtime: 'ضریب اضافه‌کاری',
                    dailyMinutes: 'ساعت مبنای روز',
                  }) as [keyof PayrollSnapshot['rates'], string][]
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      min={key === 'dailyMinutes' ? '0.0166666667' : 0}
                      max={
                        key === 'dailyMinutes'
                          ? 24
                          : key === 'overtime'
                            ? 10
                            : 100
                      }
                      step={key === 'dailyMinutes' ? 'any' : '.01'}
                      value={
                        draft.rates[key] /
                        (key === 'dailyMinutes'
                          ? 60
                          : key === 'overtime'
                            ? 10000
                            : 100)
                      }
                      required
                      disabled={!editable}
                      onChange={(e) => {
                        const factor =
                            key === 'dailyMinutes'
                              ? 60
                              : key === 'overtime'
                                ? 10000
                                : 100,
                          value = Math.round(Number(e.target.value) * factor);
                        if (
                          Number.isFinite(value) &&
                          (key !== 'dailyMinutes' || value > 0)
                        )
                          setDraft({
                            ...draft,
                            rates: { ...draft.rates, [key]: value },
                          });
                      }}
                    />
                  </label>
                ))
              : null}
            <HrButton primary type="submit">
              بستن
            </HrButton>
          </form>
        </DialogContent>
      </Dialog>
      {removeId ? (
        <HrConfirmDelete
          title="ردیف حقوق"
          onClose={() => setRemoveId(null)}
          onConfirm={async () => {
            if (editable)
              setDraft((previous) =>
                previous
                  ? {
                      ...previous,
                      rows: previous.rows.filter((r) => r.id !== removeId),
                    }
                  : previous,
              );
          }}
        />
      ) : null}
    </div>
  );
}
