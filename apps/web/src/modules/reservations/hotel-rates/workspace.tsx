'use client';
import { useEffect, useRef, useState } from 'react';
import type { LoginResponse } from '@rubi/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { Choice, Lookup, rateRequest, type Option } from './controls';
import { kinds, labels, initialFactors, price, type Factors } from './model';
import { RateHistory } from './history';
import styles from './rates.module.css';
type Row = {
  id: string;
  hotel: Option | null;
  broker: Option | null;
  base: string;
  factors: Factors;
};
const blank = (): Row => ({
  id: crypto.randomUUID(),
  hotel: null,
  broker: null,
  base: '',
  factors: { ...initialFactors },
});
export function HotelGroupRates() {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [branch, setBranch] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [method, setMethod] = useState('CHECK_IN');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const pending = useRef<{ body: string; key: string } | null>(null);
  useEffect(() => {
    let active = true;
    refreshAuthenticatedSession(getPublicApiBaseUrl() ?? '')
      .then((s) => {
        if (active) {
          setSession(s);
          setBranch(s?.user.branches[0]?.id ?? '');
          setRows([blank()]);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setError('ورود به سامانه لازم است.');
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  if (!ready) return <p>در حال بارگذاری…</p>;
  if (!session)
    return (
      <p role="alert">
        ورود به سامانه لازم است.{' '}
        <a href="/login?next=%2Freservations%2Fhotel-rates">ورود</a>
      </p>
    );
  if (!session.user.permissions.includes('reservations.read'))
    return <p role="alert">مجوز مشاهده رزرواسیون ندارید.</p>;
  const canWrite = session.user.permissions.includes(
    'reservations.hotel_purchase.write',
  );
  const nights =
    checkIn && checkOut
      ? (Date.parse(checkOut) - Date.parse(checkIn)) / 86400000
      : 0;
  const change = (id: string, patch: Partial<Row>) =>
    setRows((old) => old.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (
      !rows.length ||
      rows.some((r) => !r.hotel || !r.broker) ||
      nights <= 0
    ) {
      setError('بازه معتبر، هتل و کارگزار تمام ردیف‌ها را انتخاب کنید.');
      return;
    }
    const body = JSON.stringify({
      branchId: branch,
      checkIn,
      checkOut,
      currency,
      method,
      rows: rows.map((r) => ({
        hotelId: r.hotel!.id,
        brokerId: r.broker!.id,
        base: r.base,
        factors: r.factors,
      })),
    });
    if (pending.current?.body !== body)
      pending.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    try {
      await rateRequest('', {
        method: 'POST',
        body,
        headers: { 'idempotency-key': pending.current!.key },
      });
      pending.current = null;
      setMessage(`${rows.length} نرخ ثبت شد.`);
      setRows([blank()]);
      setRevision((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={styles.root} dir="rtl">
      <header>
        <p>رزرواسیون / نرخ هتل‌ها</p>
        <h1>مدیریت گروهی نرخ‌های هتل‌ها</h1>
        <p>ثبت قیمت خرید دریافتی از کارگزار در بازهٔ اقامت مشخص</p>
      </header>
      <form onSubmit={save}>
        <fieldset disabled={busy || !canWrite}>
          <section>
            <h2>۱ · بازه اقامت</h2>
            <div className={styles.fields}>
              <label>
                شعبه
                <Choice
                  label="شعبه"
                  value={branch}
                  onChange={setBranch}
                  options={session.user.branches.map((b) => ({
                    id: b.id,
                    name: b.name,
                  }))}
                />
              </label>
              <label>
                ورود به هتل
                <input
                  type="date"
                  required
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </label>
              <label>
                خروج از هتل
                <input
                  type="date"
                  required
                  min={checkIn}
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                />
              </label>
              <label>
                واحد قیمت
                <Choice
                  label="واحد قیمت"
                  value={currency}
                  onChange={setCurrency}
                  options={[
                    { id: 'EUR', name: 'یورو · EUR' },
                    { id: 'USD', name: 'دلار · USD' },
                    { id: 'IRR', name: 'ریال · IRR' },
                  ]}
                />
              </label>
              <label>
                مبنای نرخ‌گذاری
                <Choice
                  label="مبنای نرخ‌گذاری"
                  value={method}
                  onChange={setMethod}
                  options={[
                    { id: 'CHECK_IN', name: 'تاریخ ورود' },
                    { id: 'STAY', name: 'شب‌های اقامت' },
                  ]}
                />
              </label>
            </div>
            <p>
              {nights > 0
                ? `${nights} شب اقامت · روز خروج جزو شب‌های اقامت نیست.`
                : 'تاریخ‌ها را به میلادی انتخاب کنید.'}
            </p>
          </section>
          <section>
            <h2>۲ · هتل‌ها و ضرایب اتاق</h2>
            <p>
              قیمت هر اتاق در هر شب = قیمت پایه × ضریب؛ مبلغ ریالی را به ریال
              وارد کنید.
            </p>
            <div className={styles.scroll}>
              <table>
                <thead>
                  <tr>
                    <th>HOTEL</th>
                    <th>کارگزار این نرخ</th>
                    <th>قیمت پایه / شب</th>
                    {labels.map((l) => (
                      <th key={l}>{l}</th>
                    ))}
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id}>
                      <td>
                        <Lookup
                          kind="hotels"
                          label={`هتل ردیف ${i + 1}`}
                          value={r.hotel}
                          onChange={(hotel) => change(r.id, { hotel })}
                        />
                      </td>
                      <td>
                        <Lookup
                          kind="organizations"
                          label={`کارگزار ردیف ${i + 1}`}
                          value={r.broker}
                          onChange={(broker) => change(r.id, { broker })}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`قیمت پایه ردیف ${i + 1}`}
                          type="number"
                          min={currency === 'IRR' ? '1' : '0.01'}
                          step={currency === 'IRR' ? '1' : '0.01'}
                          max="999999999999"
                          required
                          value={r.base}
                          onChange={(e) =>
                            change(r.id, { base: e.target.value })
                          }
                        />
                        <small>{currency}</small>
                      </td>
                      {kinds.map((k, j) => (
                        <td key={k}>
                          <input
                            aria-label={`ضریب ${labels[j]} ردیف ${i + 1}`}
                            type="number"
                            min="0"
                            max="999.999"
                            step="0.001"
                            required
                            value={r.factors[k]}
                            onChange={(e) =>
                              change(r.id, {
                                factors: { ...r.factors, [k]: e.target.value },
                              })
                            }
                          />
                          <output dir="ltr">
                            {price(r.base, r.factors[k], currency)}
                          </output>
                        </td>
                      ))}
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            setRows((old) => old.filter((x) => x.id !== r.id))
                          }
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              disabled={rows.length >= 50}
              onClick={() => setRows((old) => [...old, blank()])}
            >
              افزودن هتل
            </button>
          </section>
          <section>
            <h2>۳ · ثبت نهایی</h2>
            <p>
              هر نرخ با نام کارگزار و بازهٔ اقامت در سابقهٔ هتل ذخیره می‌شود.
              ثبت جدید، سابقهٔ قبلی را پاک نمی‌کند.
            </p>
            <button className={styles.primary} type="submit">
              {busy ? 'در حال ثبت…' : `ثبت ${rows.length} نرخ`}
            </button>
          </section>
        </fieldset>
      </form>
      {!canWrite && (
        <p role="alert">مجوز ثبت نرخ خرید ندارید؛ مشاهده سابقه در دسترس است.</p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <RateHistory revision={revision} />
    </main>
  );
}
