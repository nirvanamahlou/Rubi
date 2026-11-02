'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Card } from '@/components/ui/surfaces';
import { ghestirooApi, type GhestirooStatus } from '../api/client';

const labels: Record<string, string> = {
  catalog: 'کاتالوگ',
  customers: 'مشتریان سایت',
  requests: 'درخواست‌های سفر و پشتیبانی',
  cases: 'وضعیت پرونده‌ها',
  admin: 'ورود به پنل مدیریت',
};
const fields: Record<string, string> = {
  id: 'شناسه',
  title: 'عنوان',
  name: 'نام',
  phone: 'موبایل',
  kind: 'نوع',
  status: 'وضعیت',
  version: 'نسخه',
  price: 'مبلغ',
  currency: 'واحد پول',
  service: 'خدمت',
  destination: 'مقصد',
  code: 'شماره پرونده',
  state: 'وضعیت پرونده',
  booking_state: 'وضعیت رزرو',
};

function displayValue(field: string, value: unknown) {
  if (value === null || value === undefined) return '—';
  if (field === 'price' && /^\d+$/.test(String(value)))
    return new Intl.NumberFormat('fa-IR').format(BigInt(String(value)));
  if (field === 'currency')
    return (
      (
        {
          IRT: 'تومان (IRT)',
          IRR: 'ریال (IRR)',
          USD: 'دلار آمریکا (USD)',
          EUR: 'یورو (EUR)',
          TRY: 'لیر ترکیه (TRY)',
        } as Record<string, string>
      )[String(value)] ?? String(value)
    );
  if (['kind', 'status', 'state', 'booking_state', 'service'].includes(field))
    return (
      (
        {
          hotels: 'هتل‌ها',
          tours: 'تورها',
          tickets: 'بلیت‌ها',
          travel: 'سفر',
          support: 'پشتیبانی',
          tour: 'تور',
          hotel: 'هتل',
          flight: 'پرواز',
          bus: 'اتوبوس',
          train: 'قطار',
          draft: 'پیش‌نویس',
          published: 'منتشرشده',
          archived: 'بایگانی',
          new: 'جدید',
          active: 'فعال',
          settled: 'تسویه‌شده',
          cancelled: 'لغوشده',
          pending: 'در انتظار',
          issued: 'صادرشده',
        } as Record<string, string>
      )[String(value)] ?? String(value)
    );
  return String(value);
}

export function GhestirooConnection({
  branchId,
  userId,
}: {
  branchId: string;
  userId: string;
}) {
  const [status, setStatus] = useState<GhestirooStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [bundle, setBundle] = useState('');
  const [users, setUsers] = useState(userId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState('');
  const [resource, setResource] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const loadStatus = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const value = await ghestirooApi.status(branchId, signal);
        if (!signal?.aborted) {
          setStatus(value);
          setUsers(value.allowedUserIds?.join('\n') ?? userId);
        }
      } catch (cause) {
        if (!signal?.aborted)
          setError(
            cause instanceof Error ? cause.message : 'خواندن اتصال انجام نشد.',
          );
      } finally {
        if (!signal?.aborted) setLoadingStatus(false);
      }
    },
    [branchId, userId],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => void loadStatus(controller.signal),
      0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadStatus]);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'عملیات انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  async function read(name: string, after = '') {
    const result = await ghestirooApi.resources(branchId, name, after);
    setResource(name);
    setRows(result.items);
    setCursor(result.nextCursor);
  }
  return (
    <Card className="grid gap-4 p-5">
      <h2 className="text-lg font-bold">اتصال قسطی‌رو به نورا</h2>
      <p className="text-sm text-muted-foreground">
        در پنل قسطی‌رو، از «تنظیمات و دسترسی‌ها ← اتصال به نورا» بسته اتصال
        بسازید و اینجا وارد کنید. اطلاعات سایت در همین بخش نمایش داده می‌شوند.
        مدیریت سایت با نقش کارمند انتخاب‌شده انجام می‌شود.
      </p>
      {error ? (
        <Alert title="عملیات انجام نشد" description={error} tone="error" />
      ) : null}
      {!status ? (
        loadingStatus ? (
          <p role="status">در حال خواندن تنظیمات اتصال…</p>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setError('');
              setLoadingStatus(true);
              void loadStatus();
            }}
          >
            تلاش دوباره برای خواندن اتصال
          </Button>
        )
      ) : (
        <>
          {!status.storageReady ? (
            <Alert
              title="نگهداری امن آماده نیست"
              description="مسیر نگهداری اتصال و کلید رمزنگاری باید هنگام راه‌اندازی سرور تنظیم شوند."
            />
          ) : null}
          {status.configured ? (
            <p className="text-sm">
              اتصال ذخیره شده: <bdi>{status.origin}</bdi> · انقضا:{' '}
              {status.expiresAt
                ? new Date(status.expiresAt).toLocaleDateString('fa-IR')
                : '—'}
            </p>
          ) : (
            <p>هنوز اتصالی ثبت نشده است.</p>
          )}
          <GhestirooSetupForm
            status={status}
            busy={busy}
            bundle={bundle}
            users={users}
            userId={userId}
            onBundleChange={setBundle}
            onUsersChange={setUsers}
            onSubmit={() =>
              void perform(async () => {
                const value = await ghestirooApi.save(
                  branchId,
                  bundle,
                  users.split(/[\s,]+/).filter(Boolean),
                  status.version,
                );
                setStatus(value);
                setBundle('');
                setVerified('');
                setRows([]);
                setCursor(null);
                setResource('');
              })
            }
          />
          {status.configured ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    setVerified('');
                    const result = await ghestirooApi.test(branchId);
                    setVerified(
                      `ارتباط تأیید شد: ${result.scopes.map((s) => labels[s] ?? s).join('، ')}`,
                    );
                  })
                }
              >
                آزمون اتصال
              </Button>
              {status.scopes
                ?.filter((s) => s !== 'admin')
                .map((name) => (
                  <Button
                    key={name}
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void perform(() => read(name))}
                  >
                    {labels[name] ?? name}
                  </Button>
                ))}
              {status.canManage && status.scopes?.includes('admin') ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      const result = await ghestirooApi.grant(branchId);
                      // The key never enters browser storage or a URL. Only a one-use grant is posted.
                      const action = new URL(result.action);
                      if (
                        action.origin !== status.origin ||
                        action.pathname !== '/admin/nora-sso'
                      )
                        throw Error('نشانی ورود معتبر نیست.');
                      const form = document.createElement('form');
                      form.method = 'POST';
                      form.action = '/integrations/ghestiroo-launch';
                      const input = document.createElement('input');
                      input.type = 'hidden';
                      input.name = 'token';
                      input.value = result.token;
                      form.append(input);
                      const target = document.createElement('input');
                      target.type = 'hidden';
                      target.name = 'action';
                      target.value = result.action;
                      form.append(target);
                      document.body.append(form);
                      form.submit();
                      form.remove();
                    })
                  }
                >
                  ورود امن به پنل قسطی‌رو
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
      {verified ? (
        <p role="status" className="text-sm">
          {verified}
        </p>
      ) : null}
      {resource ? (
        <div className="grid gap-3">
          <h3 className="font-bold">{labels[resource]}</h3>
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {Object.keys(rows[0]!).map((field) => (
                      <th className="p-2 text-start" key={field}>
                        {fields[field] ?? field}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      className="border-t border-border"
                      key={String(row.id ?? i)}
                    >
                      {Object.keys(rows[0]!).map((field) => (
                        <td className="p-2" key={field}>
                          {displayValue(field, row[field])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>رکوردی وجود ندارد.</p>
          )}
          {cursor ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void perform(() => read(resource, cursor))}
            >
              صفحه بعد
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export function GhestirooSetupForm({
  status,
  busy,
  bundle,
  users,
  userId,
  onBundleChange,
  onUsersChange,
  onSubmit,
}: {
  status: GhestirooStatus;
  busy: boolean;
  bundle: string;
  users: string;
  userId: string;
  onBundleChange: (value: string) => void;
  onUsersChange: (value: string) => void;
  onSubmit: () => void;
}) {
  if (!status.canManage)
    return (
      <Alert
        title="دسترسی تنظیم اتصال ندارید"
        description="این حساب فقط امکان مشاهده اتصال را دارد. برای ثبت بسته، حساب باید مجوز مدیریت تنظیمات یکپارچه‌سازی در همین شعبه را داشته باشد."
      />
    );
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && status.storageReady) onSubmit();
      }}
    >
      <label className="grid gap-2">
        بسته اتصال تولیدشده در قسطی‌رو
        <textarea
          aria-label="بسته اتصال قسطی‌رو"
          className="rounded-xl border border-border bg-surface p-3"
          rows={7}
          dir="ltr"
          value={bundle}
          onChange={(event) => onBundleChange(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          required
          maxLength={8000}
          disabled={busy}
        />
      </label>
      <label className="grid gap-2">
        شناسه کاربران مجاز نورا (هر شناسه در یک خط)
        <textarea
          className="rounded-xl border border-border bg-surface p-3"
          rows={2}
          dir="ltr"
          value={users}
          onChange={(event) => onUsersChange(event.target.value)}
          required
          disabled={busy}
        />
      </label>
      <p className="text-sm text-muted-foreground">
        شناسه حساب شما: <bdi>{userId}</bdi>. کاربران باید مجوز مشاهده اتصال و
        دسترسی همین شعبه را نیز داشته باشند.
      </p>
      {!status.storageReady ? (
        <p className="text-sm text-muted-foreground">
          می‌توانید بسته را اینجا وارد کنید؛ ذخیره پس از آماده‌شدن نگهداری امن
          سرور فعال می‌شود. پیش از ذخیره، اطلاعات فقط در همین صفحه باقی
          می‌مانند.
        </p>
      ) : null}
      <Button type="submit" disabled={busy || !status.storageReady}>
        ذخیره امن اتصال
      </Button>
    </form>
  );
}
