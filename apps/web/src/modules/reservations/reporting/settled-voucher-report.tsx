'use client';
import { useEffect, useState } from 'react';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { useAccessActor } from '@/modules/iam/access-context';
import { useLegalEntityContext } from '@/modules/legal-entities/components/legal-entity-context';

interface VoucherPage {
  total: number;
  unknownStayCount: number;
  rows: {
    intakeId: string;
    stayKey: string;
    contractNumber: string;
    hotelName: string;
    checkInDate: string;
    checkOutDate: string;
  }[];
}

export function SettledVoucherReport() {
  const actor = useAccessActor();
  const { context } = useLegalEntityContext();
  const permissions: readonly string[] = actor?.permissions ?? [];
  return (
    <Report
      canExport={
        permissions.includes('finance.export') &&
        permissions.includes('reporting.export')
      }
      key={JSON.stringify([
        actor?.sessionId,
        actor?.permissions,
        actor?.branchIds,
        context?.selection,
        context?.version,
      ])}
    />
  );
}

function Report({ canExport }: { canExport: boolean }) {
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<VoucherPage>();
  const [error, setError] = useState('');
  const base = getPublicApiBaseUrl();
  const path = base + '/reports/nora/settled-vouchers';
  function goToPage(nextPage: number) {
    setReport(undefined);
    setError('');
    setPage(nextPage);
  }
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      if (!base) throw Error('ERP_API_UNAVAILABLE');
      const read = () =>
        fetch(path + '?page=' + page + '&pageSize=25', {
          credentials: 'include',
          cache: 'no-store',
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15000),
          ]),
        });
      let response = await read();
      if (
        response.status === 401 &&
        !controller.signal.aborted &&
        (await refreshAuthenticatedSession(base))
      )
        response = await read();
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setError(
          response.status === 403
            ? 'دسترسی مجاز نیست.'
            : 'دریافت گزارش ناموفق بود.',
        );
        return;
      }
      const data: VoucherPage = await response.json();
      if (!controller.signal.aborted) setReport(data);
    }
    void load().catch(() => {
      if (!controller.signal.aborted) setError('دریافت گزارش ناموفق بود.');
    });
    return () => controller.abort();
  }, [page, path, base]);
  return (
    <section className="space-y-4 rounded-xl bg-white p-5">
      <h1 className="text-xl font-bold">
        اقامت‌های بدون واچر در قراردادهای تسویه‌شده
      </h1>
      {error ? (
        <p role="alert">{error}</p>
      ) : !report ? (
        <p role="status">در حال بارگذاری…</p>
      ) : (
        <>
          <p>
            تعداد اقامت‌های بدون واچر <b>{report.total}</b>
          </p>
          {report.unknownStayCount > 0 && (
            <p>
              اقامت‌های فاقد سابقهٔ قابل‌تشخیص صدور واچر{' '}
              <b>{report.unknownStayCount}</b>
            </p>
          )}
          {canExport && (
            <a className="text-blue-700 underline" href={path + '/export'}>
              خروجی اکسل
            </a>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <thead>
                <tr>
                  <th>شماره قرارداد</th>
                  <th>هتل</th>
                  <th>تاریخ ورود</th>
                  <th>تاریخ خروج</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.intakeId + '/' + row.stayKey}>
                    <td>{row.contractNumber}</td>
                    <td>{row.hotelName}</td>
                    <td>{row.checkInDate}</td>
                    <td>{row.checkOutDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="flex gap-4" aria-label="صفحه‌بندی">
            <button disabled={page <= 1} onClick={() => goToPage(page - 1)}>
              قبلی
            </button>
            <span>{page}</span>
            <button
              disabled={page * 25 >= report.total}
              onClick={() => goToPage(page + 1)}
            >
              بعدی
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
