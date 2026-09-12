'use client';
import { useEffect, useState } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { Lookup, rateRequest, type Option } from './controls';
import { kinds, labels, type Factors } from './model';
import styles from './rates.module.css';
type HistoryRow = {
  id: string;
  hotelName: string;
  brokerName: string;
  base: string;
  factors: Factors;
  prices: Record<string, string>;
  batch: {
    checkIn: string;
    checkOut: string;
    currency: string;
    method: string;
    createdAt: string;
  };
};
export function RateHistory({ revision }: { revision: number }) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hotel, setHotel] = useState<Option | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      page: String(page),
      ...(hotel ? { hotelId: hotel.id } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    });
    void Promise.resolve().then(() => {
      if (active) setLoading(true);
    });
    rateRequest<{ data: HistoryRow[]; total: number }>('?' + params)
      .then((r) => {
        if (active) {
          setHistory(r.data);
          setTotal(r.total);
          setError('');
        }
      })
      .catch((e) => {
        if (active) {
          setHistory([]);
          setTotal(0);
          setError(e.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, hotel, from, to, revision]);
  return (
    <section>
      <h2>سابقه نرخ‌های ثبت‌شده</h2>
      <div className={styles.fields}>
        <Lookup
          kind="hotels"
          label="هتل سابقه"
          value={hotel}
          onChange={(h) => {
            setHotel(h);
            setPage(1);
          }}
        />
        <label>
          از تاریخ
          <DatePicker
            value={from}
            onChange={(value) => {
              setFrom(value);
              setPage(1);
            }}
          />
        </label>
        <label>
          تا تاریخ
          <DatePicker
            value={to}
            onChange={(value) => {
              setTo(value);
              setPage(1);
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setHotel(null);
            setFrom('');
            setTo('');
            setPage(1);
          }}
        >
          پاک‌کردن فیلترها
        </button>
      </div>
      {loading ? (
        <p>در حال بارگذاری…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          <p>{total} نرخ · بازه فیلتر با بازه اقامت تطبیق داده می‌شود.</p>
          <div className={styles.scroll}>
            <table>
              <thead>
                <tr>
                  <th>HOTEL</th>
                  <th>ورود / خروج</th>
                  <th>کارگزار</th>
                  <th>قیمت پایه</th>
                  {labels.map((l) => (
                    <th key={l}>{l}</th>
                  ))}
                  <th>مبنای نرخ</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id}>
                    <td dir="ltr">{r.hotelName}</td>
                    <td dir="ltr">
                      {r.batch.checkIn.slice(0, 10)}
                      <br />
                      {r.batch.checkOut.slice(0, 10)}
                    </td>
                    <td>{r.brokerName}</td>
                    <td dir="ltr">
                      {r.base} {r.batch.currency}
                    </td>
                    {kinds.map((k) => (
                      <td key={k} dir="ltr">
                        {r.prices[k]}
                        <small>× {r.factors[k]}</small>
                      </td>
                    ))}
                    <td>
                      {r.batch.method === 'CHECK_IN'
                        ? 'تاریخ ورود'
                        : 'شب‌های اقامت'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!history.length && <p>نرخی در این بازه پیدا نشد.</p>}
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            قبلی
          </button>
          <span> صفحه {page} </span>
          <button
            disabled={page * 50 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            بعدی
          </button>
        </>
      )}
    </section>
  );
}
