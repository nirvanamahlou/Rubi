'use client';
import { useRef, useState, type FormEvent } from 'react';
import {
  detailDigits,
  personEducation,
  personMarital,
  personReligions,
  personTitles,
  type AccountingSnapshotV1,
  type LedgerPersonView,
  type LedgerPersonTextKey,
} from '@nora/contracts';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { DatePicker } from '@/components/ui/date-picker';
import { customersApi } from '@/modules/customers/public/entry';
import { AccountingSetupNotes } from './accounting-setup-notes';
import { LedgerPersonAddresses, PersonPlace } from './ledger-person-addresses';
import { LedgerPartyTax } from './ledger-party-tax';
import styles from './ledger-person-dialog.module.css';

const tabs = [
  'اطلاعات اصلی',
  'اطلاعات گردش کار',
  'یادداشت',
  'طرف معامله مالیاتی',
] as const;
type Key =
  | LedgerPersonTextKey
  | 'code'
  | 'firstName'
  | 'lastName'
  | 'gender'
  | 'nationalId'
  | 'birthDate';
const cols: readonly (readonly [Key, string][])[] = [
  [
    ['code', 'کد'],
    ['salutation', 'عنوان'],
    ['firstName', 'نام'],
    ['lastName', 'نام خانوادگی'],
    ['firstNameSecond', 'نام به زبان دوم'],
    ['lastNameSecond', 'نام خانوادگی به زبان دوم'],
    ['alias', 'نام مستعار'],
    ['nationalId', 'کد/شناسه ملی'],
    ['economicCode', 'کد اقتصادی'],
    ['foreignCode', 'کد فراگیر'],
  ],
  [
    ['gender', 'جنسیت'],
    ['vatExpiry', 'تاریخ اعتبار گواهی ارزش افزوده'],
    ['group', 'گروه'],
    ['nationality', 'ملیت'],
    ['citizenship', 'تابعیت'],
    ['religion', 'دین'],
    ['denomination', 'مذهب'],
    ['education', 'تحصیلات'],
    ['mobile', 'تلفن همراه'],
    ['telephone', 'تلفن'],
  ],
  [
    ['email', 'پست الکترونیک'],
    ['marital', 'وضعیت تأهل'],
    ['marriageDate', 'تاریخ ازدواج'],
    ['identityNumber', 'شماره شناسنامه'],
    ['identitySerial', 'سریال شناسنامه'],
    ['fatherName', 'نام پدر'],
    ['birthPlace', 'محل تولد'],
    ['birthDate', 'تاریخ تولد'],
    ['issueDate', 'تاریخ صدور'],
    ['issuePlace', 'محل صدور'],
  ],
];
const options: Partial<Record<Key, readonly string[]>> = {
  salutation: personTitles,
  religion: personReligions,
  education: personEducation,
  denomination: ['شیعه', 'سنی'],
  marital: personMarital,
  gender: ['M', 'F'],
};
const required = new Set<Key>(['code', 'firstName', 'lastName', 'gender']);
export function LedgerPersonDialog({
  initial,
  book,
  onClose,
  onSelected,
}: {
  initial?: LedgerPersonView | undefined;
  book: AccountingSnapshotV1;
  onClose: () => void;
  onSelected: (row: { id: string; displayName: string }) => void;
}) {
  const [draft, setDraft] = useState<LedgerPersonView>(
    () =>
      initial ?? {
        id: '',
        version: 0,
        code: '',
        firstName: '',
        lastName: '',
        gender: '',
        nationalId: '',
        birthDate: '',
        fields: {},
        notes: [],
        addresses: [],
        taxRows: [],
      },
  );
  const [tab, setTab] = useState<number>(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const saving = useRef(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving.current) return;
    setError('');
    if (
      !draft.code.trim() ||
      !draft.firstName.trim() ||
      !draft.lastName.trim() ||
      !draft.gender
    ) {
      setTab(0);
      setError('کد، نام، نام خانوادگی و جنسیت را وارد کنید.');
      return;
    }
    if (
      draft.addresses.some(
        (a) => !a.title.trim() || !a.region.trim() || !a.address.trim(),
      )
    ) {
      setTab(0);
      setError('عنوان، منطقه جغرافیایی و آدرس هر نشانی را تکمیل کنید.');
      return;
    }
    const stay =
      (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') ===
      'stay';
    const { id, version, ...input } = draft;
    saving.current = true;
    setBusy(true);
    try {
      const { data } = await customersApi.saveLedgerPerson(
        { ...input, gender: draft.gender, ...(id ? { version } : {}) },
        book.book.branchId,
        id || undefined,
      );
      if (stay) {
        setDraft((old) => ({
          ...old,
          id: data.id,
          version: data.version,
          notes: data.notes,
        }));
      } else onSelected(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره شخص ناموفق بود.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function field(key: Key, label: string) {
    const base =
      key === 'code' ||
      key === 'firstName' ||
      key === 'lastName' ||
      key === 'gender' ||
      key === 'birthDate' ||
      key === 'nationalId';
    const val = (base ? draft[key] : draft.fields[key]) ?? '';
    const change = (v: string) =>
      setDraft((old) =>
        base
          ? { ...old, [key]: v }
          : { ...old, fields: { ...old.fields, [key]: v } },
      );
    const select = options[key],
      id = 'ledger-person-' + key;
    return (
      <div key={key} className={styles.field}>
        <label htmlFor={id}>
          {label}
          {required.has(key) && <b aria-hidden="true"> *</b>}
        </label>
        {select ? (
          <select
            id={id}
            value={val}
            onChange={(e) => change(e.target.value)}
            required={required.has(key)}
          >
            <option value="" />
            {select.map((o) => (
              <option key={o} value={o}>
                {key === 'gender' ? (o === 'M' ? 'مذکر' : 'مؤنث') : o}
              </option>
            ))}
          </select>
        ) : ['birthDate', 'marriageDate', 'issueDate', 'vatExpiry'].includes(
            key,
          ) ? (
          <DatePicker
            id={id}
            aria-label={label}
            withinDialog
            value={val}
            onChange={change}
          />
        ) : key === 'birthPlace' || key === 'issuePlace' ? (
          <PersonPlace label={label} value={val} onChange={change} />
        ) : (
          <input
            id={id}
            value={val}
            type={key === 'email' || key === 'workflowEmail' ? 'email' : 'text'}
            required={required.has(key)}
            inputMode={
              key === 'code' || key === 'nationalId' ? 'numeric' : undefined
            }
            maxLength={
              key === 'code'
                ? 20
                : key === 'nationalId'
                  ? 10
                  : key === 'firstName' || key === 'lastName'
                    ? 120
                    : 200
            }
            dir={
              [
                'code',
                'nationalId',
                'telephone',
                'mobile',
                'email',
                'workflowEmail',
              ].includes(key)
                ? 'ltr'
                : undefined
            }
            onChange={(e) =>
              change(
                key === 'code' || key === 'nationalId'
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
        aria-describedby={undefined}
        className={styles.dialog}
        dir="rtl"
      >
        <DialogTitle>{draft.id ? 'ویرایش شخص' : 'ایجاد شخص'}</DialogTitle>
        <form onSubmit={save}>
          <div className={styles.tabs} role="tablist">
            {tabs.map((name, i) => (
              <button
                type="button"
                role="tab"
                aria-selected={i === tab}
                key={name}
                onClick={() => setTab(i)}
              >
                {name}
              </button>
            ))}
          </div>
          <fieldset disabled={busy} className={styles.panel} role="tabpanel">
            {tab === 0 && (
              <>
                <fieldset>
                  <legend>شخص</legend>
                  <div className={styles.columns}>
                    {cols.map((col) => (
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
                        entityType: 'AccountingPerson',
                        title: draft.firstName + ' ' + draft.lastName,
                      }
                    : undefined
                }
                notes={draft.notes}
                onChange={(notes) => setDraft((old) => ({ ...old, notes }))}
              />
            )}
            {tab === 3 && (
              <LedgerPartyTax
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
            <button disabled={busy} type="submit" value="select">
              ذخیره و انتخاب
            </button>
            <button disabled={busy} type="submit" value="stay">
              ذخیره
            </button>
            <button disabled={busy} type="button" onClick={onClose}>
              بستن
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
