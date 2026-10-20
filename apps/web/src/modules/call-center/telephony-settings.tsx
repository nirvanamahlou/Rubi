'use client';
import { useEffect, useState } from 'react';
import { localizedFetch } from '@/i18n/localized-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { workflowApi, type Operator } from './workflow-client';
import { readApi } from './read-client';
import styles from './telephony.module.css';
interface Connection {
  id: string;
  name: string;
  branchId: string;
  synthetic: boolean;
  version: number;
  mappings: {
    extension: string;
    userId: string;
    teamId: string | null;
    version: number;
    active: boolean;
  }[];
}
interface Settings {
  state: string;
  syntheticEnabled: boolean;
  canManage: boolean;
  connections: Connection[];
}
async function request<T>(path: string, body?: unknown): Promise<T> {
  const r = await localizedFetch(
    `${getPublicApiBaseUrl()}/integrations/telephony${path}`,
    {
      credentials: 'include',
      cache: 'no-store',
      ...(body
        ? {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }
        : {}),
    },
  );
  if (!r.ok) throw new Error('عملیات تلفنی مجاز نیست یا انجام نشد.');
  return r.json() as Promise<T>;
}
export function TelephonySettings({ branchId }: { branchId: string }) {
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]),
    [team, setTeam] = useState(''),
    [review, setReview] = useState<
      { id: string; version: number; call: { contact: { branchId: string } } }[]
    >([]);
  const [audit, setAudit] = useState<
    { id: string; action: string; createdAt: string }[]
  >([]);
  const [settings, setSettings] = useState<Settings | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [root, setRoot] = useState<string | null>(null),
    [connection, setConnection] = useState(''),
    [operators, setOperators] = useState<Operator[]>([]),
    [operator, setOperator] = useState(''),
    [extension, setExtension] = useState(''),
    [message, setMessage] = useState(''),
    [dead, setDead] = useState<{ id: string; errorCode: string }[]>([]);
  async function refresh() {
    try {
      setSettings(await request<Settings>(''));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    let live = true;
    request<Settings>('')
      .then((r) => {
        if (live) setSettings(r);
      })
      .catch(() => {
        if (live) setError('تنظیمات تلفنی دریافت نشد.');
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    readApi
      .teams(branchId)
      .then((r) => {
        if (live) setTeams(r.units);
      })
      .catch(() => {
        if (live) setTeams([]);
      });
    workflowApi
      .operators(branchId)
      .then((r) => {
        if (live) setOperators(r.data);
      })
      .catch(() => {
        if (live) setOperators([]);
      });
    return () => {
      live = false;
    };
  }, [branchId]);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      setMessage('عملیات ثبت شد.');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function emit(kind: string, fresh = false) {
    await run(async () => {
      const result = await request<{ rootId: string }>('/synthetic', {
        branchId,
        kind,
        ...(!fresh && root ? { rootId: root } : {}),
        externalEventId: crypto.randomUUID(),
      });
      setRoot(result.rootId);
    });
  }
  const selected = settings?.connections.find((c) => c.id === connection);
  return (
    <details className={styles.settings}>
      <summary>زیرساخت تلفنی و آزمایش داخلی — ایزابل متصل نشده</summary>
      <p>
        قرارداد داخلی آماده توسعه اتصال است. دریافت واقعی تماس، صوت و تأخیر
        ایزابل هنوز تأیید نشده‌اند.
      </p>
      {error && (
        <p role="alert">
          {error} <button onClick={() => void refresh()}>تلاش مجدد</button>
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {settings?.syntheticEnabled && (
        <fieldset disabled={busy}>
          <legend>ابزار توسعه؛ فقط تماس مصنوعی برای حساب خودتان</legend>
          <p>
            شماره رزروشده آزمایشی استفاده می‌شود. این ابزار پنل تماس عملیاتی
            نیست؛ رخداد از Inbox، Worker و پایگاه داده عبور می‌کند.
          </p>
          <div className={styles.actions}>
            <button onClick={() => void emit('RINGING', true)}>
              تماس مصنوعی تازه
            </button>
            <button disabled={!root} onClick={() => void emit('ANSWERED')}>
              پاسخ
            </button>
            <button disabled={!root} onClick={() => void emit('ENDED')}>
              پایان
            </button>
            <button
              disabled={!root}
              onClick={() => void emit('RECORDING_READY')}
            >
              مرجع صوت مصنوعی
            </button>
          </div>
        </fieldset>
      )}
      {settings?.canManage && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void run(() =>
                request('/connections', {
                  branchId,
                  name: String(form.get('name')),
                  maxAgeSeconds: Number(form.get('age')),
                  maxFutureSeconds: Number(form.get('future')),
                }),
              );
            }}
          >
            <label>
              نام اتصال
              <input name="name" required maxLength={100} />
            </label>
            <label>
              حداکثر قدمت رخداد (ثانیه)
              <input
                name="age"
                type="number"
                min={60}
                max={604800}
                defaultValue={86400}
              />
            </label>
            <label>
              حداکثر جلو بودن ساعت (ثانیه)
              <input
                name="future"
                type="number"
                min={0}
                max={600}
                defaultValue={120}
              />
            </label>
            <button disabled={busy}>ثبت اتصال غیرفعال</button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const prior = selected?.mappings.find(
                (m) => m.extension === extension,
              );
              void run(() =>
                request('/mappings', {
                  connectionId: connection,
                  extension,
                  userId: operator,
                  ...(team ? { teamId: team } : {}),
                  active: true,
                  version: prior?.version ?? 0,
                }),
              );
            }}
          >
            <label>
              اتصال همین شعبه
              <NativeSearchSelect
                value={connection}
                onChange={(e) => setConnection(e.target.value)}
                aria-label="اتصال تلفنی"
              >
                <option value="">انتخاب اتصال</option>
                {settings.connections
                  .filter((c) => !c.synthetic && c.branchId === branchId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </NativeSearchSelect>
            </label>
            <label>
              تیم مجاز (اختیاری)
              <NativeSearchSelect
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                aria-label="تیم نگاشت"
              >
                <option value="">بدون محدودیت تیم</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </NativeSearchSelect>
            </label>
            <label>
              داخلی
              <input
                value={extension}
                maxLength={32}
                pattern="[A-Za-z0-9_-]+"
                required
                onChange={(e) => setExtension(e.target.value)}
              />
            </label>
            <label>
              کارشناس مجاز
              <NativeSearchSelect
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                aria-label="کارشناس نگاشت"
              >
                <option value="">انتخاب کارشناس</option>
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.displayName}
                  </option>
                ))}
              </NativeSearchSelect>
            </label>
            <button disabled={busy || !operator || !connection}>
              ثبت نگاشت داخلی
            </button>
          </form>
          {selected?.mappings.map((m) => (
            <p key={m.extension}>
              داخلی {m.extension} ·{' '}
              {operators.find((o) => o.id === m.userId)?.displayName ??
                'کاربر خارج از فهرست فعال'}{' '}
              · نسخه {m.version} · {m.active ? 'فعال' : 'غیرفعال'}{' '}
              <button
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    request('/mappings', {
                      connectionId: selected.id,
                      extension: m.extension,
                      userId: m.userId,
                      active: !m.active,
                      version: m.version,
                    }),
                  )
                }
              >
                {m.active ? 'غیرفعال کردن' : 'فعال کردن'}
              </button>
            </p>
          ))}
          <button
            onClick={() =>
              void run(async () => {
                const result = await request<{
                  dead: { id: string; errorCode: string }[];
                  audit: { id: string; action: string; createdAt: string }[];
                  unassigned: {
                    id: string;
                    version: number;
                    call: { contact: { branchId: string } };
                  }[];
                }>('/operations');
                setDead(result.dead);
                setAudit(result.audit);
                setReview(result.unassigned);
              })
            }
          >
            بررسی صف خطا
          </button>
          <p>
            تماس‌های بدون مقصد معتبر؛ کارشناس مقصد را از فهرست بالا انتخاب کنید.
          </p>
          {review
            .filter((r) => r.call.contact.branchId === branchId)
            .map((r) => (
              <p key={r.id}>
                <code>{r.id}</code>
                <button
                  disabled={!operator || busy}
                  onClick={() =>
                    void run(() =>
                      request(`/review/${r.id}`, {
                        userId: operator,
                        version: r.version,
                      }),
                    )
                  }
                >
                  ارجاع برای بررسی
                </button>
              </p>
            ))}
          {audit.length > 0 && (
            <details>
              <summary>تاریخچه تنظیمات و پردازش تلفنی</summary>
              {audit.map((a) => (
                <p key={a.id}>
                  <bdi>{a.action}</bdi> ·{' '}
                  {new Date(a.createdAt).toLocaleString('fa-IR', {
                    timeZone: 'Asia/Tehran',
                  })}
                </p>
              ))}
            </details>
          )}
          {dead.map((d) => (
            <p key={d.id}>
              <code>{d.id}</code> · {d.errorCode}{' '}
              <button
                disabled={busy}
                onClick={() => void run(() => request(`/replay/${d.id}`, {}))}
              >
                اجرای مجدد با ثبت تاریخچه
              </button>
            </p>
          ))}
        </>
      )}
    </details>
  );
}
