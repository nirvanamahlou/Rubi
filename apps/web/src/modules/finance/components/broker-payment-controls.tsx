'use client';
import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  FinanceInboxItemV1,
  FinanceSourceReferencesV1,
} from '@nora/contracts';
import { apiRequest } from '../api/finance-inbox-api';
import { useFinanceFiscalContext } from '../finance-fiscal-context';
import { FinanceSourceReferenceLinks } from './finance-source-references';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { Button } from '@/components/ui/button';
type Bill = {
  total: string;
  remaining: string;
  currency: string;
  contractId: string | null;
  contractNumber: string | null;
};
type Advance = {
  id: string;
  officeId: string;
  amount: string;
  rate: string;
  sentAt: string;
  broker: { name: string };
  office: { title: string };
};
type Options = {
  designate: boolean;
  brokers: { id: string; name: string }[];
  pending: Advance[];
  payees: {
    id: string;
    ownerId: string;
    owner: { title: string };
    account: { maskedAccountNumber: string | null };
  }[];
  receipts: { id: string; sourceEntityId: string; archiveCode: string }[];
  bill: Bill;
};
export type BankSelection = {
  beneficiaryId: string;
  brokerTransferId: string;
  brokerReceiptId: string;
};
export const emptyBankSelection: BankSelection = {
  beneficiaryId: '',
  brokerTransferId: '',
  brokerReceiptId: '',
};
export function BrokerPaymentControls(p: {
  item: FinanceInboxItemV1;
  exchange: boolean;
  direct: boolean;
  office: string;
  amount: string;
  rate: string;
  date: string;
  selection: BankSelection;
  change: (s: BankSelection) => void;
  selectTransfer: (r: Advance) => void;
}) {
  const permissions = useAccessPermissions(),
    fiscal = useFinanceFiscalContext(),
    [search, setSearch] = useState(''),
    [broker, setBroker] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const key = useRef(''),
    kind =
      p.item.source === 'FINANCE' || p.item.source === 'HR'
        ? 'OPERATIONAL'
        : p.item.ticketPurchase
          ? 'TICKET'
          : p.item.source === 'RESERVATIONS'
            ? 'RESERVATIONS'
            : 'INVOICE',
    sourceId = p.item.ticketPurchase
      ? p.item.sourceContextReference
      : p.item.sourceReference;
  const options = useQuery({
    queryKey: ['bank-payees', fiscal?.key, kind, sourceId, search],
    enabled: p.exchange || p.direct,
    queryFn: () =>
      apiRequest<Options>(
        '/finance/bank-controls/options?' +
          new URLSearchParams({ kind, sourceId, search }),
      ),
  });
  if (!p.exchange && !p.direct) return null;
  const data = options.data;
  async function send() {
    if (busy || !data) return;
    setBusy(true);
    setError('');
    try {
      key.current ||= crypto.randomUUID();
      const id = key.current,
        day = new Date(
          /[zZ]$|[+-]\d{2}:\d{2}$/.test(p.date) ? p.date : p.date + '+03:30',
        ).toISOString();
      await apiRequest('/finance/bank-controls/advances', {
        method: 'POST',
        body: JSON.stringify({
          id,
          kind,
          sourceId,
          brokerId: broker,
          officeId: p.office,
          amount: p.amount,
          rate: p.rate,
          sentAt: day,
        }),
      });
      key.current = '';
      const fresh = await options.refetch();
      const r = fresh.data?.pending.find((x) => x.id === id);
      if (r) {
        p.change({ ...emptyBankSelection, brokerTransferId: r.id });
        p.selectTransfer(r);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت حواله انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset className="col-span-full space-y-3 border p-3">
      <legend>
        {p.exchange ? 'حواله صرافی به کارگزار' : 'حساب بانکی ذی‌نفع'}
      </legend>
      {(error || options.error) && (
        <p role="alert">{error || options.error?.message}</p>
      )}
      {p.exchange ? (
        <>
          <label>
            حواله در انتظار رسید{' '}
            <select
              value={p.selection.brokerTransferId}
              onChange={(e) => {
                const r = data?.pending.find((x) => x.id === e.target.value);
                p.change({
                  ...emptyBankSelection,
                  brokerTransferId: e.target.value,
                });
                if (r) p.selectTransfer(r);
              }}
            >
              <option value="">حواله جدید</option>
              {data?.pending.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.broker.name} · {r.office.title} · {r.amount}{' '}
                  {data.bill.currency} · {r.id}
                </option>
              ))}
            </select>
          </label>
          {p.selection.brokerTransferId ? (
            <label>
              رسید بایگانی‌شده{' '}
              <select
                value={p.selection.brokerReceiptId}
                onChange={(e) =>
                  p.change({ ...p.selection, brokerReceiptId: e.target.value })
                }
              >
                <option value="">بارگذاری رسید کارگزار</option>
                {data?.receipts
                  .filter(
                    (r) => r.sourceEntityId === p.selection.brokerTransferId,
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.archiveCode}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <>
              <label>
                جستجوی کارگزار{' '}
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label>
                کارگزار{' '}
                <select
                  value={broker}
                  onChange={(e) => setBroker(e.target.value)}
                >
                  <option value="">انتخاب کارگزار</option>
                  {data?.brokers.map((b) => (
                    <option value={b.id} key={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>{' '}
              <Button
                type="button"
                disabled={
                  busy ||
                  !broker ||
                  !p.office ||
                  !p.amount ||
                  !p.rate ||
                  !p.date
                }
                onClick={() => void send()}
              >
                ثبت حواله بدون تسویه خرید
              </Button>
            </>
          )}
        </>
      ) : (
        <label>
          حساب مقصد{' '}
          <select
            required
            value={p.selection.beneficiaryId}
            onChange={(e) =>
              p.change({ ...emptyBankSelection, beneficiaryId: e.target.value })
            }
          >
            <option value="">انتخاب حساب مقصد</option>
            {data?.payees.map((x) => (
              <option value={x.id} key={x.id}>
                {x.owner.title} · {x.account.maskedAccountNumber}
              </option>
            ))}
          </select>
        </label>
      )}
      {p.direct && data?.designate && (
        <div>
          <p>
            برای این خرید یا درخواست، صاحب حساب باید یک‌بار توسط مدیر حساب‌های
            مالی تعیین شود.
          </p>
          {permissions?.includes('finance.account.manage') && (
            <Button
              type="button"
              disabled={busy || !p.selection.beneficiaryId}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await apiRequest('/finance/bank-controls/designations', {
                    method: 'POST',
                    body: JSON.stringify({
                      kind,
                      sourceId,
                      ownerId: data.payees.find(
                        (x) => x.id === p.selection.beneficiaryId,
                      )?.ownerId,
                    }),
                  });
                  await options.refetch();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              تأیید صاحب حساب برای همین درخواست
            </Button>
          )}
        </div>
      )}
    </fieldset>
  );
}
type Ledger = {
  brokers: { id: string; name: string }[];
  balances: {
    currency: string;
    credit: string;
    debit: string;
    balance: string;
    pending: string;
  }[];
  rows: {
    references: FinanceSourceReferencesV1;
    id: string;
    sourceId: string;
    broker: { name: string; id: string };
    office: string;
    currency: string;
    amount: string;
    sentAt: string;
    receivedAt: string | null;
    receiptId: string | null;
    receiptNumber: string | null;
    bill: Bill;
  }[];
  hasNext: boolean;
};
export function BrokerLedger() {
  const fiscal = useFinanceFiscalContext(),
    [search, setSearch] = useState(''),
    [broker, setBroker] = useState(''),
    [brokerSearch, setBrokerSearch] = useState(''),
    [page, setPage] = useState(1),
    [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: [
      'broker-ledger',
      fiscal?.key,
      search,
      broker,
      brokerSearch,
      page,
    ],
    enabled: open,
    queryFn: () =>
      apiRequest<Ledger>(
        '/finance/bank-controls/ledger?' +
          new URLSearchParams({
            search,
            brokerId: broker,
            brokerSearch,
            page: String(page),
          }),
      ),
  });
  return (
    <section className="rounded border p-3">
      <Button type="button" variant="outline" onClick={() => setOpen(!open)}>
        گردش کارگزاران و مانده خریدها
      </Button>
      {open && (
        <>
          <label>
            جستجوی کارگزار{' '}
            <input
              value={brokerSearch}
              onChange={(e) => setBrokerSearch(e.target.value)}
            />
          </label>
          <label>
            کارگزار{' '}
            <select
              value={broker}
              onChange={(e) => {
                setBroker(e.target.value);
                setPage(1);
              }}
            >
              <option value="">همه کارگزاران</option>
              {q.data?.brokers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            جستجوی شماره قرارداد یا کارگزار{' '}
            <input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </label>
          {broker && (
            <Button
              onClick={() => {
                setBroker('');
                setPage(1);
              }}
            >
              همه کارگزاران
            </Button>
          )}
          {q.data?.balances.map((b) => (
            <p key={b.currency}>
              {b.currency} · جمع خرید: {b.credit} · پرداخت تأییدشده: {b.debit} ·
              مانده: {b.balance} · در انتظار رسید: {b.pending}
            </p>
          ))}
          {q.error && <p role="alert">{q.error.message}</p>}
          <div className="overflow-auto">
            <table>
              <thead>
                <tr>
                  {[
                    'کارگزار',
                    'قرارداد',
                    'صرافی',
                    'شماره حواله',
                    'تاریخ حواله',
                    'مبلغ حواله',
                    'بستانکار (خرید)',
                    'بدهکار (وصول تأییدشده)',
                    'مانده خرید',
                    'رسید کارگزار',
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {q.data?.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <button
                        onClick={() => {
                          setBroker(r.broker.id);
                          setPage(1);
                        }}
                      >
                        {r.broker.name}
                      </button>
                    </td>
                    <td>
                      {r.references.contracts.length ||
                      r.references.journals.length ? (
                        <FinanceSourceReferenceLinks
                          references={r.references}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{r.office}</td>
                    <td>{r.id}</td>
                    <td>
                      {new Date(r.sentAt).toLocaleDateString('fa-IR', {
                        timeZone: 'Asia/Tehran',
                      })}
                    </td>
                    <td>
                      {r.amount} {r.currency}
                    </td>
                    <td>{r.bill.total}</td>
                    <td>{r.receivedAt ? r.amount : '—'}</td>
                    <td>
                      {r.bill.remaining} {r.currency}
                    </td>
                    <td>
                      {r.receiptId ? (
                        <a href={'/documents?document=' + r.receiptId}>
                          {r.receiptNumber}
                        </a>
                      ) : (
                        'در انتظار رسید کارگزار'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
            صفحه قبل
          </Button>
          <Button disabled={!q.data?.hasNext} onClick={() => setPage(page + 1)}>
            صفحه بعد
          </Button>
        </>
      )}
    </section>
  );
}
