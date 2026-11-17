'use client';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { MasterDataReferenceSelector as Ref } from '@/modules/master-data/components/master-data-reference-selector';
import { accountingApi } from '../api/accounting-api';
import { bankAccountsApi } from '../api/bank-accounts-api';
import { AccountingButton as Button } from './accounting-operations';
type Row = {
  id: string;
  ownerId: string;
  version: number;
  owner: { title: string };
  account: { maskedAccountNumber: string };
  bankBranch: { name: string; code: string; city: { name: string } };
  direction: string;
  blacklisted: boolean;
  note: string;
};
type Result = {
  rows: Row[];
  accounts: {
    id: string;
    bankId: string;
    title: string;
    maskedAccountNumber: string;
  }[];
};
export function BeneficiaryRegister({
  snapshot,
  busy,
  run,
}: {
  snapshot: AccountingSnapshotV1;
  busy: boolean;
  run: <T>(
    action: string,
    p: Record<string, unknown>,
    version?: number,
  ) => Promise<T | undefined>;
}) {
  const [owner, setOwner] = useState(''),
    [existing, setExisting] = useState(''),
    [bank, setBank] = useState(''),
    [branch, setBranch] = useState(''),
    [number, setNumber] = useState(''),
    [iban, setIban] = useState(''),
    [direction, setDirection] = useState('ALL'),
    [blocked, setBlocked] = useState(false),
    [note, setNote] = useState(''),
    [edit, setEdit] = useState<Row | null>(null),
    [broker, setBroker] = useState(''),
    [supplier, setSupplier] = useState(''),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const key = useRef('');
  const q = useQuery({
    queryKey: ['beneficiaries', snapshot.book.id],
    queryFn: () =>
      accountingApi.analytical<Result>(snapshot.book.id, 'beneficiaries', {}),
  });
  function clear() {
    setEdit(null);
    setOwner('');
    setBank('');
    setBranch('');
    setExisting('');
    setNumber('');
    setIban('');
    setDirection('ALL');
    setBlocked(false);
    setNote('');
    setBroker('');
    setSupplier('');
    key.current = '';
  }
  async function save() {
    if (saving || busy) return;
    setSaving(true);
    setError('');
    try {
      let accountId = existing;
      if (!edit && !existing) {
        key.current ||= crypto.randomUUID();
        const r = await bankAccountsApi.create(bank, {
          requestId: key.current,
          branchId: snapshot.book.branchId,
          isExternal: true,
          isActive: true,
          title: snapshot.details.find((x) => x.id === owner)?.title ?? '',
          currencyCode: null,
          accountNumber: number,
          iban: iban || null,
        });
        accountId = r.id;
        setExisting(accountId);
      }
      const r = await run(
        'save-beneficiary',
        edit
          ? { id: edit.id, direction, blacklisted: blocked, note }
          : {
              accountId,
              bankBranchId: branch,
              ownerId: owner,
              brokerId: broker,
              supplierId: supplier,
              direction,
              blacklisted: blocked,
              note,
            },
        edit?.version,
      );
      if (r) {
        clear();
        await q.refetch();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="space-y-3">
      <h3>حساب بانکی ذی‌نفع</h3>
      {(error || q.error) && <p role="alert">{error || q.error?.message}</p>}
      <form
        className="grid gap-3 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {edit ? (
          <p>
            {edit.owner.title} · {edit.account.maskedAccountNumber}
          </p>
        ) : (
          <>
            <label>
              صاحب حساب{' '}
              <select
                required
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              >
                <option value="">انتخاب شخص یا شرکت</option>
                {snapshot.details
                  .filter((x) => x.active && x.customerId)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.code} · {x.title}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              حساب خارجی ثبت‌شده{' '}
              <select
                value={existing}
                onChange={(e) => {
                  setExisting(e.target.value);
                  setBank(
                    q.data?.accounts.find((x) => x.id === e.target.value)
                      ?.bankId ?? '',
                  );
                  setBranch('');
                }}
              >
                <option value="">معرفی حساب جدید</option>
                {q.data?.accounts.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title} · {x.maskedAccountNumber}
                  </option>
                ))}
              </select>
            </label>
            {!existing && (
              <>
                <label>
                  بانک{' '}
                  <Ref
                    required
                    label="بانک"
                    id="payee-bank"
                    disabled={saving}
                    config={{ target: 'banks', payload: 'id' }}
                    value={bank}
                    onChange={(id) => {
                      setBank(id);
                      setBranch('');
                    }}
                  />
                </label>
                <label>
                  شماره حساب{' '}
                  <input
                    required
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                  />
                </label>
                <label>
                  شبا{' '}
                  <input
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                  />
                </label>
              </>
            )}
            <label>
              شعبه بانک{' '}
              <Ref
                id="payee-bank-branch"
                required
                disabled={!bank || saving}
                config={{
                  target: 'bank-branches',
                  payload: 'id',
                  scopeField: 'bankId',
                }}
                scopeValue={bank}
                value={branch}
                onChange={setBranch}
              />
            </label>
            <label>
              کارگزار مرتبط{' '}
              <Ref
                id="payee-broker"
                disabled={!!supplier}
                config={{ target: 'brokers', payload: 'id' }}
                value={broker}
                onChange={setBroker}
              />
            </label>
            <label>
              تأمین‌کننده مرتبط{' '}
              <Ref
                id="payee-supplier"
                disabled={!!broker}
                config={{ target: 'suppliers', payload: 'id' }}
                value={supplier}
                onChange={setSupplier}
              />
            </label>
          </>
        )}
        <label>
          جهت سند{' '}
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          >
            <option value="ALL">همه</option>
            <option value="RECEIPT">دریافت</option>
            <option value="PAYMENT">پرداخت</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={blocked}
            onChange={(e) => setBlocked(e.target.checked)}
          />{' '}
          فهرست سیاه
        </label>
        <label>
          توضیحات{' '}
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <Button type="submit" disabled={busy || saving}>
          ذخیره حساب ذی‌نفع
        </Button>
        {edit && (
          <Button type="button" onClick={clear}>
            انصراف
          </Button>
        )}
      </form>
      <table>
        <thead>
          <tr>
            {[
              'صاحب حساب',
              'شماره حساب',
              'شعبه بانک',
              'شهر',
              'جهت سند',
              'وضعیت',
              '',
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {q.data?.rows.map((r) => (
            <tr key={r.id}>
              <td>{r.owner.title}</td>
              <td>{r.account.maskedAccountNumber}</td>
              <td>
                {r.bankBranch.code} · {r.bankBranch.name}
              </td>
              <td>{r.bankBranch.city.name}</td>
              <td>
                {
                  { ALL: 'همه', PAYMENT: 'پرداخت', RECEIPT: 'دریافت' }[
                    r.direction
                  ]
                }
              </td>
              <td>{r.blacklisted ? 'فهرست سیاه' : 'فعال'}</td>
              <td>
                <Button
                  onClick={() => {
                    setEdit(r);
                    setDirection(r.direction);
                    setBlocked(r.blacklisted);
                    setNote(r.note);
                  }}
                >
                  ویرایش
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
