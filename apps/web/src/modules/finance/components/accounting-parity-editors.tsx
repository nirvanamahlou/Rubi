'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  AccountingAccountGroupV1,
  AccountingDetailGroupV1,
  AccountingSnapshotV1,
  AccountingTemplateLineV1,
  AccountingTemplateV1,
} from '@nora/contracts';

import { Button } from '@/components/ui/button';
import { Input, Textarea, FormField } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { accountingApi } from '../api/accounting-api';
import { submitPersistedEditor } from './accounting-persisted-editor';

type Run = <T = unknown>(
  action: string,
  payload: Record<string, unknown>,
  version?: number,
) => Promise<T | undefined>;

const label = (record: { code: string; title: string }) =>
  `${record.code} — ${record.title}`;

export function AccountingChartEditor({
  book,
  run,
  busy,
}: {
  book: AccountingSnapshotV1;
  run: Run;
  busy: boolean;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const selected = book.accounts.find((account) => account.id === selectedId);
  const reset = (level: 'GROUP' | 'GENERAL' | 'SUBSIDIARY') => {
    const parentId =
      level === 'GROUP'
        ? ''
        : selected &&
            (level === 'GENERAL'
              ? selected.level === 'GROUP'
              : selected.level === 'GENERAL')
          ? selected.id
          : '';
    setSelectedId('');
    setDraft({
      level,
      parentId,
      active: true,
      permanent: true,
      nature: 'DEBIT',
    });
  };
  const open = (id: string) => {
    const account = book.accounts.find((item) => item.id === id);
    if (!account) return;
    setSelectedId(id);
    setDraft({
      code: account.code,
      title: account.title,
      titleEn: account.titleEn ?? '',
      level: account.level,
      parentId: account.parentId ?? '',
      nature: account.nature,
      permanent: account.permanent,
      active: account.active,
      ...account.attributes,
    });
  };
  const visible = useMemo(() => {
    const term = search.trim();
    return term
      ? book.accounts.filter((account) =>
          `${account.code} ${account.title} ${account.level}`.includes(term),
        )
      : book.accounts;
  }, [book.accounts, search]);
  const tree = (parentId: string | null, depth = 0): ReactNode =>
    visible
      .filter((account) => account.parentId === parentId)
      .map((account) => (
        <li key={account.id}>
          <button
            className={`w-full rounded-lg px-3 py-2 text-start text-sm ${selectedId === account.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
            onClick={() => open(account.id)}
            style={{ paddingInlineStart: `${12 + depth * 16}px` }}
            type="button"
          >
            {label(account)} ·{' '}
            {account.level === 'GROUP'
              ? 'گروه'
              : account.level === 'GENERAL'
                ? 'کل'
                : 'معین'}
          </button>
          <ul>{tree(account.id, depth + 1)}</ul>
        </li>
      ));
  const attributes = Object.fromEntries(
    [
      'natureControl',
      'traceable',
      'multiCurrency',
      'revaluable',
      'zeroBalanceAtClose',
      'detail4Required',
      'detail4TypeId',
      'detail5Required',
      'detail5TypeId',
      'detail6Required',
      'detail6TypeId',
    ].map((key) => [
      key,
      draft[key] ?? (key.endsWith('Required') ? false : ''),
    ]),
  );
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-black">تعریف ساختار حساب‌ها</h2>
        <p className="text-sm text-muted-foreground">
          ساختار درختی و انتخاب سطح از صفحه منبع مشاهده شده است. قواعد کنترلی
          زیر، قابلیت‌های عملیاتی روبی هستند.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => reset('GROUP')}>گروه حساب جدید</Button>
        <Button variant="outline" onClick={() => reset('GENERAL')}>
          حساب کل جدید
        </Button>
        <Button variant="outline" onClick={() => reset('SUBSIDIARY')}>
          حساب معین جدید
        </Button>
        <Button variant="outline" disabled>
          حذف — پشتیبانی نمی‌شود
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <aside className="space-y-3 rounded-xl border p-3">
          <FormField id="coa-search" label="جست‌وجوی کد، عنوان یا نوع">
            <Input
              id="coa-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </FormField>
          <ul className="max-h-[34rem] overflow-auto">{tree(null)}</ul>
        </aside>
        <form
          className="space-y-4 rounded-xl border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              'save-account',
              {
                ...draft,
                ...(selected ? { id: selected.id } : {}),
                attributes,
              },
              selected?.version,
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="coa-code" label="کد">
              <Input
                id="coa-code"
                value={String(draft.code ?? '')}
                onChange={(e) =>
                  setDraft((value) => ({ ...value, code: e.target.value }))
                }
              />
            </FormField>
            <FormField id="coa-title" label="عنوان">
              <Input
                id="coa-title"
                value={String(draft.title ?? '')}
                onChange={(e) =>
                  setDraft((value) => ({ ...value, title: e.target.value }))
                }
              />
            </FormField>
            <FormField id="coa-title-en" label="عنوان به زبان دوم">
              <Input
                id="coa-title-en"
                value={String(draft.titleEn ?? '')}
                onChange={(e) =>
                  setDraft((value) => ({ ...value, titleEn: e.target.value }))
                }
              />
            </FormField>
            <FormField id="coa-level" label="نوع">
              <SearchCombobox
                id="coa-level"
                label="نوع"
                value={String(draft.level ?? '')}
                onValueChange={(level) =>
                  setDraft((value) => ({ ...value, level }))
                }
                options={[
                  { value: 'GROUP', label: 'گروه حساب' },
                  { value: 'GENERAL', label: 'حساب کل' },
                  { value: 'SUBSIDIARY', label: 'حساب معین' },
                ]}
              />
            </FormField>
            <FormField id="coa-parent" label="حساب والد">
              <SearchCombobox
                id="coa-parent"
                label="حساب والد"
                value={String(draft.parentId ?? '')}
                onValueChange={(parentId) =>
                  setDraft((value) => ({ ...value, parentId }))
                }
                options={book.accounts
                  .filter((account) => account.level !== 'SUBSIDIARY')
                  .map((account) => ({
                    value: account.id,
                    label: label(account),
                  }))}
              />
            </FormField>
            <FormField id="coa-nature" label="ماهیت">
              <SearchCombobox
                id="coa-nature"
                label="ماهیت"
                value={String(draft.nature ?? '')}
                onValueChange={(nature) =>
                  setDraft((value) => ({ ...value, nature }))
                }
                options={[
                  { value: 'DEBIT', label: 'بدهکار' },
                  { value: 'CREDIT', label: 'بستانکار' },
                ]}
              />
            </FormField>
          </div>
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-bold">
              تنظیمات عملیاتی روبی
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(
                [
                  'permanent',
                  'active',
                  'traceable',
                  'multiCurrency',
                  'revaluable',
                  'zeroBalanceAtClose',
                ] as const
              ).map((key) => (
                <label className="flex items-center gap-2 text-sm" key={key}>
                  <input
                    type="checkbox"
                    checked={draft[key] === true}
                    onChange={(e) =>
                      setDraft((value) => ({
                        ...value,
                        [key]: e.target.checked,
                      }))
                    }
                  />
                  {
                    {
                      permanent: 'دائمی',
                      active: 'فعال',
                      traceable: 'دارای پیگیری',
                      multiCurrency: 'ارزی',
                      revaluable: 'تسعیرپذیر',
                      zeroBalanceAtClose: 'مانده صفر در پایان دوره',
                    }[key]
                  }
                </label>
              ))}
              {[4, 5, 6].map((level) => (
                <div className="rounded-lg border p-3" key={level}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft[`detail${level}Required`] === true}
                      onChange={(e) =>
                        setDraft((value) => ({
                          ...value,
                          [`detail${level}Required`]: e.target.checked,
                        }))
                      }
                    />
                    تفصیلی سطح {level} اجباری
                  </label>
                  <SearchCombobox
                    label={`نوع تفصیلی سطح ${level}`}
                    value={String(draft[`detail${level}TypeId`] ?? '')}
                    onValueChange={(id) =>
                      setDraft((value) => ({
                        ...value,
                        [`detail${level}TypeId`]: id,
                      }))
                    }
                    options={book.configurations
                      .filter((item) => item.kind === 'detail-types')
                      .map((item) => ({ value: item.id, label: label(item) }))}
                  />
                </div>
              ))}
            </div>
          </details>
          <Button
            permission="finance.account.manage"
            disabled={busy}
            type="submit"
          >
            ذخیره
          </Button>
        </form>
      </div>
    </section>
  );
}

export function AccountingGroupingEditor({
  book,
  run,
  busy,
  kind,
}: {
  book: AccountingSnapshotV1;
  run: Run;
  busy: boolean;
  kind: 'account' | 'detail';
}) {
  type Group = AccountingAccountGroupV1 | AccountingDetailGroupV1;
  const groups: Group[] =
    kind === 'account' ? book.accountGroups : book.detailGroups;
  const candidates = kind === 'account' ? book.accounts : book.details;
  const [selected, setSelected] = useState<Group | null>(null);
  const [draft, setDraft] = useState({
    code: '',
    title: '',
    titleEn: '',
    description: '',
    active: true,
  });
  const [members, setMembers] = useState<string[]>([]);
  const open = (group: Group) => {
    setSelected(group);
    setDraft({
      code: group.code,
      title: group.title,
      titleEn: group.titleEn ?? '',
      description: group.description ?? '',
      active: group.active,
    });
    setMembers(
      kind === 'account'
        ? (group as AccountingAccountGroupV1).members.map(
            (item) => item.accountId,
          )
        : (group as AccountingDetailGroupV1).members.map(
            (item) => item.detailId,
          ),
    );
  };
  const fresh = () => {
    setSelected(null);
    setDraft({
      code: '',
      title: '',
      titleEn: '',
      description: '',
      active: true,
    });
    setMembers([]);
  };
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-black">
        {kind === 'account' ? 'گروهبندی حساب‌ها' : 'گروهبندی حساب تفصیلی'}
      </h2>
      <div className="flex gap-2">
        <Button onClick={fresh}>گروه جدید</Button>
        <Button variant="outline" disabled>
          حذف — پشتیبانی نمی‌شود
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <aside className="rounded-xl border p-3">
          <p className="mb-2 font-bold">درخت گروه‌ها</p>
          {groups.map((group) => (
            <button
              className={`block w-full rounded-lg px-3 py-2 text-start ${selected?.id === group.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
              key={group.id}
              onClick={() => open(group)}
              type="button"
            >
              {label(group)}
            </button>
          ))}
        </aside>
        <form
          className="space-y-4 rounded-xl border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitPersistedEditor(
              run,
              kind === 'account' ? 'save-account-group' : 'save-detail-group',
              {
                ...draft,
                memberIds: members,
              },
              selected,
              open,
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="group-code" label="کد">
              <Input
                id="group-code"
                value={draft.code}
                onChange={(e) =>
                  setDraft((value) => ({ ...value, code: e.target.value }))
                }
              />
            </FormField>
            <FormField id="group-title" label="عنوان">
              <Input
                id="group-title"
                value={draft.title}
                onChange={(e) =>
                  setDraft((value) => ({ ...value, title: e.target.value }))
                }
              />
            </FormField>
            <FormField id="group-title-en" label="عنوان به زبان دوم">
              <Input
                id="group-title-en"
                value={draft.titleEn}
                onChange={(e) =>
                  setDraft((value) => ({ ...value, titleEn: e.target.value }))
                }
              />
            </FormField>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) =>
                  setDraft((value) => ({ ...value, active: e.target.checked }))
                }
              />
              فعال
            </label>
          </div>
          <FormField id="group-description" label="یادداشت">
            <Textarea
              id="group-description"
              value={draft.description}
              onChange={(e) =>
                setDraft((value) => ({ ...value, description: e.target.value }))
              }
            />
          </FormField>
          <fieldset className="max-h-72 overflow-auto rounded-xl border p-3">
            <legend className="px-2 font-bold">اعضای گروه</legend>
            {candidates.map((candidate) => (
              <label
                className="flex items-center gap-2 py-1 text-sm"
                key={candidate.id}
              >
                <input
                  type="checkbox"
                  checked={members.includes(candidate.id)}
                  onChange={(e) =>
                    setMembers((current) =>
                      e.target.checked
                        ? [...current, candidate.id]
                        : current.filter((id) => id !== candidate.id),
                    )
                  }
                />
                {label(candidate)}
              </label>
            ))}
          </fieldset>
          <Button
            permission="finance.account.manage"
            disabled={busy}
            type="submit"
          >
            ذخیره
          </Button>
        </form>
      </div>
    </section>
  );
}

export function AccountingTemplateEditor({
  book,
  run,
  busy,
  kind,
  readOnly = false,
}: {
  book: AccountingSnapshotV1;
  run: Run;
  busy: boolean;
  kind: AccountingTemplateV1['kind'];
  readOnly?: boolean;
}) {
  const rows = book.templates.filter((template) => template.kind === kind);
  const [selected, setSelected] = useState<AccountingTemplateV1 | null>(null);
  const [draft, setDraft] = useState<Record<string, string | boolean>>({
    active: true,
  });
  const [lines, setLines] = useState<
    Omit<AccountingTemplateLineV1, 'id' | 'position'>[]
  >([]);
  const open = (template: AccountingTemplateV1) => {
    setSelected(template);
    setDraft({
      code: template.code,
      title: template.title,
      titleEn: template.titleEn ?? '',
      description: template.description ?? '',
      descriptionEn: template.descriptionEn ?? '',
      active: template.active,
      voucherTypeId: template.voucherTypeId ?? '',
      gainAccountId: template.gainAccountId ?? '',
      lossAccountId: template.lossAccountId ?? '',
      retainedAccountId: template.retainedAccountId ?? '',
    });
    setLines(
      template.lines.map((line) => ({
        accountId: line.accountId,
        detail4Id: line.detail4Id,
        detail5Id: line.detail5Id,
        detail6Id: line.detail6Id,
        side: line.side,
        percentage: line.percentage,
        include: line.include,
      })),
    );
  };
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-black">
        {kind === 'AUTOMATIC'
          ? 'الگوی سند اتوماتیک'
          : kind === 'REVALUATION'
            ? 'الگوی تسعیر ارز'
            : 'الگوی بستن حساب'}
      </h2>
      {kind === 'AUTOMATIC' ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          تعریف الگو پایدار است؛ اجرای خودکار تا مشخص‌شدن قرارداد محاسبه فعال
          نیست.
        </p>
      ) : null}
      {!readOnly ? (
        <form
          className="space-y-4 rounded-xl border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitPersistedEditor(
              run,
              'save-template',
              {
                ...draft,
                kind,
                lines,
              },
              selected,
              open,
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {(['code', 'title', 'titleEn'] as const).map((key) => (
              <FormField
                id={`template-${key}`}
                label={
                  { code: 'کد', title: 'عنوان', titleEn: 'عنوان به زبان دوم' }[
                    key
                  ]
                }
                key={key}
              >
                <Input
                  id={`template-${key}`}
                  value={String(draft[key] ?? '')}
                  onChange={(e) =>
                    setDraft((value) => ({ ...value, [key]: e.target.value }))
                  }
                />
              </FormField>
            ))}
            <FormField id="template-type" label="نوع سند">
              <SearchCombobox
                id="template-type"
                label="نوع سند"
                value={String(draft.voucherTypeId ?? '')}
                onValueChange={(voucherTypeId) =>
                  setDraft((value) => ({ ...value, voucherTypeId }))
                }
                options={book.configurations
                  .filter((item) => item.kind === 'voucher-types')
                  .map((item) => ({ value: item.id, label: label(item) }))}
              />
            </FormField>
            {kind === 'REVALUATION' ? (
              <>
                <FormField id="template-gain" label="حساب سود تسعیر">
                  <SearchCombobox
                    id="template-gain"
                    label="حساب سود تسعیر"
                    value={String(draft.gainAccountId ?? '')}
                    onValueChange={(gainAccountId) =>
                      setDraft((value) => ({ ...value, gainAccountId }))
                    }
                    options={book.accounts.map((item) => ({
                      value: item.id,
                      label: label(item),
                    }))}
                  />
                </FormField>
                <FormField id="template-loss" label="حساب زیان تسعیر">
                  <SearchCombobox
                    id="template-loss"
                    label="حساب زیان تسعیر"
                    value={String(draft.lossAccountId ?? '')}
                    onValueChange={(lossAccountId) =>
                      setDraft((value) => ({ ...value, lossAccountId }))
                    }
                    options={book.accounts.map((item) => ({
                      value: item.id,
                      label: label(item),
                    }))}
                  />
                </FormField>
              </>
            ) : null}
            {kind === 'CLOSING' ? (
              <FormField id="template-retained" label="حساب سود و زیان انباشته">
                <SearchCombobox
                  id="template-retained"
                  label="حساب سود و زیان انباشته"
                  value={String(draft.retainedAccountId ?? '')}
                  onValueChange={(retainedAccountId) =>
                    setDraft((value) => ({ ...value, retainedAccountId }))
                  }
                  options={book.accounts.map((item) => ({
                    value: item.id,
                    label: label(item),
                  }))}
                />
              </FormField>
            ) : null}
          </div>
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-bold">یادداشت‌ها</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <FormField id="template-description" label="یادداشت">
                <Textarea
                  id="template-description"
                  value={String(draft.description ?? '')}
                  onChange={(e) =>
                    setDraft((value) => ({
                      ...value,
                      description: e.target.value,
                    }))
                  }
                />
              </FormField>
              <FormField
                id="template-description-en"
                label="یادداشت به زبان دوم"
              >
                <Textarea
                  id="template-description-en"
                  value={String(draft.descriptionEn ?? '')}
                  onChange={(e) =>
                    setDraft((value) => ({
                      ...value,
                      descriptionEn: e.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
          </details>
          <fieldset className="space-y-3 rounded-xl border p-4">
            <legend className="px-2 font-bold">ردیف‌های الگو</legend>
            <p className="text-sm text-muted-foreground">
              حساب، سمت و درصد هر ردیف به‌صورت ساخت‌یافته ذخیره می‌شود.
            </p>
            <div className="space-y-3">
              {lines.map((line, index) => (
                <div
                  className="grid gap-3 rounded-xl bg-muted/30 p-3 md:grid-cols-6"
                  key={`${selected?.id ?? 'new'}-${index}`}
                >
                  <div className="md:col-span-2">
                    <FormField
                      id={`template-line-${index}-account`}
                      label="حساب"
                    >
                      <SearchCombobox
                        id={`template-line-${index}-account`}
                        label="حساب"
                        value={line.accountId}
                        onValueChange={(accountId) =>
                          setLines((current) =>
                            current.map((item, row) =>
                              row === index ? { ...item, accountId } : item,
                            ),
                          )
                        }
                        options={book.accounts
                          .filter((account) => account.active)
                          .map((account) => ({
                            value: account.id,
                            label: label(account),
                          }))}
                      />
                    </FormField>
                  </div>
                  <FormField id={`template-line-${index}-side`} label="سمت">
                    <select
                      id={`template-line-${index}-side`}
                      className="h-10 rounded-md border bg-background px-3"
                      value={line.side}
                      onChange={(event) =>
                        setLines((current) =>
                          current.map((item, row) =>
                            row === index
                              ? {
                                  ...item,
                                  side: event.target.value as
                                    'DEBIT' | 'CREDIT',
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="DEBIT">بدهکار</option>
                      <option value="CREDIT">بستانکار</option>
                    </select>
                  </FormField>
                  <FormField
                    id={`template-line-${index}-percentage`}
                    label="درصد"
                  >
                    <Input
                      id={`template-line-${index}-percentage`}
                      inputMode="decimal"
                      value={line.percentage}
                      onChange={(event) =>
                        setLines((current) =>
                          current.map((item, row) =>
                            row === index
                              ? { ...item, percentage: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </FormField>
                  <label className="flex items-center gap-2 self-end py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={line.include}
                      onChange={(event) =>
                        setLines((current) =>
                          current.map((item, row) =>
                            row === index
                              ? { ...item, include: event.target.checked }
                              : item,
                          ),
                        )
                      }
                    />
                    مشمول
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setLines((current) =>
                        current.filter((_item, row) => row !== index),
                      )
                    }
                  >
                    حذف ردیف
                  </Button>
                  {(['detail4Id', 'detail5Id', 'detail6Id'] as const).map(
                    (key, offset) => (
                      <div className="md:col-span-2" key={key}>
                        <FormField
                          id={`template-line-${index}-${key}`}
                          label={`تفصیلی ${offset + 4}`}
                        >
                          <SearchCombobox
                            id={`template-line-${index}-${key}`}
                            label={`تفصیلی ${offset + 4}`}
                            value={line[key] ?? ''}
                            onValueChange={(detailId) =>
                              setLines((current) =>
                                current.map((item, row) =>
                                  row === index
                                    ? { ...item, [key]: detailId || null }
                                    : item,
                                ),
                              )
                            }
                            options={book.details
                              .filter((detail) => detail.active)
                              .map((detail) => ({
                                value: detail.id,
                                label: label(detail),
                              }))}
                          />
                        </FormField>
                      </div>
                    ),
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  {
                    accountId: '',
                    detail4Id: null,
                    detail5Id: null,
                    detail6Id: null,
                    side: 'DEBIT',
                    percentage: '100',
                    include: true,
                  },
                ])
              }
            >
              افزودن ردیف
            </Button>
          </fieldset>
          <div className="flex gap-2">
            <Button
              permission="finance.account.manage"
              disabled={busy}
              type="submit"
            >
              ذخیره
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelected(null);
                setDraft({ active: true });
                setLines([]);
              }}
            >
              جدید
            </Button>
          </div>
        </form>
      ) : null}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-start">کد</th>
              <th className="p-3 text-start">عنوان</th>
              <th className="p-3 text-start">وضعیت</th>
              <th className="p-3 text-start">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((template) => (
              <tr key={template.id}>
                <td className="border-t p-3">{template.code}</td>
                <td className="border-t p-3">{template.title}</td>
                <td className="border-t p-3">
                  {template.active ? 'فعال' : 'غیرفعال'}
                </td>
                <td className="border-t p-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => open(template)}
                  >
                    بازکردن
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AccountingAnalyticalReport({
  book,
  kind,
}: {
  book: AccountingSnapshotV1;
  kind:
    | 'dormant'
    | 'nature-conflict-period'
    | 'nature-conflict-running'
    | 'comparative';
}) {
  const [query, setQuery] = useState<Record<string, string>>({
    periodId: book.periods[0]?.id ?? '',
    leftPeriodId: book.periods[0]?.id ?? '',
    rightPeriodId: book.periods[0]?.id ?? '',
    page: '1',
  });
  const [result, setResult] = useState<{
    definition?: string;
    page: number;
    pageSize: number;
    total: number;
    rows: Record<string, unknown>[];
  } | null>(null);
  const [failure, setFailure] = useState('');
  const set = (key: string, value: string) =>
    setQuery((current) => ({ ...current, [key]: value }));
  const periods = book.periods.map((period) => ({
    value: period.id,
    label: `${period.startDate} تا ${period.endDate}`,
  }));
  const run = async (nextQuery = query) => {
    setFailure('');
    try {
      setResult(await accountingApi.analytical(book.book.id, kind, nextQuery));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'گزارش اجرا نشد.');
    }
  };
  const comparative = kind === 'comparative';
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-black">
        {kind === 'dormant'
          ? 'گزارش حساب‌های راکد'
          : kind === 'nature-conflict-period'
            ? 'گزارش خلاف ماهیت برای یک دوره مالی'
            : kind === 'nature-conflict-running'
              ? 'حساب‌های خلاف ماهیت طی دوره'
              : 'گزارش مقایسه‌ای'}
      </h2>
      <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-3">
        {comparative ? (
          <>
            <FormField id="left-period" label="دوره ستون اول">
              <SearchCombobox
                id="left-period"
                label="دوره ستون اول"
                value={query.leftPeriodId ?? ''}
                onValueChange={(value) => set('leftPeriodId', value)}
                options={periods}
              />
            </FormField>
            <FormField id="left-from" label="از تاریخ ستون اول">
              <DatePicker
                id="left-from"
                value={query.leftFrom ?? ''}
                onChange={(value) => set('leftFrom', value)}
              />
            </FormField>
            <FormField id="left-to" label="تا تاریخ ستون اول">
              <DatePicker
                id="left-to"
                value={query.leftTo ?? ''}
                onChange={(value) => set('leftTo', value)}
              />
            </FormField>
            <FormField id="right-period" label="دوره ستون دوم">
              <SearchCombobox
                id="right-period"
                label="دوره ستون دوم"
                value={query.rightPeriodId ?? ''}
                onValueChange={(value) => set('rightPeriodId', value)}
                options={periods}
              />
            </FormField>
            <FormField id="right-from" label="از تاریخ ستون دوم">
              <DatePicker
                id="right-from"
                value={query.rightFrom ?? ''}
                onChange={(value) => set('rightFrom', value)}
              />
            </FormField>
            <FormField id="right-to" label="تا تاریخ ستون دوم">
              <DatePicker
                id="right-to"
                value={query.rightTo ?? ''}
                onChange={(value) => set('rightTo', value)}
              />
            </FormField>
          </>
        ) : (
          <>
            <FormField id="report-period" label="دوره مالی">
              <SearchCombobox
                id="report-period"
                label="دوره مالی"
                value={query.periodId ?? ''}
                onValueChange={(value) => set('periodId', value)}
                options={periods}
              />
            </FormField>
            <FormField id="report-from" label="از تاریخ">
              <DatePicker
                id="report-from"
                value={query.from ?? ''}
                onChange={(value) => set('from', value)}
              />
            </FormField>
            <FormField id="report-to" label="تا تاریخ">
              <DatePicker
                id="report-to"
                value={query.to ?? ''}
                onChange={(value) => set('to', value)}
              />
            </FormField>
          </>
        )}
        <FormField id="report-group" label="گروه حساب">
          <SearchCombobox
            id="report-group"
            label="گروه حساب"
            value={query.groupId ?? ''}
            onValueChange={(value) => set('groupId', value)}
            options={book.accountGroups.map((group) => ({
              value: group.id,
              label: label(group),
            }))}
          />
        </FormField>
        <Button onClick={() => void run()}>نمایش گزارش</Button>
      </div>
      {failure ? (
        <p role="alert" className="text-destructive">
          {failure}
        </p>
      ) : null}
      {result?.definition ? (
        <p className="rounded-xl bg-muted p-3 text-sm">
          تعریف محاسبه: {result.definition}
        </p>
      ) : null}
      {result ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              {result.total} ردیف · صفحه {result.page}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={result.page <= 1}
                onClick={() => {
                  const next = { ...query, page: String(result.page - 1) };
                  setQuery(next);
                  void run(next);
                }}
              >
                صفحه قبل
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={result.page * result.pageSize >= result.total}
                onClick={() => {
                  const next = { ...query, page: String(result.page + 1) };
                  setQuery(next);
                  void run(next);
                }}
              >
                صفحه بعد
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  {[
                    'کد',
                    'عنوان',
                    comparative ? 'مانده اول' : 'تاریخ اولین خلاف',
                    comparative ? 'مانده دوم' : 'مانده',
                    comparative ? 'اختلاف' : 'وضعیت',
                  ].map((heading) => (
                    <th className="p-3 text-start" key={heading}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, index) => {
                  const left = row.left as Record<string, unknown> | undefined,
                    right = row.right as Record<string, unknown> | undefined,
                    difference = row.difference as
                      Record<string, unknown> | undefined;
                  return (
                    <tr key={String(row.id ?? row.accountId ?? index)}>
                      <td className="border-t p-3">{String(row.code ?? '')}</td>
                      <td className="border-t p-3">
                        {String(row.title ?? '')}
                      </td>
                      <td className="border-t p-3">
                        {String(
                          comparative
                            ? (left?.balance ?? '0')
                            : (row.firstConflictDate ?? '—'),
                        )}
                      </td>
                      <td className="border-t p-3">
                        {String(
                          comparative
                            ? (right?.balance ?? '0')
                            : (row.balance ?? '—'),
                        )}
                      </td>
                      <td className="border-t p-3">
                        {String(
                          comparative
                            ? (difference?.balance ?? '0')
                            : row.active === false
                              ? 'غیرفعال'
                              : 'فعال',
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function AccountingMoveDrafts({
  book,
  run,
  busy,
}: {
  book: AccountingSnapshotV1;
  run: Run;
  busy: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [reason, setReason] = useState('');
  const journals = useQuery({
    queryKey: ['accounting', 'move-drafts', book.book.id],
    queryFn: () =>
      accountingApi.journals(book.book.id, { status: 'DRAFT', page: '1' }),
  });
  const eligible = (journals.data?.items ?? []).filter(
    (journal) =>
      journal.number === null &&
      !journal.sourceKey &&
      !journal.reversalOfId &&
      journal.attributes.operation === undefined &&
      journal.attributes.templateId === undefined &&
      journal.attributes.sourceRequestId === undefined,
  );
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-black">جابجایی اسناد</h2>
      <p className="text-sm text-muted-foreground">
        فقط پیش‌نویس عادی و بدون شماره جابه‌جا می‌شود. همه انتخاب‌ها در یک
        تراکنش کنترل و ثبت می‌شوند.
      </p>
      <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-3">
        <FormField id="move-period" label="دوره مقصد">
          <SearchCombobox
            id="move-period"
            label="دوره مقصد"
            value={periodId}
            onValueChange={setPeriodId}
            options={book.periods
              .filter((period) => period.status === 'OPEN')
              .map((period) => ({
                value: period.id,
                label: `${period.startDate} تا ${period.endDate}`,
              }))}
          />
        </FormField>
        <FormField id="move-date" label="تاریخ مقصد">
          <DatePicker
            id="move-date"
            value={documentDate}
            onChange={setDocumentDate}
          />
        </FormField>
        <FormField id="move-reason" label="علت جابه‌جایی">
          <Input
            id="move-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
      </div>
      <fieldset className="rounded-xl border p-3">
        <legend className="px-2 font-bold">پیش‌نویس‌های واجد شرایط</legend>
        {eligible.map((journal) => (
          <label
            className="flex items-center gap-3 border-b py-2 text-sm last:border-0"
            key={journal.id}
          >
            <input
              type="checkbox"
              checked={selected.includes(journal.id)}
              onChange={(event) =>
                setSelected((current) =>
                  event.target.checked
                    ? [...current, journal.id]
                    : current.filter((id) => id !== journal.id),
                )
              }
            />
            <span>
              {journal.documentDate ?? 'بدون تاریخ'} ·{' '}
              {journal.description || 'بدون شرح'}
            </span>
          </label>
        ))}
      </fieldset>
      <Button
        permission="finance.journal.create"
        disabled={busy || !selected.length}
        onClick={() =>
          void run('move-drafts', {
            items: eligible
              .filter((journal) => selected.includes(journal.id))
              .map((journal) => ({
                id: journal.id,
                expectedVersion: journal.version,
              })),
            periodId,
            documentDate,
            reason,
          }).then((result) => {
            if (result) {
              setSelected([]);
              void journals.refetch();
            }
          })
        }
      >
        ثبت جابه‌جایی
      </Button>
    </section>
  );
}
