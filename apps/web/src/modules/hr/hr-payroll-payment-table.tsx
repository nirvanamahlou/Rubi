'use client';
import { useRef, useState } from 'react';
import type { HrBootstrapDto } from '@nora/contracts';
import { MoneyInput } from '@/components/ui/money-input';
import { Input } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { HrButton } from './hr-controls';
import { HrApiError, hrRequest } from './hr-api';

export function HrPayrollPaymentTable({ data }: { data: HrBootstrapDto }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [currencyCode, setCurrencyCode] = useState('IRR');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  // Retain immutable command keys after network errors, so retries cannot duplicate payments.
  const attempts = useRef(new Map<string, { payload: string; key: string }>());
  const locked = useRef(false);
  const canSubmit =
    data.capabilities.write &&
    data.capabilities.approve &&
    data.capabilities.sensitive;
  const employees = data.employees.filter(
    (employee) =>
      !['غیرفعال', 'خاتمه همکاری', 'قطع همکاری'].includes(employee.status),
  );
  async function submit(employeeId: string) {
    if (locked.current) return;
    const amount = amounts[employeeId] ?? '';
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(period) ||
      !dueAt ||
      !/^\d+(\.\d{1,4})?$/.test(amount) ||
      !/[1-9]/.test(amount)
    ) {
      setResults((previous) => ({
        ...previous,
        [employeeId]: 'دوره میلادی، تاریخ پرداخت و مبلغ مثبت را وارد کنید.',
      }));
      return;
    }
    const payload = JSON.stringify({
      employeeId,
      period,
      amount,
      currencyCode,
      dueAt,
    });
    const previous = attempts.current.get(employeeId);
    if (previous && previous.payload !== payload) {
      setResults((values) => ({
        ...values,
        [employeeId]:
          'ابتدا ارسال قبلی را با همان اطلاعات تکمیل کنید؛ نتیجه آن ممکن است ثبت شده باشد.',
      }));
      return;
    }
    const attempt = previous ?? { payload, key: crypto.randomUUID() };
    attempts.current.set(employeeId, attempt);
    setPendingIds((ids) =>
      ids.includes(employeeId) ? ids : [...ids, employeeId],
    );
    locked.current = true;
    setBusy(employeeId);
    try {
      const result = await hrRequest<{ requestId: string }>(
        '/payroll-finance',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': attempt.key,
          },
          body: attempt.payload,
        },
      );
      setResults((values) => ({
        ...values,
        [employeeId]: `ارسال شد — درخواست ${result.requestId}`,
      }));
      window.dispatchEvent(new Event('nora:finance-inbox-refresh'));
    } catch (error) {
      if (error instanceof HrApiError && [400, 403].includes(error.status)) {
        attempts.current.delete(employeeId);
        setPendingIds((ids) => ids.filter((id) => id !== employeeId));
      }
      setResults((values) => ({
        ...values,
        [employeeId]:
          error instanceof Error
            ? error.message
            : 'ارسال انجام نشد؛ دوباره تلاش کنید.',
      }));
    } finally {
      locked.current = false;
      setBusy(null);
    }
  }
  return (
    <section
      className="rounded-xl border bg-white p-4"
      aria-label="ثبت حقوق کارکنان"
    >
      <HrButton onClick={() => setOpen((value) => !value)}>
        جدول ثبت حقوق و ارسال به مالی
      </HrButton>
      {pendingIds.length > 0 &&
      pendingIds.every((id) => results[id]?.startsWith('ارسال شد')) ? (
        <HrButton
          onClick={() => {
            attempts.current.clear();
            setPendingIds([]);
            setResults({});
            setAmounts({});
            setPeriod('');
            setDueAt('');
          }}
        >
          دوره حقوق جدید
        </HrButton>
      ) : null}
      {open ? (
        <div className="mt-4 space-y-4">
          <p>
            مبلغ واردشده، حقوق قابل پرداخت تأییدشده است؛ این جدول فیش یا محاسبه
            کسورات نیست. هر کارمند در هر دوره فقط یک درخواست پرداخت دارد.
          </p>
          {!canSubmit ? (
            <p role="alert">
              برای ارسال، مجوز مدیریت، تأیید و اطلاعات حساس منابع انسانی لازم
              است.
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-3">
            <label>
              دوره حقوق (میلادی، مانند 2026-10)
              <Input
                value={period}
                disabled={busy !== null || pendingIds.length > 0}
                onChange={(event) => setPeriod(event.target.value)}
                placeholder="2026-10"
                dir="ltr"
              />
            </label>
            <label>
              تاریخ پرداخت
              <DatePicker
                value={dueAt}
                disabled={busy !== null || pendingIds.length > 0}
                onChange={setDueAt}
              />
            </label>
            <label>
              کد ارز
              <Input
                value={currencyCode}
                disabled={busy !== null || pendingIds.length > 0}
                maxLength={3}
                onChange={(event) =>
                  setCurrencyCode(event.target.value.toUpperCase())
                }
                dir="ltr"
              />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr>
                  <th>نام کارمند / کاربر مرتبط</th>
                  <th>کد پرسنلی</th>
                  <th>شعبه</th>
                  <th>مبلغ حقوق</th>
                  <th>ارسال و نتیجه</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id} className="border-t">
                    <td className="p-2">
                      {employee.name}
                      {employee.userId ? ' — حساب کاربری متصل' : ''}
                    </td>
                    <td>{employee.personnelCode}</td>
                    <td>
                      {data.branches.find(
                        (branch) => branch.id === employee.branchId,
                      )?.name ?? employee.branchId}
                    </td>
                    <td className="p-2">
                      <MoneyInput
                        aria-label={`حقوق ${employee.name}`}
                        value={amounts[employee.id] ?? ''}
                        disabled={
                          !canSubmit ||
                          busy !== null ||
                          pendingIds.includes(employee.id)
                        }
                        onValueChange={(amount) =>
                          setAmounts((values) => ({
                            ...values,
                            [employee.id]: amount,
                          }))
                        }
                      />
                    </td>
                    <td className="p-2">
                      <HrButton
                        disabled={
                          !canSubmit ||
                          busy !== null ||
                          results[employee.id]?.startsWith('ارسال شد')
                        }
                        onClick={() => void submit(employee.id)}
                      >
                        {busy === employee.id
                          ? 'در حال ارسال…'
                          : 'تأیید و ارسال به مالی'}
                      </HrButton>
                      <p role="status">{results[employee.id]}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!employees.length ? (
            <p>کارمند فعالی در محدوده مجاز شما وجود ندارد.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
