'use client';
import { useEffect, useRef, useState } from 'react';
import {
  floatingTourPeriodKey,
  type FloatingTourSaleSet,
  type FloatingTourSaleRow,
  type FloatingTourPeriodChangeV1,
  type LoginResponse,
} from '@nora/contracts';
import { Button, Card, Input } from '@/components/ui';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { packagePricingApi } from '../api/client';

const groups = [
  ['double', 'دو تخته'],
  ['single', 'یک تخته'],
  ['extra', 'تخت اضافه'],
  ['childBed', 'کودک با تخت'],
  ['childNoBed', 'کودک بدون تخت'],
  ['infant', 'نوزاد'],
] as const;

export function floatingRegisteredPeriods(catalog: FloatingTourSaleSet) {
  const periods = new Map<
    string,
    {
      key: string;
      monthly: boolean;
      rows: { row: FloatingTourSaleRow; index: number }[];
    }
  >();
  for (const monthly of [false, true]) {
    const rows = monthly ? (catalog.monthly?.rows ?? []) : catalog.dated;
    rows.forEach((row, index) => {
      const key = floatingTourPeriodKey(row, monthly ? catalog.monthly : null);
      const period = periods.get(key) ?? { key, monthly, rows: [] };
      period.rows.push({ row, index });
      periods.set(key, period);
    });
  }
  return [...periods.values()];
}

function PeriodCard({
  period,
  catalog,
  tourId,
  session,
  canManage,
  busy,
  onChange,
}: {
  period: ReturnType<typeof floatingRegisteredPeriods>[number];
  catalog: FloatingTourSaleSet;
  tourId: string;
  session: LoginResponse;
  canManage: boolean;
  busy: boolean;
  onChange: (catalog: FloatingTourSaleSet) => void;
}) {
  const [drafts, setDrafts] = useState(() =>
    period.rows.map(({ index, row }) => ({
      index,
      prices: structuredClone(row.prices),
    })),
  );
  const [mode, setMode] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>(
    'INCREASE',
  );
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'IRR' | 'USD' | 'EUR' | 'TRY'>(
    'IRR',
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editVersion, setEditVersion] = useState(catalog.version);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const visibleDrafts = dirty
    ? drafts
    : period.rows.map(({ index, row }) => ({ index, prices: row.prices }));
  const stopped = period.rows.every(({ row }) => row.salesStopped);
  const first = period.rows[0]!.row;
  async function save(
    change: Omit<FloatingTourPeriodChangeV1, 'expectedVersion' | 'periodKey'>,
  ) {
    if (!canManage || busy || pending) return;
    setPending(true);
    setError('');
    try {
      const updated = await packagePricingApi.floatingPeriodChange(
        tourId,
        {
          ...change,
          periodKey: period.key,
          expectedVersion:
            change.action === 'EDIT' ? editVersion : catalog.version,
        },
        session,
      );
      if (active.current) {
        setDirty(false);
        onChange(updated);
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'ذخیره تغییرات ناموفق بود.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Card className="space-y-4 overflow-hidden p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <h3 className="font-bold">
            {period.monthly ? (
              'ویژه ماه'
            ) : (
              <>
                <bdi>{first.startsOn}</bdi> ← <bdi>{first.endsOn}</bdi>
              </>
            )}{' '}
            · {first.nights} شب
          </h3>
          {period.monthly && (
            <p className="text-sm text-muted-foreground">
              {catalog.monthly?.calendar === 'PERSIAN' ? 'شمسی' : 'میلادی'} ·{' '}
              {catalog.monthly?.months.join('، ')}
            </p>
          )}
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs ${stopped ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}
          >
            {stopped ? 'فروش بازه متوقف است' : 'فروش بازه فعال است'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!canManage || busy || pending || dirty}
            onClick={() => void save({ action: stopped ? 'RESUME' : 'STOP' })}
          >
            {stopped ? 'ادامه فروش بازه' : 'توقف فروش بازه'}
          </Button>
          <Button
            disabled={!canManage || busy || pending || dirty}
            onClick={() => setConfirmDelete(true)}
          >
            حذف بازه
          </Button>
        </div>
      </div>
      {confirmDelete && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-900">
          <p>قیمت‌های این بازه حذف می‌شوند؛ بازه‌های دیگر حفظ می‌شوند.</p>
          <Button
            disabled={pending || busy || !canManage}
            onClick={() => void save({ action: 'DELETE' })}
          >
            تأیید حذف بازه
          </Button>
          <Button disabled={pending} onClick={() => setConfirmDelete(false)}>
            انصراف
          </Button>
        </div>
      )}
      <fieldset
        disabled={!canManage || pending || busy}
        className="grid gap-3 rounded-xl border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <legend className="px-2 text-sm font-semibold">
          تغییر گروهی قیمت‌های همین بازه
        </legend>
        <label className="space-y-1 text-sm">
          نوع تغییر
          <NativeSearchSelect
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <option value="PERCENT">درصدی</option>
            <option value="FIXED">مبلغ ثابت</option>
          </NativeSearchSelect>
        </label>
        <label className="space-y-1 text-sm">
          جهت تغییر
          <NativeSearchSelect
            value={direction}
            onChange={(e) => setDirection(e.target.value as typeof direction)}
          >
            <option value="INCREASE">افزایش</option>
            <option value="DECREASE">کاهش</option>
          </NativeSearchSelect>
        </label>
        <label className="space-y-1 text-sm">
          مقدار تغییر
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replaceAll(',', ''))}
          />
        </label>
        {mode === 'FIXED' ? (
          <label className="space-y-1 text-sm">
            ارز
            <NativeSearchSelect
              value={currency}
              onChange={(e) => setCurrency(e.target.value as typeof currency)}
            >
              {['IRR', 'USD', 'EUR', 'TRY'].map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </NativeSearchSelect>
          </label>
        ) : (
          <p className="self-end text-xs text-muted-foreground">
            درصد روی هر ارز جداگانه اعمال می‌شود.
          </p>
        )}
        <Button
          className="self-end"
          disabled={!amount || dirty}
          onClick={() =>
            void save({
              action: 'ADJUST',
              adjustment: {
                mode,
                direction,
                amount,
                ...(mode === 'FIXED' ? { currency } : {}),
              },
            })
          }
        >
          اعمال تغییر گروهی
        </Button>
      </fieldset>
      <p className="text-xs text-muted-foreground">
        مبالغ با ارز کنار هر فیلد ثبت می‌شوند؛ IRR ریال است. ویرایش دستی را پیش
        از عملیات دیگر ذخیره کنید.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr>
              <th className="p-3 text-start">هتل و اتاق</th>
              {groups.map(([key, name]) => (
                <th key={key} className="p-3">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {period.rows.map(({ row, index }, position) => (
              <tr key={index} className="border-t">
                <td className="p-3">
                  {row.stays.map((stay, i) => (
                    <p key={i}>
                      {stay.hotelName} · {stay.room} · {stay.service}
                    </p>
                  ))}
                </td>
                {groups.map(([group, label]) => (
                  <td key={group} className="p-2">
                    {visibleDrafts[position]!.prices[group]?.map(
                      (money, moneyIndex) => (
                        <label
                          key={money.currency}
                          className="mb-2 block text-xs"
                        >
                          <bdi>{money.currency}</bdi>
                          <Input
                            dir="ltr"
                            inputMode="decimal"
                            aria-label={`${label} · ${row.stays.map((stay) => stay.hotelName).join(' / ')} · ${money.currency}`}
                            value={money.amount}
                            disabled={!canManage || pending || busy}
                            onChange={(e) => {
                              const value = e.target.value.replaceAll(',', '');
                              if (!dirty) setEditVersion(catalog.version);
                              setDrafts((current) =>
                                (dirty
                                  ? current
                                  : structuredClone(visibleDrafts)
                                ).map((draft, p) =>
                                  p !== position
                                    ? draft
                                    : {
                                        ...draft,
                                        prices: {
                                          ...draft.prices,
                                          [group]: draft.prices[group]!.map(
                                            (price, m) =>
                                              m === moneyIndex
                                                ? { ...price, amount: value }
                                                : price,
                                          ),
                                        },
                                      },
                                ),
                              );
                              setDirty(true);
                            }}
                          />
                        </label>
                      ),
                    ) ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        disabled={!canManage || !dirty || pending || busy}
        onClick={() => void save({ action: 'EDIT', rows: drafts })}
      >
        ذخیره قیمت‌های دستی بازه
      </Button>
      {dirty && (
        <Button
          disabled={pending || busy}
          onClick={() => {
            setDirty(false);
            setError('');
          }}
        >
          انصراف از ویرایش
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </Card>
  );
}

export function FloatingRegisteredPeriods(props: {
  catalog: FloatingTourSaleSet;
  tourId: string;
  session: LoginResponse;
  canManage: boolean;
  busy: boolean;
  periodFilter: string;
  onChange: (catalog: FloatingTourSaleSet) => void;
}) {
  const periods = floatingRegisteredPeriods(props.catalog).filter(
    (period) =>
      period.monthly ||
      !props.periodFilter ||
      `${period.rows[0]!.row.startsOn}/${period.rows[0]!.row.nights}` ===
        props.periodFilter,
  );
  return (
    <div className="space-y-4">
      {!periods.length && (
        <p className="text-sm text-muted-foreground">بازه قیمت ثبت نشده است.</p>
      )}
      {periods.map((period) => (
        <PeriodCard
          {...props}
          key={`${props.tourId}:${period.key}`}
          period={period}
        />
      ))}
    </div>
  );
}
