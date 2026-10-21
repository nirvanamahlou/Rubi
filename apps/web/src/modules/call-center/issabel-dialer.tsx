'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { PhoneOutgoing } from 'lucide-react';
import { localizedFetch } from '@/i18n/localized-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';
import styles from './issabel-dialer.module.css';

interface Status {
  connectionId: string | null;
  branchId: string | null;
  outboundAvailable: boolean;
}
interface Command {
  id: string;
  state: string;
}
const labels: Record<string, string> = {
  QUEUED: 'در صف تماس از داخلی',
  DISPATCHING: 'در حال ارسال فرمان تماس',
  ACCEPTED: 'فرمان پذیرفته شد؛ منتظر نتیجه مرکز تلفن',
  SUCCEEDED: 'داخلی پاسخ داد؛ وضعیت مخاطب در سوابق تماس ثبت می‌شود',
  FAILED: 'مرکز تلفن فرمان تماس را نپذیرفت',
  UNKNOWN: 'نتیجه نامشخص است؛ پیش از تماس مجدد بررسی کنید',
  EXPIRED: 'فرمان منقضی شد یا دسترسی تغییر کرد',
};
export function normalizeDialNumber(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\s()-]/g, '');
}
async function api<T>(
  path: string,
  signal?: AbortSignal,
  body?: unknown,
): Promise<T> {
  const response = await localizedFetch(
    `${getPublicApiBaseUrl()}/integrations/telephony/issabel${path}`,
    {
      credentials: 'include',
      cache: 'no-store',
      ...(signal ? { signal } : {}),
      ...(body
        ? {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }
        : {}),
    },
  );
  if (!response.ok) throw Error('ارتباط یا مجوز تماس خروجی بررسی شود.');
  return response.json() as Promise<T>;
}
export function IssabelDialer({
  branchId,
  allowed,
}: {
  branchId: string;
  allowed: boolean;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [number, setNumber] = useState('');
  const [id, setId] = useState<string | null>(null);
  const [command, setCommand] = useState<Command | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    api<Status>('/status', controller.signal)
      .then(setStatus)
      .catch(() => setStatus(null));
    return () => controller.abort();
  }, [allowed, branchId]);
  useEffect(() => {
    if (
      !command ||
      !['QUEUED', 'DISPATCHING', 'ACCEPTED'].includes(command.state)
    )
      return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<Command>(`/commands/${command.id}`, controller.signal)
        .then(setCommand)
        .catch(() => {
          if (!controller.signal.aborted)
            setError('ارتباط یا مجوز تماس خروجی بررسی شود.');
        });
    }, 3000);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [command]);
  if (!allowed || !status?.connectionId || status.branchId !== branchId)
    return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !status?.outboundAvailable) return;
    const normalized = normalizeDialNumber(number);
    if (!/^\+?\d{7,15}$/.test(normalized)) {
      setError('شماره تماس معتبر وارد کنید.');
      return;
    }
    const commandId = id ?? crypto.randomUUID();
    setId(commandId);
    setBusy(true);
    setError('');
    try {
      setCommand(
        await api<Command>('/commands', undefined, {
          id: commandId,
          connectionId: status.connectionId,
          number: normalized,
        }),
      );
    } catch {
      setError('نتیجه نامشخص است؛ پیش از تماس مجدد بررسی کنید');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className={styles.dialer}>
      <label>
        تماس خروجی از داخلی
        <input
          aria-label="شماره تماس خروجی"
          type="tel"
          dir="ltr"
          maxLength={30}
          value={number}
          disabled={busy || !!id}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="09120000001"
        />
      </label>
      <button
        type="submit"
        disabled={busy || !status.outboundAvailable || !!command}
      >
        <PhoneOutgoing size={16} />{' '}
        {id ? 'بررسی درخواست تماس' : 'تماس از داخلی من'}
      </button>
      {command && (
        <p role="status">{labels[command.state] ?? labels.UNKNOWN}</p>
      )}
      {error && <p role="alert">{error}</p>}
      {id &&
        !busy &&
        (error ||
          (command &&
            !['QUEUED', 'DISPATCHING', 'ACCEPTED'].includes(
              command.state,
            ))) && (
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'پیش از تماس جدید، وضعیت تماس قبلی در مرکز تلفن بررسی شده است؟',
                )
              ) {
                setId(null);
                setCommand(null);
                setError('');
              }
            }}
          >
            تماس جدید
          </button>
        )}
    </form>
  );
}
