'use client';
import { useRef, useState } from 'react';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { HR_RADAN_LEAVE_TYPES } from '@nora/contracts';
import type { HrRecordDto } from '@nora/contracts';
import type { HrStore } from './hr-store';
import { hrRequest } from './hr-api';
import { HrButton, HrExportButton, HrTable } from './hr-controls';
import { useHrReferenceData } from './hr-reference-data';
import ui from './hr-unified.module.css';

export const currentPersianYear = (date = new Date()) =>
  Number(
    new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
      year: 'numeric',
      timeZone: 'Asia/Tehran',
    })
      .formatToParts(date)
      .find((part) => part.type === 'year')?.value,
  );
export const minuteText = (value: number) =>
  `${value < 0 ? '-' : ''}${Math.floor(Math.abs(value) / 60)}:${String(Math.abs(value) % 60).padStart(2, '0')}`;
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
export function HrRadanTools({ tab, store }: { tab: string; store: HrStore }) {
  const refs = useHrReferenceData(store);
  const [year, setYear] = useState(String(currentPersianYear()));
  const [month, setMonth] = useState('1');
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [selectedMonths, setMonths] = useState<number[]>([1]);
  const [duration, setDuration] = useState('');
  const [type, setType] = useState('استحقاقی');
  const [ruleId, setRuleId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cardex, setCardex] = useState<{
    items: HrRecordDto[];
    balanceMinutes: number;
  } | null>(null);
  const key = useRef(crypto.randomUUID());
  const [file, setFile] = useState<File | null>(null);
  const [branchId, setBranchId] = useState(store.data!.branchIds[0] ?? '');
  const canWrite = store.data!.capabilities.write;
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'عملیات انجام نشد.');
    } finally {
      setBusy(false);
    }
  };
  if (!['minuteLedger', 'leaveTransferRules', 'importedPayslips'].includes(tab))
    return null;
  const ledger = tab !== 'importedPayslips';
  return (
    <details open className={ui.spaced}>
      <summary>
        {ledger
          ? 'سهمیه، انتقال و کاردکس ساعت:دقیقه'
          : 'ورود و نمایش فیش حقوقی'}
      </summary>
      <div className={ui.filters}>
        <label>
          سال شمسی
          <input
            type="number"
            min="1300"
            max="1600"
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setCardex(null);
              key.current = crypto.randomUUID();
            }}
          />
        </label>
        {ledger ? (
          <>
            <label>
              کارکنان
              <select
                multiple
                value={employeeIds}
                onChange={(e) => {
                  setEmployeeIds(
                    Array.from(e.target.selectedOptions, (o) => o.value),
                  );
                  setCardex(null);
                  key.current = crypto.randomUUID();
                }}
              >
                {refs.data.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.personnelCode} — {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              نوع مرخصی
              <NativeSearchSelect
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  key.current = crypto.randomUUID();
                }}
              >
                {HR_RADAN_LEAVE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </NativeSearchSelect>
            </label>
            <label>
              ماه‌ها
              <select
                multiple
                value={selectedMonths.map(String)}
                onChange={(e) => {
                  setMonths(
                    Array.from(e.target.selectedOptions, (o) =>
                      Number(o.value),
                    ),
                  );
                  key.current = crypto.randomUUID();
                }}
              >
                {months.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <HrButton
              disabled={busy}
              onClick={() =>
                setMonths(Array.from({ length: 12 }, (_, i) => i + 1))
              }
            >
              همه ماه‌ها
            </HrButton>
            <label>
              مقدار ساعت:دقیقه
              <input
                placeholder="16:20"
                value={duration}
                onChange={(e) => {
                  setDuration(e.target.value);
                  key.current = crypto.randomUUID();
                }}
              />
            </label>
            <label>
              قاعده انتقال
              <NativeSearchSelect
                value={ruleId}
                onChange={(e) => {
                  setRuleId(e.target.value);
                  key.current = crypto.randomUUID();
                }}
              >
                <option value="">انتخاب قاعده</option>
                {refs.data.records
                  .filter(
                    (r) =>
                      r.section === 'time' &&
                      r.tab === 'leaveTransferRules' &&
                      r.status === 'فعال',
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.values[0]}
                    </option>
                  ))}
              </NativeSearchSelect>
            </label>
            {canWrite && store.data!.capabilities.approve ? (
              <>
                <HrButton
                  disabled={
                    busy || refs.loading || !!refs.error || !employeeIds.length
                  }
                  onClick={() =>
                    void run(async () => {
                      await hrRequest('/leave/minutes', {
                        method: 'POST',
                        headers: {
                          'content-type': 'application/json',
                          'Idempotency-Key': key.current,
                        },
                        body: JSON.stringify({
                          employeeIds,
                          year: Number(year),
                          months: selectedMonths,
                          duration,
                          type,
                        }),
                      });
                      key.current = crypto.randomUUID();
                      await store.mutated();
                      setNotice('سهمیه دقیقه‌ای ثبت شد.');
                    })
                  }
                >
                  ثبت سهمیه
                </HrButton>
                <HrButton
                  disabled={busy || !ruleId || !employeeIds.length}
                  onClick={() =>
                    void run(async () => {
                      await hrRequest('/leave/minutes', {
                        method: 'POST',
                        headers: {
                          'content-type': 'application/json',
                          'Idempotency-Key': key.current,
                        },
                        body: JSON.stringify({
                          employeeIds,
                          year: Number(year),
                          type,
                          ruleId,
                        }),
                      });
                      key.current = crypto.randomUUID();
                      await store.mutated();
                      setNotice('انتقال، سوخت و بازخرید ثبت شد.');
                    })
                  }
                >
                  اجرای انتقال
                </HrButton>
              </>
            ) : null}
            <HrButton
              disabled={busy || employeeIds.length !== 1}
              onClick={() =>
                void run(async () => {
                  setCardex(
                    await hrRequest(
                      `/leave/cardex?employeeId=${employeeIds[0]}&year=${year}`,
                    ),
                  );
                })
              }
            >
              گرفتن گزارش مانده
            </HrButton>
          </>
        ) : (
          <>
            <label>
              ماه
              <NativeSearchSelect
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              >
                {months.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </NativeSearchSelect>
            </label>
            {canWrite && store.data!.capabilities.sensitive ? (
              <>
                <label>
                  شعبه
                  <NativeSearchSelect
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                  >
                    {store.data!.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </NativeSearchSelect>
                </label>
                <label>
                  اکسل فیش (تا ۱۰ مگابایت)
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                      key.current = crypto.randomUUID();
                    }}
                  />
                </label>
                <HrButton
                  disabled={busy || !file}
                  onClick={() =>
                    void run(async () => {
                      if (!file || file.size > 10 * 1024 * 1024)
                        throw new Error('حداکثر اندازه فایل ۱۰ مگابایت است.');
                      const form = new FormData();
                      form.set('file', file);
                      form.set('branchId', branchId);
                      form.set('year', year);
                      form.set('month', month);
                      await hrRequest('/payslips/import', {
                        method: 'POST',
                        headers: { 'Idempotency-Key': key.current },
                        body: form,
                      });
                      key.current = crypto.randomUUID();
                      await store.mutated();
                      setNotice('فیش‌ها وارد شدند.');
                    })
                  }
                >
                  بارگذاری اکسل
                </HrButton>
                <HrButton
                  onClick={() =>
                    void run(async () => {
                      const { downloadHrXlsx } = await import('./hr-xlsx');
                      await downloadHrXlsx('payslip-import-template.xlsx', [
                        ['کد پرسنلی', 'حقوق ناخالص', 'کسورات', 'خالص پرداختی'],
                      ]);
                    })
                  }
                >
                  قالب اکسل
                </HrButton>
              </>
            ) : null}
            <HrTable
              data={{
                columns: ['کارمند', 'سال شمسی', 'ماه', 'عنوان', 'مقدار'],
                rows: refs.data.records
                  .filter(
                    (r) =>
                      r.tab === 'importedPayslips' &&
                      r.section === 'payroll' &&
                      r.values[1] === year &&
                      r.values[2] === month,
                  )
                  .map((r) => r.values),
                totalLabel: '',
              }}
            />
          </>
        )}
      </div>
      {cardex ? (
        <>
          <p>
            مانده ساعت:دقیقه: <bdi>{minuteText(cardex.balanceMinutes)}</bdi>
          </p>
          <HrTable
            data={{
              columns: [
                'کارمند',
                'سال شمسی',
                'ماه',
                'نوع مرخصی',
                'عملیات',
                'دقیقه',
                'مرجع',
              ],
              rows: cardex.items.map((r) => r.values),
              totalLabel: '',
            }}
          />
          <HrExportButton
            data={{
              columns: [
                'کارمند',
                'سال شمسی',
                'ماه',
                'نوع مرخصی',
                'عملیات',
                'دقیقه',
                'مرجع',
              ],
              rows: cardex.items.map((r) => r.values),
              totalLabel: '',
            }}
            name="leave-cardex"
          />
        </>
      ) : null}
      {error || refs.error ? <p role="alert">{error || refs.error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
    </details>
  );
}
export function HrBackupButton({ store }: { store: HrStore }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (
    !store.data!.capabilities.write ||
    !store.data!.capabilities.sensitive ||
    !store.data!.capabilities.audit
  )
    return null;
  return (
    <>
      <HrButton
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError('');
          void hrRequest('/backup', { method: 'POST' })
            .then((snapshot) => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(snapshot)], {
                  type: 'application/json',
                }),
              );
              const a = document.createElement('a');
              a.href = url;
              a.download = `hr-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            })
            .catch((e) =>
              setError(
                e instanceof Error ? e.message : 'پشتیبان‌گیری انجام نشد.',
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        پشتیبان‌گیری داده‌ها
      </HrButton>
      {error ? <p role="alert">{error}</p> : null}
    </>
  );
}
