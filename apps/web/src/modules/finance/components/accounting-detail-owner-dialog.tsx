'use client';
import {
  AccountingSetupNotes,
  parseSetupNotes,
} from './accounting-setup-notes';
import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  accountingDetailOwners,
  type AccountingDetailOwnerV1,
  type AccountingDetailOwnerKind,
  type AccountingSnapshotV1,
} from '@nora/contracts';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { Input, Textarea, FormField } from '@/components/ui/form-controls';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { AccountingBankAccountDialog } from './accounting-bank-account-dialog';
import { masterDataApi } from '@/modules/master-data/api/client';
import type { PersistedEditorRun } from './accounting-persisted-editor';
type Props = {
  kind: AccountingDetailOwnerKind;
  book: AccountingSnapshotV1;
  initial?: AccountingDetailOwnerV1 | undefined;
  run: PersistedEditorRun;
  onSelected: (row: AccountingDetailOwnerV1) => void;
  onClose: () => void;
};
export function AccountingDetailOwnerDialog(p: Props) {
  return p.kind === 'BANK' ? (
    <AccountingBankAccountDialog {...p} />
  ) : p.kind === 'STAFF' ? (
    <StaffDetailOwnerDialog {...p} />
  ) : (
    <StandardDetailOwnerDialog {...p} />
  );
}

function StaffDetailOwnerDialog({ initial, run, onClose, onSelected }: Props) {
  const [kind, setKind] = useState<'person' | 'site'>(
    initial?.attributes.staffKind === 'site' ? 'site' : 'person',
  );
  const [firstName, setFirstName] = useState(
    String(initial?.attributes.firstName ?? ''),
  );
  const [lastName, setLastName] = useState(
    String(initial?.attributes.lastName ?? ''),
  );
  const [position, setPosition] = useState(
    initial?.attributes.staffKind === 'person'
      ? String(initial.attributes.position ?? '')
      : '',
  );
  const [code, setCode] = useState(initial?.code ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const isSite = kind === 'site';

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <DialogContent dir="rtl">
        <DialogTitle>{initial ? 'ویرایش پرسنل' : 'افزودن پرسنل'}</DialogTitle>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending.current) return;
            pending.current = true;
            setBusy(true);
            setError('');
            try {
              const row = await run<AccountingDetailOwnerV1>(
                'save-detail-owner',
                {
                  id: initial?.id,
                  ownerKind: 'STAFF',
                  code,
                  attributes: {
                    staffKind: kind,
                    firstName,
                    lastName,
                    position,
                  },
                },
                initial?.version,
              );
              if (row) onSelected(row);
              else setError('ذخیره عنوان ناموفق بود.');
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'ذخیره عنوان ناموفق بود.',
              );
            } finally {
              pending.current = false;
              setBusy(false);
            }
          }}
        >
          <fieldset className="flex gap-4" disabled={busy}>
            <legend className="mb-2 text-sm font-medium">نوع عنوان</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="staff-kind"
                checked={!isSite}
                onChange={() => setKind('person')}
              />
              شخص
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="staff-kind"
                checked={isSite}
                onChange={() => setKind('site')}
              />
              سایت
            </label>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="نام" id="staff-name" required>
              <Input
                id="staff-name"
                required
                maxLength={isSite ? 160 : 79}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </FormField>
            {!isSite && (
              <FormField label="نام خانوادگی" id="staff-last-name" required>
                <Input
                  id="staff-last-name"
                  required
                  maxLength={80}
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </FormField>
            )}
            <FormField label="سمت" id="staff-position" required={!isSite}>
              <Input
                id="staff-position"
                required={!isSite}
                maxLength={120}
                readOnly={isSite}
                className={
                  isSite ? 'bg-muted text-muted-foreground' : undefined
                }
                value={isSite ? 'سایت' : position}
                onChange={(event) => setPosition(event.target.value)}
              />
            </FormField>
            <FormField label="کد" id="staff-code" required>
              <Input
                id="staff-code"
                required
                maxLength={40}
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </FormField>
          </div>
          {error && <p role="alert">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={busy}>
              ذخیره و انتخاب
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              انصراف
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StandardDetailOwnerDialog(p: Props) {
  const [code, setCode] = useState(p.initial?.code ?? ''),
    [title, setTitle] = useState(p.initial?.title ?? ''),
    [titleEn, setTitleEn] = useState(p.initial?.titleEn ?? ''),
    [active, setActive] = useState(p.initial?.active ?? true),
    [currency, setCurrency] = useState(
      p.initial?.currency ?? p.book.book.baseCurrency,
    ),
    [attributes, setAttributes] = useState<Record<string, unknown>>(
      p.initial?.attributes ?? {},
    ),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(() =>
    parseSetupNotes(p.initial?.attributes.notes),
  );
  const saving = useRef(false),
    label = accountingDetailOwners.find((x) => x.kind === p.kind)!.title;
  const cash = p.kind === 'CASH' || p.kind === 'PETTY_CASH';
  const currencies = useQuery({
    queryKey: ['accounting', 'currencies'],
    enabled: cash,
    queryFn: () =>
      masterDataApi.list(
        'currencies',
        {
          search: '',
          status: 'active',
          sortBy: 'name',
          sortDirection: 'asc',
          page: 1,
          pageSize: 100,
        },
        'accounting',
      ),
  });
  const input = (key: string, text: string, required = false) => (
    <FormField key={key} label={text} required={required}>
      <Input
        aria-label={text}
        required={required}
        value={String(attributes[key] ?? '')}
        onChange={(e) =>
          setAttributes((old) => ({ ...old, [key]: e.target.value }))
        }
      />
    </FormField>
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) p.onClose();
      }}
    >
      <DialogContent
        dir="rtl"
        aria-describedby={undefined}
        className="max-h-[90vh] max-w-5xl overflow-auto"
      >
        <DialogTitle>
          {p.initial ? 'ویرایش' : 'ایجاد'} {label}
        </DialogTitle>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (saving.current) return;
            saving.current = true;
            setBusy(true);
            setError('');
            try {
              const row = await p.run<AccountingDetailOwnerV1>(
                'save-detail-owner',
                {
                  id: p.initial?.id,
                  ownerKind: p.kind,
                  code,
                  title,
                  titleEn,
                  description: String(attributes.description ?? ''),
                  active,
                  currency,
                  attributes:
                    p.kind === 'FISCAL_YEAR'
                      ? { ...attributes, notes: JSON.stringify(notes) }
                      : attributes,
                },
                p.initial?.version,
              );
              if (row) {
                if (row.active) p.onSelected(row);
                else p.onClose();
              }
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'ذخیره عنوان ناموفق بود.',
              );
            } finally {
              saving.current = false;
              setBusy(false);
            }
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="کد" required>
              <Input
                aria-label="کد مرجع"
                dir="ltr"
                required
                maxLength={40}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </FormField>
            <FormField label="عنوان" required>
              <Input
                aria-label="عنوان مرجع"
                required
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </FormField>
            {p.kind !== 'PROJECT' && (
              <FormField label="عنوان به زبان دوم">
                <Input
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                />
              </FormField>
            )}
            {p.kind === 'BRANCH' && (
              <>
                <FormField label="نام بنگاه">
                  <Input readOnly disabled value={p.book.book.title} />
                </FormField>
                <label>
                  <input
                    type="checkbox"
                    checked={attributes.isMain === true}
                    onChange={(e) =>
                      setAttributes((a) => ({
                        ...a,
                        isMain: e.target.checked,
                      }))
                    }
                  />{' '}
                  شعبه اصلی
                </label>
              </>
            )}
            {p.kind === 'COST_CENTER' &&
              input('centerType', 'نوع مرکز هزینه', true)}
            {p.kind === 'FUND' && (
              <>
                {input('fundType', 'نوع منبع', true)}
                {input('fundClass', 'وضعیت منبع', true)}
                {input('creditClass', 'طبقه اعتبار', true)}
              </>
            )}
            {cash && (
              <>
                <FormField
                  label={p.kind === 'CASH' ? 'مسئول صندوق' : 'تنخواه‌دار'}
                  required
                >
                  <select
                    aria-label="مسئول"
                    required
                    value={String(attributes.operatorId ?? '')}
                    onChange={(e) =>
                      setAttributes((a) => ({
                        ...a,
                        operatorId: e.target.value,
                      }))
                    }
                  >
                    <option value="">انتخاب شخص</option>
                    {p.book.details
                      .filter(
                        (d) =>
                          d.active &&
                          p.book.configurations.some(
                            (t) => t.id === d.typeId && t.title === 'شخص',
                          ),
                      )
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title}
                        </option>
                      ))}
                  </select>
                </FormField>
                <FormField label="ارز" required>
                  <select
                    required
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {currencies.data?.data.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                {input('location', 'محل استقرار')}
                {input('description', 'شرح')}
                {input('descriptionEn', 'شرح به زبان دوم')}
                {p.kind === 'PETTY_CASH' && (
                  <>
                    <FormField label="تاریخ استقرار">
                      <DatePicker
                        value={String(attributes.deploymentDate ?? '')}
                        onChange={(value) =>
                          setAttributes((a) => ({
                            ...a,
                            deploymentDate: value,
                          }))
                        }
                      />
                    </FormField>
                    {input('initialCash', 'موجودی اولیه')}
                    {input('operationalInitialCash', 'موجودی به ارز عملیاتی')}
                    {input('maximumCash', 'سقف موجودی')}
                    <p>
                      اطلاعات موجودی اولیه برای معرفی تنخواه است؛ ثبت مانده در
                      دفتر کل به سند افتتاحیه نیاز دارد.
                    </p>
                  </>
                )}

                {currencies.error && (
                  <p role="alert">{currencies.error.message}</p>
                )}
              </>
            )}
            <label>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />{' '}
              فعال
            </label>
          </div>
          {p.kind === 'FISCAL_YEAR' ? (
            <AccountingSetupNotes
              notes={notes}
              onChange={setNotes}
              book={p.book}
            />
          ) : (
            <FormField label="یادداشت">
              <Textarea
                maxLength={2000}
                value={String(attributes.notes ?? '')}
                onChange={(e) =>
                  setAttributes((a) => ({ ...a, notes: e.target.value }))
                }
              />
            </FormField>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={busy}>
              ذخیره و انتخاب
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={p.onClose}
            >
              انصراف
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
