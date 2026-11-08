'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from '@/components/ui/overlays';

type Summary = {
  selected?: boolean;
  canPrepare?: boolean;
  sandbox: boolean;
  total: number;
  ready: boolean;
  policies: {
    id: string | null;
    customerId: string;
    passengerName: string;
    ready: boolean;
    policyNumber: string | null;
    status: string;
    error: string | null;
    sandbox: boolean;
  }[];
};
export async function insuranceResponse(path: string, method = 'GET') {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
  const send = () =>
    fetch(base + '/' + path, {
      method,
      credentials: 'include',
      cache: 'no-store',
    });
  let response = await send();
  if (response.status === 401 && (await refreshAuthenticatedSession(base)))
    response = await send();
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.message === 'string'
        ? body.message
        : 'دریافت بیمه‌نامه ناموفق بود.',
    );
  }
  return response;
}
export async function downloadInsurancePolicies(
  path: string,
  policies: readonly { id: string }[],
  save: (blob: Blob, filename: string) => void,
) {
  // Fetch each protected PDF independently; an error never turns into a fake merged document.
  for (const policy of policies) {
    const response = await insuranceResponse(
      path + '/pdf/' + encodeURIComponent(policy.id),
    );
    if (!response.headers.get('content-type')?.includes('application/pdf'))
      throw new Error('دریافت بیمه‌نامه ناموفق بود.');
    save(await response.blob(), `sandbox-insurance-${policy.id}.pdf`);
  }
}
export function ReservationInsuranceDocuments({
  id,
  sales = false,
}: {
  id: string;
  sales?: boolean;
}) {
  const [data, setData] = useState<Summary>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const path = sales
    ? `sales/contracts/${encodeURIComponent(id)}/insurance`
    : `reservations/requests/${encodeURIComponent(id)}/insurance`;
  useEffect(() => {
    let live = true;
    const load = () =>
      void insuranceResponse(path)
        .then((r) => r.json())
        .then((value: Summary) => {
          if (live) {
            setData(value);
            setError('');
          }
        })
        .catch((e: unknown) => {
          if (live)
            setError(
              e instanceof Error ? e.message : 'دریافت بیمه‌نامه ناموفق بود.',
            );
        });
    load();
    const timer = setInterval(load, 10000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [path]);
  async function download(policyId?: string) {
    setBusy(true);
    setError('');
    try {
      const selected =
        data?.policies.filter(
          (p): p is typeof p & { id: string } =>
            p.ready && p.id !== null && (!policyId || p.id === policyId),
        ) ?? [];
      await downloadInsurancePolicies(path, selected, (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'دریافت بیمه‌نامه ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }
  async function prepare() {
    setBusy(true);
    setError('');
    try {
      const response = await insuranceResponse(path + '/prepare', 'POST');
      setData(await response.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'دریافت بیمه‌نامه ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="grid gap-3" dir="rtl">
      <p>حالت آزمایشی تراویس؛ نتیجهٔ آزمایش، بیمه‌نامهٔ واقعی مسافر نیست.</p>
      {error && <p role="alert">{error}</p>}
      {!data ? (
        <p role="status">در حال دریافت اطلاعات…</p>
      ) : !data.total ? (
        <p>
          {data.selected
            ? 'بیمه در قرارداد ثبت شده است؛ در ویرایش اسامی مسافران، بیمه را به مسافر تخصیص دهید.'
            : 'بیمه برای این قرارداد انتخاب نشده است.'}
        </p>
      ) : (
        <>
          {data.canPrepare && data.policies.some((p) => !p.id) && (
            <Button disabled={busy} onClick={() => void prepare()}>
              آماده‌سازی بیمه‌نامه‌های انتخاب‌شده
            </Button>
          )}
          <p>
            {data.policies.filter((p) => p.status === 'ISSUED').length} /{' '}
            {data.total}
          </p>
          {data.policies.map((p, index) => (
            <div key={p.customerId} className="rounded border p-3">
              <strong>{p.passengerName || <>مسافر {index + 1}</>}</strong> ·{' '}
              <bdi>{p.policyNumber ?? 'در انتظار صدور'}</bdi>
              {p.error && <p role="status">{p.error}</p>}
              <Button
                variant="outline"
                disabled={!p.ready || busy}
                onClick={() => p.id && void download(p.id)}
              >
                دانلود PDF بیمه‌نامه
              </Button>
            </div>
          ))}
          <Button
            disabled={!data.policies.some((p) => p.ready) || busy}
            onClick={() => void download()}
          >
            {busy ? 'در حال دریافت…' : 'دانلود همهٔ بیمه‌نامه‌ها'}
          </Button>
        </>
      )}
    </section>
  );
}
export function SalesInsuranceDocuments({
  contractId,
}: {
  contractId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          بیمه‌نامه
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogTitle>بیمه‌نامه‌های مسافران</DialogTitle>
        {open && <ReservationInsuranceDocuments id={contractId} sales />}
      </DialogContent>
    </Dialog>
  );
}
