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
import { CompanyBankAccounts } from './company-bank-accounts';
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
    [busy, setBusy] = useState(false),
    [bank, setBank] = useState(p.initial?.bankId ?? ''),
    [search, setSearch] = useState('');
  const [notes, setNotes] = useState(() =>
    parseSetupNotes(p.initial?.attributes.notes),
  );
  const [newBankType, setNewBankType] = useState(false),
    [bankTypeCode, setBankTypeCode] = useState(''),
    [bankTypeTitle, setBankTypeTitle] = useState('');
  const saving = useRef(false),
    label = accountingDetailOwners.find((x) => x.kind === p.kind)!.title;
  const cash = p.kind === 'CASH' || p.kind === 'PETTY_CASH';
  const banks = useQuery({
    queryKey: ['detail-owner-banks', search],
    enabled: p.kind === 'BANK',
    queryFn: () =>
      masterDataApi.list(
        'banks',
        {
          search,
          status: 'active',
          sortBy: 'name',
          sortDirection: 'asc',
          page: 1,
          pageSize: 100,
        },
        'accounting',
      ),
  });
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
        {p.kind === 'BANK' ? (
          <div className="space-y-4">
            <p>
              برای انتخاب حساب، دفتر، نوع حساب و شعبهٔ بانک را در فرم حساب بانکی
              ثبت کنید.
            </p>
            {error && <p role="alert">{error}</p>}
            <label>
              جستجوی بانک
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              بانک
              <select value={bank} onChange={(e) => setBank(e.target.value)}>
                <option value="">انتخاب بانک</option>
                {banks.data?.data.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            {banks.error && <p role="alert">{banks.error.message}</p>}
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewBankType((v) => !v)}
            >
              تعریف نوع حساب بانکی
            </Button>
            {newBankType && (
              <form
                className="grid gap-3 border p-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (saving.current) return;
                  saving.current = true;
                  setBusy(true);
                  try {
                    const saved = await p.run('save-configuration', {
                      kind: 'bank-account-types',
                      code: bankTypeCode,
                      title: bankTypeTitle,
                      active: true,
                      attributes: {},
                    });
                    if (saved) {
                      setNewBankType(false);
                      setBankTypeCode('');
                      setBankTypeTitle('');
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
                <label>
                  کد نوع حساب
                  <Input
                    required
                    maxLength={40}
                    value={bankTypeCode}
                    onChange={(e) => setBankTypeCode(e.target.value)}
                  />
                </label>
                <label>
                  عنوان نوع حساب
                  <Input
                    required
                    maxLength={160}
                    value={bankTypeTitle}
                    onChange={(e) => setBankTypeTitle(e.target.value)}
                  />
                </label>
                <Button type="submit" disabled={busy}>
                  ذخیره نوع حساب
                </Button>
              </form>
            )}
            {bank && (
              <CompanyBankAccounts
                bankId={bank}
                initialAccountId={p.initial?.id}
                companyBranchId={p.book.book.branchId}
                treasury={{
                  bookId: p.book.book.id,
                  types: p.book.configurations.filter(
                    (t) => t.kind === 'bank-account-types',
                  ),
                }}
                onSelected={(row) =>
                  p.onSelected({
                    id: row.id,
                    kind: p.kind,
                    code: row.accountingCode ?? '',
                    title: row.title ?? '',
                    titleEn: '',
                    active: row.isActive,
                    version: row.version,
                    currency: row.currencyCode,
                    configurationId: null,
                    accountId: row.id,
                    bankId: bank,
                    attributes: {},
                  })
                }
              />
            )}
          </div>
        ) : (
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
        )}
      </DialogContent>
    </Dialog>
  );
}
