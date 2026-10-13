'use client';

import { useEffect, useState } from 'react';
import type { LoginResponse } from '@nora/contracts';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { loadPackDirectory } from './existing-packs-model';
import { rateRequest } from './controls';
import type { PackDetail, PackSummary } from './packs-workspace';
import { SavedPackHotelPrices } from './existing-packs-browser';
import styles from './hotel-rate-hub.module.css';

const archiveDirectoryRequest = <T,>(path: string) =>
  rateRequest<T>(`${path}&includeArchived=true`);

export function PackArchivePanel() {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [branch, setBranch] = useState('');
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<PackSummary | null>(null);
  const [detail, setDetail] = useState<PackDetail | null>(null);
  useEffect(() => {
    let active = true;
    refreshAuthenticatedSession(getPublicApiBaseUrl() ?? '')
      .then((value) => {
        if (!active) return;
        setSession(value);
        setBranch(value?.user.branches[0]?.id ?? '');
        if (!value?.user.branches.length) setLoading(false);
      })
      .catch(() => {
        if (active) {
          setLoading(false);
          setError('نشست کاربری دریافت نشد.');
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!branch) return;
    let active = true;
    loadPackDirectory(branch, archiveDirectoryRequest)
      .then((result) => {
        if (active) setPacks(result);
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'فهرست بسته‌ها دریافت نشد.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [branch, revision]);
  function reload(nextBranch = branch) {
    setLoading(true);
    setError('');
    setPacks([]);
    setSelected(null);
    setDetail(null);
    setBranch(nextBranch);
    setRevision((value) => value + 1);
  }
  const canWrite =
    session?.user.permissions.includes('reservations.hotel_purchase.write') ??
    false;
  async function archive() {
    if (!selected || busy || !canWrite) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await rateRequest(`/packs/${selected.id}/archive`, {
        method: 'POST',
        body: JSON.stringify({ expectedVersion: selected.version }),
      });
      setSelected(null);
      setMessage('بسته کنار گذاشته شد؛ سابقهٔ نرخ‌ها محفوظ است.');
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'کنارگذاری بسته انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  async function showDetail(id: string) {
    setBusy(true);
    setError('');
    setDetail(null);
    try {
      setDetail(await rateRequest<PackDetail>(`/packs/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'بسته دریافت نشد.');
    } finally {
      setBusy(false);
    }
  }
  if (!session && !loading)
    return <p role="alert">برای مشاهدهٔ بسته‌ها وارد سامانه شوید.</p>;
  if (session && !session.user.permissions.includes('reservations.read'))
    return <p role="alert">مجوز مشاهدهٔ رزرواسیون ندارید.</p>;
  const key = search.trim().normalize('NFKC').toLocaleLowerCase();
  const visible = packs.filter((pack) =>
    `${pack.cityName} ${pack.tourLabel ?? ''} ${pack.checkIn} ${pack.checkOut} ${pack.currency}`
      .normalize('NFKC')
      .toLocaleLowerCase()
      .includes(key),
  );
  return (
    <section className={styles.panel} aria-label="کنارگذاری بسته‌های نرخ هتل">
      <div className={styles.filters}>
        <label>
          شعبه
          <select
            value={branch}
            disabled={busy}
            onChange={(e) => reload(e.target.value)}
          >
            {session?.user.branches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          جست‌وجوی بسته
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="شهر، تور، تاریخ یا ارز"
          />
        </label>
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => reload()}
        >
          تازه‌سازی
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {loading && <p role="status">در حال دریافت بسته‌ها…</p>}
      {selected && (
        <div className={styles.confirmation} role="alert">
          <p>
            {selected.cityName} ·{' '}
            <bdi>
              {selected.checkIn} — {selected.checkOut}
            </bdi>{' '}
            · {selected.hotelCount} هتل
          </p>
          <p>
            این بسته از انتخاب نرخ‌های جدید کنار گذاشته می‌شود. سوابق قبلی حفظ
            می‌شوند.
          </p>
          <button type="button" disabled={busy} onClick={() => void archive()}>
            تأیید کنارگذاری
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setSelected(null)}
          >
            انصراف
          </button>
        </div>
      )}
      <div className={styles.table}>
        <table>
          <thead>
            <tr>
              <th>شهر / تور</th>
              <th>بازهٔ نرخ</th>
              <th>هتل</th>
              <th>ارز</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((pack) => (
              <tr key={pack.id}>
                <td>
                  {pack.cityName}
                  {pack.tourLabel && <small> · {pack.tourLabel}</small>}
                </td>
                <td>
                  <bdi>
                    {pack.checkIn} — {pack.checkOut}
                  </bdi>
                </td>
                <td>{pack.hotelCount}</td>
                <td>{pack.currency}</td>
                <td>
                  {pack.archivedAt ? (
                    <>
                      کنارگذاشته‌شده <bdi>{pack.archivedAt.slice(0, 10)}</bdi>
                    </>
                  ) : (
                    'فعال'
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    disabled={busy || loading}
                    onClick={() => void showDetail(pack.id)}
                  >
                    مشاهدهٔ نرخ‌ها
                  </button>
                  {!pack.archivedAt && (
                    <button
                      type="button"
                      disabled={!canWrite || busy || loading}
                      onClick={() => {
                        setSelected(pack);
                        setMessage('');
                      }}
                    >
                      کنارگذاری
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && !visible.length && <p>بسته‌ای مطابق جست‌وجو پیدا نشد.</p>}
      {detail && (
        <SavedPackHotelPrices
          pack={detail}
          search=""
          disabled
          onChange={() => undefined}
        />
      )}
    </section>
  );
}
