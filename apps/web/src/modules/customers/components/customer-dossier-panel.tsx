'use client';
import { useEffect, useState } from 'react';
import type {
  CustomerDossierResponse,
  CustomerDossierSectionId,
} from '@nora/contracts';
import { customersApi } from '../api/client';
import { useLegalEntityContext } from '@/modules/legal-entities/components/legal-entity-context';
const labels: Record<CustomerDossierSectionId, string> = {
  requests: 'درخواست‌ها',
  contracts: 'قراردادها',
  services: 'خدمات خریداری‌شده',
  tickets: 'بلیط‌ها',
  vouchers: 'واچرها',
  insurance: 'بیمه‌نامه‌ها',
  payments: 'پرداخت‌ها',
  checks: 'چک‌ها',
  support: 'تیکت‌های پشتیبانی',
};
export function CustomerDossierPanel({ customerId }: { customerId: string }) {
  const { context, loading, switching } = useLegalEntityContext();
  if (loading || switching) return <p role="status">در حال دریافت سوابق</p>;
  return (
    <CustomerDossierRecords
      key={`${customerId}:${context?.selection}:${context?.version}`}
      customerId={customerId}
    />
  );
}
function CustomerDossierRecords({ customerId }: { customerId: string }) {
  const [result, setResult] = useState<CustomerDossierResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void customersApi
      .dossier(customerId)
      .then((r) => {
        if (active && r.data.customerId === customerId) setResult(r);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [customerId, revision]);
  const current = result?.data.customerId === customerId ? result : null;
  return (
    <section
      className="space-y-4 rounded-xl border p-4"
      aria-label="سوابق کامل پرونده"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-bold">سوابق کامل پرونده</h3>
        <button
          type="button"
          className="rounded-lg border px-3 py-2"
          onClick={() => {
            setResult(null);
            setFailed(false);
            setRevision((n) => n + 1);
          }}
        >
          بازخوانی
        </button>
      </div>
      {failed ? (
        <p role="alert">دریافت سوابق ناموفق بود؛ دوباره تلاش کنید.</p>
      ) : !current ? (
        <p role="status">در حال دریافت سوابق</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(labels) as CustomerDossierSectionId[]).map((id) => {
            const section = current.data.sections.find((s) => s.id === id);
            return (
              <section key={id} className="space-y-2 rounded-xl border p-3">
                <h4 className="font-semibold">{labels[id]}</h4>
                {!section || section.state === 'unavailable' ? (
                  <p>این بخش موقتاً در دسترس نیست.</p>
                ) : section.state === 'forbidden' ? (
                  <p>مجوز مشاهده این بخش را ندارید.</p>
                ) : (
                  <>
                    {!section.rows.length ? (
                      <p>سابقه‌ای ثبت نشده است.</p>
                    ) : (
                      <ul className="space-y-2">
                        {section.rows.map((row) => (
                          <li
                            key={row.id}
                            className="rounded-lg bg-muted p-2 text-sm"
                          >
                            <bdi>{row.reference}</bdi>
                            <span className="mx-2">{row.status}</span>
                            <time dateTime={row.occurredAt}>
                              {new Date(row.occurredAt).toLocaleDateString(
                                'en-GB',
                                { timeZone: 'Asia/Tehran' },
                              )}
                            </time>
                            {row.amount !== undefined ? (
                              <p>
                                <bdi>
                                  {row.amount} {row.currencyCode}
                                </bdi>
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    {section.hasMore ? (
                      <p>۵۰ سابقه اخیر نمایش داده می‌شود.</p>
                    ) : null}
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
