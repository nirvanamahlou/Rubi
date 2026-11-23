'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { treasuryDevices, type AccountingSnapshotV1 } from '@nora/contracts';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField, Input } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { AccountingButton as Button } from './accounting-operations';
import { accountingApi } from '../api/accounting-api';

type Instrument = {
  id: string;
  account: { title: string; version: number; currencyCode: string };
  operatorId: string | null;
  providerId: string | null;
  receivingBankId: string | null;
  receivingBank: { title: string; currencyCode: string } | null;
  operator: { title: string } | null;
  provider: { title: string } | null;
  description: string | null;
  descriptionEn: string | null;
  merchantNumber: string | null;
  terminalNumber: string | null;
  deviceType: string | null;
  location: string | null;
  titleEn: string | null;
};
type Bank = {
  id: string;
  title: string;
  bankName: string;
  currencyCode: string;
};
type History = {
  id: string;
  cashier: { code: string; title: string };
  startsAt: string;
  endsAt: string | null;
};
type Run = <T>(
  action: string,
  payload: Record<string, unknown>,
  expected?: number,
) => Promise<T | undefined>;
function useTreasuryPage<T>(
  bookId: string,
  view: string,
  params: Record<string, string>,
  enabled = true,
) {
  return useQuery({
    queryKey: ['treasury-instruments', bookId, view, params],
    enabled,
    retry: false,
    queryFn: () =>
      accountingApi.analytical<{ rows: T[]; hasNext: boolean }>(
        bookId,
        'treasury-instruments',
        { view, ...params },
      ),
  });
}
function Pager({
  page,
  next,
  set,
}: {
  page: number;
  next: boolean;
  set: (n: number) => void;
}) {
  return (
    <div className="flex gap-2">
      <Button type="button" disabled={page <= 1} onClick={() => set(page - 1)}>
        صفحه قبل
      </Button>
      <Button type="button" disabled={!next} onClick={() => set(page + 1)}>
        صفحه بعد
      </Button>
    </div>
  );
}
const empty = {
  title: '',
  titleEn: '',
  location: '',
  description: '',
  descriptionEn: '',
  merchantNumber: '',
  terminalNumber: '',
  deviceType: 'کارت خوان',
  receivingBankId: '',
  providerId: '',
  operatorId: '',
};
export function TreasuryInstruments({
  book,
  view,
  run,
  busy,
}: {
  book: AccountingSnapshotV1;
  view: string;
  run: Run;
  busy: boolean;
}) {
  const history = view === 'cashiers',
    terminal = view === 'terminals';
  const bookId = book.book.id,
    editable =
      useAccessPermissions()?.includes('finance.account.manage') === true;
  const cache = useQueryClient();
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [active, setActive] = useState<Instrument | null>(null),
    [draft, setDraft] = useState(empty);
  const [bankText, setBankText] = useState(''),
    [bankPage, setBankPage] = useState(1),
    [bank, setBank] = useState<Bank | null>(null);
  const list = useTreasuryPage<Instrument>(
    bookId,
    terminal ? 'terminals' : 'cashboxes',
    { page: String(page), search },
  );
  const banks = useTreasuryPage<Bank>(
    bookId,
    'banks',
    { page: String(bankPage), search: bankText },
    terminal,
  );
  const people = book.details.filter(
    (d) =>
      book.configurations.some(
        (c) =>
          c.id === d.typeId && c.kind === 'detail-types' && c.title === 'شخص',
      ) &&
      (d.active || d.id === active?.operatorId),
  );
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [period, setPeriod] = useState<{
      from: string;
      to: string;
      instrumentId: string;
    } | null>(null),
    [historyPage, setHistoryPage] = useState(1);
  const historyReport = useTreasuryPage<History>(
    bookId,
    'cashiers',
    {
      from: period?.from ?? '',
      to: period?.to ?? '',
      instrumentId: period?.instrumentId ?? '',
      page: String(historyPage),
    },
    history && !!period,
  );
  const field = (key: keyof typeof empty, label: string, required = false) => (
    <FormField label={label} required={required}>
      <Input
        value={draft[key]}
        required={required}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      />
    </FormField>
  );
  const select = (r: Instrument | null) => {
    setActive(r);
    setPeriod(null);
    setHistoryPage(1);
    setBank(
      r?.receivingBank
        ? {
            id: r.receivingBankId!,
            title: r.receivingBank.title,
            currencyCode: r.receivingBank.currencyCode,
            bankName: '',
          }
        : null,
    );
    setDraft(
      r
        ? {
            title: r.account.title,
            titleEn: r.titleEn ?? '',
            location: r.location ?? '',
            description: r.description ?? '',
            descriptionEn: r.descriptionEn ?? '',
            merchantNumber: r.merchantNumber ?? '',
            terminalNumber: r.terminalNumber ?? '',
            deviceType: r.deviceType ?? 'کارت خوان',
            receivingBankId: r.receivingBankId ?? '',
            providerId: r.providerId ?? '',
            operatorId: r.operatorId ?? '',
          }
        : empty,
    );
  };
  return (
    <section dir="rtl" className="space-y-4">
      <h2 className="text-lg font-bold">
        {history
          ? 'تاریخچه صندوق داران'
          : terminal
            ? 'معرفی پایانه فروش'
            : 'صندوق'}
      </h2>
      {!history && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const saved = await run<{ id: string }>(
              'save-treasury-instrument',
              { ...draft, kind: view, ...(active ? { id: active.id } : {}) },
              active?.account.version,
            );
            if (saved) {
              select(null);
              await cache.invalidateQueries({
                queryKey: ['treasury-instruments', bookId],
              });
            }
          }}
        >
          <fieldset
            disabled={!editable || busy}
            className="grid gap-3 border p-3 sm:grid-cols-3"
          >
            {terminal ? (
              <>
                <FormField label="حساب بانکی" required>
                  <SearchCombobox
                    label="حساب بانکی"
                    required
                    remote
                    value={draft.receivingBankId}
                    selectedLabel={bank?.title}
                    onSearchChange={(v) => {
                      setBankText(v);
                      setBankPage(1);
                    }}
                    loading={banks.isFetching}
                    error={banks.error?.message}
                    options={(banks.data?.rows ?? []).map((b) => ({
                      value: b.id,
                      label: b.title,
                    }))}
                    footer={
                      <Pager
                        page={bankPage}
                        next={!!banks.data?.hasNext}
                        set={setBankPage}
                      />
                    }
                    onValueChange={(id) => {
                      setBank(
                        banks.data?.rows.find((b) => b.id === id) ?? null,
                      );
                      setDraft({ ...draft, receivingBankId: id });
                    }}
                  />
                </FormField>
                <FormField label="بانک">
                  <output>
                    {bank?.bankName ||
                      banks.data?.rows.find(
                        (b) => b.id === draft.receivingBankId,
                      )?.bankName}
                  </output>
                </FormField>
                <FormField label="ارز">
                  <output>{bank?.currencyCode}</output>
                </FormField>
                {field('merchantNumber', 'شماره پذیرنده', true)}
                {field('terminalNumber', 'شماره پایانه', true)}
                <FormField label="شرکت خدمات پرداخت" required>
                  <SearchCombobox
                    label="شرکت خدمات پرداخت"
                    required
                    value={draft.providerId}
                    options={book.configurations
                      .filter(
                        (c) =>
                          c.kind === 'payment-providers' &&
                          (c.active || c.id === active?.providerId),
                      )
                      .map((c) => ({ value: c.id, label: c.title }))}
                    onValueChange={(id) =>
                      setDraft({ ...draft, providerId: id })
                    }
                  />
                </FormField>
                <FormField label="نوع ابزار پرداخت" required>
                  <select
                    value={draft.deviceType}
                    onChange={(e) =>
                      setDraft({ ...draft, deviceType: e.target.value })
                    }
                  >
                    {treasuryDevices.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </FormField>
              </>
            ) : (
              <>
                {field('title', 'نام', true)}
                {field('titleEn', 'نام به زبان دوم')}
                {field('location', 'محل فیزیکی')}
              </>
            )}
            <FormField
              label={terminal ? 'مسئول پایانه' : 'صندوق‌دار'}
              required={!terminal}
            >
              <SearchCombobox
                label={terminal ? 'مسئول پایانه' : 'صندوق‌دار'}
                required={!terminal}
                value={draft.operatorId}
                options={people.map((p) => ({
                  value: p.id,
                  label: p.code + ' — ' + p.title,
                }))}
                onValueChange={(id) => setDraft({ ...draft, operatorId: id })}
              />
            </FormField>
            {field('description', 'شرح')}
            {field('descriptionEn', 'شرح به زبان دوم')}
            <div>
              <Button type="submit">ذخیره</Button>{' '}
              <Button type="button" onClick={() => select(null)}>
                جدید
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      <FormField label="جستجو">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </FormField>
      {list.error && <p role="alert">{list.error.message}</p>}
      {list.isFetching && <p role="status">در حال بارگذاری…</p>}
      <table className="w-full">
        <thead>
          <tr>
            <th>{terminal ? 'شماره پایانه' : 'صندوق'}</th>
            <th>{terminal ? 'شرکت خدمات پرداخت' : 'صندوق‌دار'}</th>
            <th>انتخاب</th>
          </tr>
        </thead>
        <tbody>
          {list.data?.rows.map((r) => (
            <tr key={r.id}>
              <td>{r.account.title}</td>
              <td>{terminal ? r.provider?.title : r.operator?.title}</td>
              <td>
                <Button disabled={busy} onClick={() => select(r)}>
                  {history ? 'انتخاب' : 'مشاهده'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager page={page} next={!!list.data?.hasNext} set={setPage} />
      {history && (
        <>
          <form
            className="flex flex-wrap gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (active) {
                setPeriod({ from, to, instrumentId: active.id });
                setHistoryPage(1);
              }
            }}
          >
            <FormField label="صندوق">
              <output>{active?.account.title}</output>
            </FormField>
            <FormField label="از تاریخ" required>
              <DatePicker
                value={from}
                onChange={(v) => {
                  setFrom(v);
                  setPeriod(null);
                }}
                required
              />
            </FormField>
            <FormField label="تا تاریخ" required>
              <DatePicker
                value={to}
                onChange={(v) => {
                  setTo(v);
                  setPeriod(null);
                }}
                required
              />
            </FormField>
            <Button disabled={!active || !from || !to} type="submit">
              مشاهده گزارش
            </Button>
          </form>
          {period && historyReport.error && (
            <p role="alert">{historyReport.error.message}</p>
          )}
          {period && historyReport.data && (
            <>
              <table className="w-full">
                <thead>
                  <tr>
                    <th>صندوق‌دار</th>
                    <th>تاریخ شروع</th>
                    <th>تاریخ پایان</th>
                  </tr>
                </thead>
                <tbody>
                  {historyReport.data.rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.cashier.title}</td>
                      <td>{localDate(r.startsAt)}</td>
                      <td>{r.endsAt ? localDate(r.endsAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pager
                page={historyPage}
                next={historyReport.data.hasNext}
                set={setHistoryPage}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
const dateFormat = new Intl.DateTimeFormat('fa-IR', {
  timeZone: 'Asia/Tehran',
  dateStyle: 'short',
});
const localDate = (value: string) => dateFormat.format(new Date(value));
