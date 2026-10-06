'use client';

import { useEffect, useRef, useState } from 'react';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { rateRequest } from './controls';
import { OccupancyRateEditor } from './occupancy-import-panel';
import type { PackDetail, PackSummary } from './packs-workspace';
import {
  loadPackDirectory,
  packCities,
  packsForCity,
  PackPriceSave,
  visiblePackHotels,
} from './existing-packs-model';
import styles from './rates.module.css';

export function SavedPackHotelPrices({
  pack,
  search,
  disabled,
  onChange,
}: {
  pack: PackDetail;
  search: string;
  disabled: boolean;
  onChange: (pack: PackDetail) => void;
}) {
  const visible = visiblePackHotels(pack, search);
  return (
    <div className="space-y-4" aria-label="هتل‌های بستهٔ ذخیره‌شده">
      <p>
        {visible.length.toLocaleString('fa-IR')} هتل از{' '}
        {pack.rows.length.toLocaleString('fa-IR')} هتل · جست‌وجو اطلاعات سایر
        هتل‌ها را حذف نمی‌کند.
      </p>
      {!visible.length && <p>هتلی مطابق جست‌وجو پیدا نشد.</p>}
      {visible.map((row) => {
        const exact = row.roomRates.some((room) => room.occupancyRates?.length);
        const onlyExact =
          exact && row.roomRates.every((room) => room.occupancyRates?.length);
        return (
          <article
            key={row.hotelId}
            className="space-y-3 rounded-xl border p-4"
          >
            <h3 className="font-bold">{row.hotelName}</h3>
            <p>
              کارگزار: {row.brokerName} · ارز: {row.currency}
            </p>
            {exact && (
              <p>
                قیمت واقعی ترکیبی، کل اتاق در هر شب است؛ پایه و ضرایب قدیمی روی
                آن اعمال نمی‌شوند.
              </p>
            )}
            <label className="flex items-center gap-3">
              {onlyExact
                ? 'پایهٔ سازگاری نرخ قدیمی (نه قیمت ترکیب)'
                : 'قیمت پایهٔ هر نفر / هر شب'}
              <input
                aria-label={`قیمت پایهٔ ${row.hotelName}`}
                dir="ltr"
                className="w-40 rounded border p-2"
                inputMode="decimal"
                disabled={disabled || onlyExact}
                value={row.base}
                onChange={(event) =>
                  onChange({
                    ...pack,
                    rows: pack.rows.map((item) =>
                      item.hotelId === row.hotelId
                        ? { ...item, base: event.target.value }
                        : item,
                    ),
                  })
                }
              />
            </label>
            {row.roomRates
              .filter((room) => room.occupancyRates?.length)
              .map((room) => (
                <div key={room.roomTypeId}>
                  <h4>{room.roomTypeName}</h4>
                  <OccupancyRateEditor
                    disabled={disabled}
                    rates={room.occupancyRates!}
                    onChange={(rates) =>
                      onChange({
                        ...pack,
                        rows: pack.rows.map((item) =>
                          item.hotelId !== row.hotelId
                            ? item
                            : {
                                ...item,
                                roomRates: item.roomRates.map((saved) =>
                                  saved.roomTypeId === room.roomTypeId
                                    ? { ...saved, occupancyRates: rates }
                                    : saved,
                                ),
                              },
                        ),
                      })
                    }
                  />
                </div>
              ))}
          </article>
        );
      })}
    </div>
  );
}

export function ExistingPacksBrowser({
  branchId,
  revision,
  canWrite,
  onSaved,
  onLockChange,
}: {
  branchId: string;
  revision: number;
  canWrite: boolean;
  onSaved: () => void;
  onLockChange: (locked: boolean) => void;
}) {
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [cityId, setCityId] = useState('');
  const [packId, setPackId] = useState('');
  const [detail, setDetail] = useState<PackDetail | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const saver = useRef(new PackPriceSave());
  const original = useRef<PackDetail | null>(null);
  const saveInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true);
      try {
        const result = branchId
          ? await loadPackDirectory(branchId, rateRequest)
          : [];
        if (active) {
          setPacks(result);
          setError('');
        }
      } catch (e) {
        if (active) {
          setPacks([]);
          setError(e instanceof Error ? e.message : 'بسته‌ها دریافت نشدند.');
        }
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [branchId, revision, reload]);

  useEffect(() => {
    let active = true;
    if (!packId)
      return () => {
        active = false;
      };
    void Promise.resolve().then(async () => {
      if (!active) return;
      setDetailLoading(true);
      try {
        const item = await rateRequest<PackDetail>(
          `/packs/${encodeURIComponent(packId)}`,
        );
        if (
          item.id !== packId ||
          item.branchId !== branchId ||
          item.cityId !== cityId
        )
          throw new Error('بسته با شهر یا شعبهٔ انتخاب‌شده مطابقت ندارد.');
        if (active) {
          setDetail(item);
          original.current = item;
          setError('');
        }
      } catch (e) {
        if (active) {
          setDetail(null);
          setError(e instanceof Error ? e.message : 'بسته باز نشد.');
        }
      } finally {
        if (active) setDetailLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [packId, branchId, cityId, reload]);

  function navigate(action: () => void) {
    if (dirty || saveInFlight.current) {
      setError(
        'ابتدا تغییرات را ذخیره کنید یا دکمهٔ کنارگذاشتن تغییرات را بزنید.',
      );
      return;
    }
    setDetail(null);
    original.current = null;
    setSearch('');
    setError('');
    setMessage('');
    action();
  }

  async function save() {
    if (!detail || !canWrite || !dirty || saveInFlight.current) return;
    saveInFlight.current = true;
    setBusy(true);
    onLockChange(true);
    setError('');
    setMessage('');
    try {
      const result = await saver.current.save(detail, rateRequest);
      const saved = { ...detail, version: result.version };
      setDetail(saved);
      original.current = saved;
      setDirty(false);
      onLockChange(false);
      setMessage(
        `تغییرات در نسخهٔ ${result.version.toLocaleString('fa-IR')} ثبت شد؛ نسخهٔ قبلی محفوظ است.`,
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت انجام نشد.');
    } finally {
      saveInFlight.current = false;
      setBusy(false);
    }
  }

  const opened =
    detail?.id === packId && detail.cityId === cityId ? detail : null;
  return (
    <section
      className="space-y-4 rounded-xl border p-4"
      aria-labelledby="existing-packs-title"
    >
      <div className={styles.toolbar}>
        <h2 id="existing-packs-title">بسته‌های موجود · شهر، تاریخ و هتل</h2>
        <button
          type="button"
          disabled={busy || dirty || loading}
          onClick={() => {
            setError('');
            setReload((value) => value + 1);
          }}
        >
          تازه‌سازی بسته‌ها
        </button>
      </div>
      <p>
        ابتدا شهر و سپس بازهٔ بسته را انتخاب کنید؛ هتل‌ها و قیمت‌های ثبت‌شدهٔ
        همان بسته نمایش داده می‌شوند.
      </p>
      {loading && <p role="status">در حال دریافت فهرست کامل بسته‌ها…</p>}
      {!loading && !packs.length && !error && (
        <p>در این شعبه هنوز بسته‌ای ثبت نشده است.</p>
      )}
      <SearchCombobox
        label="شهر بسته‌های موجود"
        value={cityId}
        options={packCities(packs)}
        disabled={busy || loading}
        onValueChange={(id) =>
          navigate(() => {
            setCityId(id);
            setPackId('');
          })
        }
      />
      <SearchCombobox
        label="تاریخ بسته‌های شهر"
        value={packId}
        options={packsForCity(packs, cityId)}
        disabled={busy || loading || !cityId}
        onValueChange={(id) => navigate(() => setPackId(id))}
      />
      {detailLoading && <p role="status">در حال دریافت هتل‌های بسته…</p>}
      {opened && (
        <>
          <p>
            {opened.cityName} · {opened.checkIn} تا {opened.checkOut} (روز خروج)
            · نسخهٔ {opened.version.toLocaleString('fa-IR')}
          </p>
          <label>
            جست‌وجو در هتل‌های این بسته
            <input
              className="mx-2 rounded border p-2"
              aria-label="جست‌وجوی هتل‌های بستهٔ موجود"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <SavedPackHotelPrices
            pack={opened}
            search={search}
            disabled={!canWrite || busy}
            onChange={(updated) => {
              setDetail(updated);
              setDirty(true);
              onLockChange(true);
              setMessage('');
            }}
          />
          <div className={styles.toolbar}>
            <button
              className={styles.primary}
              type="button"
              disabled={!canWrite || busy || !dirty}
              onClick={() => void save()}
            >
              {busy ? 'در حال ثبت…' : 'ثبت تغییرات قیمت · نسخهٔ جدید'}
            </button>
            <button
              type="button"
              disabled={busy || !dirty}
              onClick={() => {
                setDetail(original.current);
                setDirty(false);
                onLockChange(false);
                setError('');
                setMessage('تغییرات ذخیره‌نشده کنار گذاشته شد.');
              }}
            >
              کنارگذاشتن تغییرات ذخیره‌نشده
            </button>
          </div>
        </>
      )}
      {!canWrite && <p>فقط مشاهده؛ مجوز ویرایش نرخ ندارید.</p>}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
