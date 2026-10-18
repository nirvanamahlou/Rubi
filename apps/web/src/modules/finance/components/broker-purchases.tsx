'use client';
import { useEffect, useState } from 'react';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { localizedFetch } from '@/i18n/localized-fetch';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { formatSalesMoney } from '@/components/ui/money-input';
import { Button } from '@/components/ui/button';

type Result = {
  data: {
    id: string;
    contractNumber: string;
    serviceTitle: string;
    amount: string;
    currencyCode: string;
    createdAt: string;
  }[];
  hasMore: boolean;
};
export function BrokerPurchases({ id }: { id: string }) {
  const allowed = useAccessPermissions()?.includes('finance.read') === true;
  const [page, setPage] = useState(1);
  const [state, setState] = useState<{
    key: string;
    value?: Result;
    error?: string;
  }>({ key: '' });
  const key = `${id}:${page}`;
  useEffect(() => {
    if (!allowed) return;
    const abort = new AbortController();
    const base = getPublicApiBaseUrl();
    void (async () => {
      if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
      const send = () =>
        localizedFetch(
          `${base}/reservations/brokers/${encodeURIComponent(id)}/purchases?page=${page}`,
          { credentials: 'include', cache: 'no-store', signal: abort.signal },
        );
      let response = await send();
      if (response.status === 401 && (await refreshAuthenticatedSession(base)))
        response = await send();
      if (!response.ok) throw new Error('دریافت خریدهای کارگزار ناموفق بود.');
      const value = (await response.json()) as Result;
      if (!abort.signal.aborted) setState({ key, value });
    })().catch((error: unknown) => {
      if (!abort.signal.aborted)
        setState({
          key,
          error:
            error instanceof Error
              ? error.message
              : 'دریافت خریدهای کارگزار ناموفق بود.',
        });
    });
    return () => abort.abort();
  }, [id, page, key, allowed]);
  if (!allowed) return null;
  const current = state.key === key ? state : null;
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-bold">خریدهای ثبت‌شده برای کارگزار</h3>
      {current?.error ? (
        <p role="alert">{current.error}</p>
      ) : !current?.value ? (
        <p role="status">در حال دریافت هزینه‌ها…</p>
      ) : (
        <>
          {!current.value.data.length ? (
            <p>خریدی ثبت نشده است.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>قرارداد</th>
                    <th>خدمت</th>
                    <th>خرید ثبت‌شده</th>
                    <th>تاریخ خرید</th>
                  </tr>
                </thead>
                <tbody>
                  {current.value.data.map((row) => (
                    <tr key={row.id}>
                      <td>{row.contractNumber}</td>
                      <td>{row.serviceTitle}</td>
                      <td>
                        {formatSalesMoney(row.amount)} {row.currencyCode}
                      </td>
                      <td>{row.createdAt.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-2">
            {page > 1 && (
              <Button variant="outline" onClick={() => setPage(page - 1)}>
                صفحه قبل
              </Button>
            )}
            {current.value.hasMore && (
              <Button variant="outline" onClick={() => setPage(page + 1)}>
                صفحه بعد
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
