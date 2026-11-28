'use client';
import { accountingWorkflowLabels } from '@nora/contracts';
import { journalStates } from '../accounting-voucher-display';
import type { accountingApi } from '../api/accounting-api';
type Activity = Awaited<ReturnType<typeof accountingApi.journalEvents>>;
const eventTypes = {
  CREATE: 'ثبت اولیه',
  STATUS: 'تغییر وضعیت',
  MOVE: 'جابجایی سند',
};
const label = (s: string | null) =>
  s ? (journalStates[s as keyof typeof journalStates] ?? s) : '—';
export function AccountingJournalActivity({
  tab,
  data,
  error,
}: {
  tab: 'history' | 'conversations' | 'processes';
  data: Activity | undefined;
  error: string | undefined;
}) {
  if (tab === 'conversations')
    return (
      <p role="status">
        برای این سند ارتباطی با سامانهٔ مکالمات تعریف نشده است.
      </p>
    );
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">در حال دریافت اطلاعات…</p>;
  const wf = data.workflow;
  const headers =
    tab === 'history'
      ? [
          'وضعیت مبدأ',
          'وضعیت مقصد',
          'عملیات گردش کار',
          'گیرنده گردش کار',
          'تاریخ تغییر وضعیت',
          'توسط',
          'توضیحات',
        ]
      : [
          'شناسه فرآیند',
          'مشخصه فرایند',
          'عنوان',
          'نام فرآیند',
          'زمان شروع',
          'زمان پایان',
          'نسخه فرآیند',
        ];
  const rows =
    tab === 'history'
      ? data.events.map((e) => ({
          id: e.id,
          values: [
            label(e.fromStatus),
            label(e.toStatus),
            eventTypes[e.eventType],
            null,
            e.occurredAt,
            e.actorName,
            e.reason,
          ],
        }))
      : wf
        ? [
            {
              id: wf.id,
              values: [
                wf.id,
                wf.kind,
                wf.reference,
                accountingWorkflowLabels[wf.kind] ?? wf.kind,
                wf.createdAt,
                null,
                null,
              ],
            },
          ]
        : [];
  return (
    <div className="overflow-auto">
      <table className="w-full text-start text-sm">
        <thead>
          <tr>
            {headers.map((h) => (
              <th className="border p-2" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {row.values.map((value, i) => (
                <td className="border p-2" key={i}>
                  {value || '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p>سطری برای نمایش وجود ندارد.</p>}
      {tab === 'history' && data.historicalGap && (
        <p>تاریخچه این سند کامل نیست.</p>
      )}
    </div>
  );
}
