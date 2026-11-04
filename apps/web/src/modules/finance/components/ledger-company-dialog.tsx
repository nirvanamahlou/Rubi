'use client';
import { useRef, useState, type FormEvent } from 'react';
import {
  detailDigits,
  ledgerCompanyTypes,
  type LedgerCompanyView,
  type LedgerCompanyInput,
  type AccountingSnapshotV1,
} from '@nora/contracts';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { customersApi } from '@/modules/customers/public/entry';
import { AccountingSetupNotes } from './accounting-setup-notes';
import { LedgerPersonAddresses } from './ledger-person-addresses';
import { LedgerPartyTax } from './ledger-party-tax';
import styles from './ledger-person-dialog.module.css';

type Field =
  | keyof LedgerCompanyInput['fields']
  | 'name'
  | 'code'
  | 'nationalId'
  | 'registrationNumber'
  | 'economicCode';
const columns: readonly (readonly [Field, string][])[] = [
  [
    ['code', 'کد'],
    ['name', 'نام'],
    ['secondName', 'نام به زبان دوم'],
    ['abbreviation', 'نام اختصاری'],
    ['nationalId', 'کد/شناسه ملی'],
    ['economicCode', 'کد اقتصادی'],
  ],
  [
    ['foreignCode', 'کد فراگیر'],
    ['registrationNumber', 'شماره ثبت'],
    ['companyType', 'نوع شرکت'],
    ['activity', 'نوع فعالیت'],
    ['group', 'گروه'],
  ],
  [
    ['referenceCompany', 'شرکت مرجع'],
    ['website', 'وب سایت'],
    ['email', 'پست الکترونیک'],
    ['telephone', 'تلفن'],
    ['vatExpiry', 'تاریخ اعتبار گواهی ارزش افزوده'],
  ],
];
const tabs = [
  'اطلاعات اصلی',
  'اطلاعات گردش کار',
  'یادداشت',
  'طرف معامله مالیاتی',
];
const blank = (): LedgerCompanyView => ({
  id: '',
  version: 0,
  organizationVersion: 0,
  code: '',
  name: '',
  nationalId: '',
  economicCode: '',
  registrationNumber: '',
  fields: {},
  notes: [],
  addresses: [],
  taxRows: [],
});
export function LedgerCompanyDialog({
  initial,
  book,
  onClose,
  onSelected,
}: {
  initial?: LedgerCompanyView | undefined;
  book: AccountingSnapshotV1;
  onClose: () => void;
  onSelected: (company: { id: string; displayName: string }) => void;
}) {
  const [draft, setDraft] = useState<LedgerCompanyView>(
      () => initial ?? blank(),
    ),
    [tab, setTab] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const saving = useRef(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving.current) return;
    setError('');
    if (!draft.name.trim() || !draft.code.trim()) {
      setTab(0);
      setError('نام و کد شرکت را وارد کنید.');
      return;
    }
    if (
      draft.addresses.some(
        (r) => !r.title.trim() || !r.region.trim() || !r.address.trim(),
      )
    ) {
      setTab(0);
      setError('عنوان، منطقه جغرافیایی و آدرس هر نشانی را تکمیل کنید.');
      return;
    }
    const stay =
      (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') ===
      'stay';
    const { id, version, organizationVersion, ...input } = draft;
    saving.current = true;
    setBusy(true);
    try {
      const { data } = await customersApi.saveLedgerCompany(
        { ...input, ...(id ? { version, organizationVersion } : {}) },
        book.book.branchId,
        id || undefined,
      );
      if (stay)
        setDraft((old) => ({
          ...old,
          id: data.id,
          version: data.version,
          organizationVersion: data.organizationVersion,
          notes: data.notes,
        }));
      else onSelected(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره شرکت ناموفق بود.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function field(key: Field, label: string) {
    const base =
      key === 'code' ||
      key === 'name' ||
      key === 'nationalId' ||
      key === 'economicCode' ||
      key === 'registrationNumber';
    const val = (base ? draft[key] : draft.fields[key]) ?? '',
      id = 'ledger-company-' + key;
    const change = (v: string) =>
      setDraft((old) =>
        base
          ? { ...old, [key]: v }
          : { ...old, fields: { ...old.fields, [key]: v } },
      );
    const required = key === 'name' || key === 'code';
    return (
      <div
        key={key}
        className={styles.field}
        data-company-type={key === 'companyType' || undefined}
      >
        <label htmlFor={id}>
          {label}
          {required && <b aria-hidden="true"> *</b>}
        </label>
        {key === 'companyType' ? (
          <SearchCombobox
            id={id}
            label={label}
            value={val}
            onValueChange={change}
            footer={
              val ? (
                <button type="button" onClick={() => change('')}>
                  پاک کردن
                </button>
              ) : undefined
            }
            optionLimit={ledgerCompanyTypes.length}
            options={ledgerCompanyTypes.map((t) => ({ value: t, label: t }))}
          />
        ) : key === 'vatExpiry' ? (
          <DatePicker
            id={id}
            aria-label={label}
            withinDialog
            value={val}
            onChange={change}
          />
        ) : (
          <input
            id={id}
            value={val}
            required={required}
            type={key === 'email' || key === 'workflowEmail' ? 'email' : 'text'}
            inputMode={
              key === 'code' || key === 'nationalId' ? 'numeric' : undefined
            }
            maxLength={
              key === 'nationalId'
                ? 11
                : key === 'code'
                  ? 20
                  : key === 'name'
                    ? 160
                    : key === 'registrationNumber' || key === 'economicCode'
                      ? 80
                      : 200
            }
            dir={
              [
                'code',
                'nationalId',
                'economicCode',
                'foreignCode',
                'telephone',
                'website',
                'email',
                'workflowEmail',
                'registrationNumber',
              ].includes(key)
                ? 'ltr'
                : undefined
            }
            onChange={(e) =>
              change(
                [
                  'code',
                  'nationalId',
                  'registrationNumber',
                  'economicCode',
                ].includes(key)
                  ? detailDigits(e.target.value)
                  : e.target.value,
              )
            }
          />
        )}
      </div>
    );
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        dir="rtl"
        aria-describedby={undefined}
        className={styles.dialog}
      >
        <DialogTitle>{draft.id ? 'ویرایش شرکت' : 'ایجاد شرکت'}</DialogTitle>
        <form onSubmit={save}>
          <div role="tablist" className={styles.tabs}>
            {tabs.map((t, i) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={i === tab}
                onClick={() => setTab(i)}
              >
                {t}
              </button>
            ))}
          </div>
          <fieldset role="tabpanel" disabled={busy} className={styles.panel}>
            {tab === 0 && (
              <>
                <fieldset>
                  <legend>شرکت</legend>
                  <div className={styles.columns}>
                    {columns.map((col) => (
                      <div key={col[0]![0]}>
                        {col.map(([k, l]) => field(k, l))}
                      </div>
                    ))}
                  </div>
                </fieldset>
                <LedgerPersonAddresses
                  rows={draft.addresses}
                  change={(addresses) =>
                    setDraft((old) => ({ ...old, addresses }))
                  }
                />
              </>
            )}
            {tab === 1 && (
              <fieldset>
                <legend>اطلاعات گردش کار</legend>
                {field('workflowCode', 'کد')}
                {field('workflowEmail', 'پست الکترونیک')}
              </fieldset>
            )}
            {tab === 2 && (
              <AccountingSetupNotes
                book={book}
                record={
                  draft.id
                    ? {
                        id: draft.id,
                        entityType: 'AccountingCompany',
                        title: draft.name,
                      }
                    : undefined
                }
                notes={draft.notes}
                onChange={(notes) => setDraft((old) => ({ ...old, notes }))}
              />
            )}
            {tab === 3 && (
              <LedgerPartyTax
                company
                rows={draft.taxRows}
                onChange={(taxRows) => setDraft((old) => ({ ...old, taxRows }))}
              />
            )}
          </fieldset>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <button type="submit" value="select" disabled={busy}>
              ذخیره و انتخاب
            </button>
            <button type="submit" value="stay" disabled={busy}>
              ذخیره
            </button>
            <button type="button" onClick={onClose} disabled={busy}>
              بستن
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
