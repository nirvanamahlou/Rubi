'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import type {
  AccountingAccountV1,
  AccountingAttributes,
  AccountingSnapshotV1,
} from '@nora/contracts';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/overlays';
import {
  AccountingButton,
  AccountingSaveButtons,
  AccountingDeleteButtons,
  accountingSaveDisposition,
} from './accounting-operations';
import { AccountingChartTree } from './accounting-chart-tree';
import {
  accountNatureOptions,
  accountTypeOptions,
  accountToDraft,
  chartPayload,
  descriptionRows,
  natureControlOptions,
  subsidiaryTabs,
  taxTypeOptions,
  type ChartDraft,
} from '../accounting-chart-form';
import { accountingApi } from '../api/accounting-api';

type Run = <T = unknown>(
  action: string,
  payload: Record<string, unknown>,
  version?: number,
) => Promise<T | undefined>;
const control =
  'h-8 w-full min-w-0 rounded-sm border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100 disabled:text-slate-500';
const levelTitles = {
  GROUP: 'گروه حساب',
  GENERAL: 'حساب کل',
  SUBSIDIARY: 'حساب معین',
};

function Field({
  label,
  id,
  required,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-2">
      <label htmlFor={id} className="text-xs text-slate-600">
        {label}:{required && <span className="ms-1 text-red-600">*</span>}
      </label>
      {children}
    </div>
  );
}
function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className="rounded border bg-white p-1.5 text-slate-600 hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function AccountingChartEditor({
  book,
  run,
  busy,
}: {
  book: AccountingSnapshotV1;
  run: Run;
  busy: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<ChartDraft | null>(null);
  const [tab, setTab] = useState('main');
  const [subTab, setSubTab] = useState<string>(subsidiaryTabs[0]);
  const [detailLevel, setDetailLevel] = useState(4);
  const selected = book.accounts.find((account) => account.id === selectedId);
  const parent = book.accounts.find(
    (account) => account.id === draft?.parentId,
  );
  const close = () =>
    router.push(
      `/finance/accounting/general-ledger/accounts?bookId=${book.book.id}`,
    );
  const set = (
    key: keyof Omit<ChartDraft, 'attributes'>,
    value: string | boolean,
  ) => setDraft((old) => (old ? { ...old, [key]: value } : old));
  const attr = (key: string, value: AccountingAttributes[string]) =>
    setDraft((old) =>
      old
        ? {
            ...old,
            attributes: {
              ...old.attributes,
              [key]: value,
              ...(key === 'multiCurrency' && value === false
                ? { revaluable: false }
                : {}),
            },
          }
        : old,
    );
  const open = (id: string) => {
    const account = book.accounts.find((item) => item.id === id);
    if (!account) return;
    setSelectedId(id);
    setDraft(accountToDraft(account));
    setTab('main');
    setSubTab(subsidiaryTabs[0]);
    setDetailLevel(4);
  };
  const reset = (level: AccountingAccountV1['level'], parentId = '') => {
    const owner = book.accounts.find((account) => account.id === parentId);
    setSelectedId('');
    setTab('main');
    setSubTab(subsidiaryTabs[0]);
    setDraft({
      code: owner?.code ?? '',
      title: '',
      titleEn: '',
      description: '',
      level,
      parentId,
      nature: owner?.nature ?? 'DEBIT',
      active: true,
      attributes: {
        accountType:
          owner?.attributes.accountType ??
          (owner?.permanent === false ? 'TEMPORARY' : 'PERMANENT'),
        natureControlScope: 'NONE',
        natureControl: 'NONE',
        detailLevels: ['4', '5', '6'],
      },
    });
  };
  const createChild = () =>
    selected?.level === 'GROUP'
      ? reset('GENERAL', selected.id)
      : selected?.level === 'GENERAL'
        ? reset('SUBSIDIARY', selected.id)
        : selected?.level === 'SUBSIDIARY'
          ? reset('SUBSIDIARY', selected.parentId ?? '')
          : reset('GROUP');
  const period =
    book.periods.find((item) => item.status === 'OPEN') ?? book.periods[0];
  const turnover = useQuery({
    queryKey: [
      'accounting',
      'chart-turnover',
      book.book.id,
      selected?.id,
      period?.id,
      selected?.level,
    ],
    queryFn: () =>
      accountingApi.report(book.book.id, {
        periodId: period!.id,
        level: selected!.level,
      }),
    enabled: tab === 'turnover' && !!selected && !!period,
  });
  const balance = turnover.data?.rows.find(
    (row) => row.accountId === selectedId,
  );
  const text = (
    key: keyof Omit<ChartDraft, 'attributes'>,
    label: string,
    required = false,
  ) => (
    <Field id={`coa-${key}`} label={label} required={required}>
      <input
        id={`coa-${key}`}
        className={control}
        value={String(draft?.[key] ?? '')}
        required={required}
        maxLength={160}
        onChange={(e) => set(key, e.target.value)}
      />
    </Field>
  );
  const choice = (
    key: string,
    label: string,
    options: readonly (readonly [string, string])[],
    { required = false, disabled = false, field = false, empty = false } = {},
  ) => (
    <Field id={`coa-${key}`} label={label} required={required}>
      <select
        id={`coa-${key}`}
        className={control}
        value={String(
          field
            ? (draft?.[key as keyof ChartDraft] ?? '')
            : (draft?.attributes[key] ?? ''),
        )}
        required={required}
        disabled={disabled}
        onChange={(e) =>
          field
            ? set(key as keyof Omit<ChartDraft, 'attributes'>, e.target.value)
            : attr(key, e.target.value)
        }
      >
        {empty && <option value="" />}
        {options.map(([value, title]) => (
          <option key={value} value={value}>
            {title}
          </option>
        ))}
      </select>
    </Field>
  );
  const check = (key: string, label: string, disabled = false) => (
    <label className="flex items-center gap-2 text-xs text-slate-700">
      <input
        type="checkbox"
        checked={
          key === 'active' ? !!draft?.active : draft?.attributes[key] === true
        }
        disabled={disabled}
        onChange={(e) =>
          key === 'active'
            ? set('active', e.target.checked)
            : attr(key, e.target.checked)
        }
      />
      {label}
    </label>
  );
  const types = book.configurations.filter(
    (item) => item.kind === 'detail-types' && item.active,
  );
  const typeKey = `detail${detailLevel}TypeIds`;
  const selectedTypeIds = Array.isArray(draft?.attributes[typeKey])
    ? (draft!.attributes[typeKey] as string[])
    : draft?.attributes[`detail${detailLevel}TypeId`]
      ? [String(draft.attributes[`detail${detailLevel}TypeId`])]
      : [];
  const toggleType = (key: string, id: string, checked: boolean) => {
    const values = Array.isArray(draft?.attributes[key])
      ? (draft!.attributes[key] as string[])
      : key === typeKey
        ? selectedTypeIds
        : [];
    attr(
      key,
      checked
        ? [...new Set([...values, id])]
        : values.filter((value) => value !== id),
    );
  };
  const descriptions = draft ? descriptionRows(draft.attributes) : [];
  const details = Array.isArray(draft?.attributes.detailLevels)
    ? (draft!.attributes.detailLevels as string[])
    : ['4', '5', '6'];
  return (
    <section dir="rtl" className="@container space-y-2">
      <AccountingButton
        permission="finance.account.manage"
        disabled={busy}
        onClick={createChild}
      >
        جدید
      </AccountingButton>
      <AccountingDeleteButtons
        busy={busy}
        selected={selected}
        entity="account"
        run={run}
        reset={() => reset(draft?.level ?? 'GROUP', draft?.parentId)}
        close={close}
      />
      <div className="grid min-h-[40rem] items-start gap-3 @min-[42rem]:grid-cols-[18rem_minmax(0,1fr)] @min-[60rem]:grid-cols-[20rem_minmax(0,1fr)]">
        <AccountingChartTree
          accounts={book.accounts}
          selectedId={selectedId}
          onSelect={open}
        />
        {draft && (
          <form
            className="@container min-w-0 border border-slate-300 bg-white text-xs"
            onSubmit={(event) => {
              event.preventDefault();
              const after = accountingSaveDisposition(event);
              void run<{ id: string }>(
                'save-account',
                chartPayload(draft, selected?.id),
                selected?.version,
              ).then((saved) => {
                if (!saved) return;
                setSelectedId(saved.id);
                if (after === 'new') reset(draft.level, draft.parentId);
                if (after === 'close') close();
              });
            }}
          >
            <AccountingSaveButtons busy={busy} />
            <Tabs value={tab} onValueChange={setTab} dir="rtl">
              <TabsList className="w-full justify-start rounded-none border-b bg-slate-50 p-0">
                <TabsTrigger value="main" className="rounded-none">
                  اطلاعات اصلی
                </TabsTrigger>
                <TabsTrigger
                  value="turnover"
                  disabled={!selected}
                  className="rounded-none"
                >
                  گردش حساب
                </TabsTrigger>
              </TabsList>
              <TabsContent value="main" className="m-0 p-2">
                <fieldset className="border border-slate-300 bg-slate-50/70 p-3">
                  <legend className="px-1 text-slate-600">
                    {levelTitles[draft.level]}
                  </legend>
                  <div className="grid items-start gap-x-8 gap-y-4 @min-[40rem]:grid-cols-2">
                    <div className="space-y-2">
                      <Field label="کد" id="coa-code" required>
                        <div dir="ltr" className="flex gap-1">
                          {parent && (
                            <input
                              aria-label="پیشوند کد"
                              className={`${control} !w-16 shrink-0`}
                              value={parent.code}
                              readOnly
                              tabIndex={-1}
                            />
                          )}
                          <input
                            id="coa-code"
                            className={control}
                            required
                            pattern="[0-9]+"
                            maxLength={20 - (parent?.code.length ?? 0)}
                            value={draft.code.slice(parent?.code.length ?? 0)}
                            readOnly={
                              !!selected &&
                              book.accounts.some(
                                (item) => item.parentId === selected.id,
                              )
                            }
                            onChange={(e) =>
                              set('code', (parent?.code ?? '') + e.target.value)
                            }
                          />
                        </div>
                      </Field>
                      {text('title', 'عنوان', true)}
                      {text('titleEn', 'عنوان به زبان دوم')}
                      {choice('accountType', 'نوع', accountTypeOptions, {
                        required: true,
                      })}
                      {choice('nature', 'ماهیت', accountNatureOptions, {
                        required: true,
                        field: true,
                      })}
                      {draft.level === 'SUBSIDIARY' &&
                        choice(
                          'defaultCurrency',
                          'ارز پیش فرض',
                          draft.attributes.defaultCurrency
                            ? [
                                [
                                  String(draft.attributes.defaultCurrency),
                                  String(draft.attributes.defaultCurrency),
                                ],
                              ]
                            : [],
                          { empty: true, disabled: true },
                        )}
                    </div>
                    <div className="space-y-4 pt-1">
                      {draft.level === 'SUBSIDIARY' &&
                        check('traceable', 'ویژگی پیگیری')}
                      {check('active', 'فعال')}
                      {draft.level === 'SUBSIDIARY' && (
                        <>
                          {check('multiCurrency', 'ویژگی ارزی')}
                          {check(
                            'revaluable',
                            'تسعیر پذیر است',
                            draft.attributes.multiCurrency !== true,
                          )}
                          {choice(
                            'natureControlScope',
                            'کنترل ماهیت حساب طی دوره',
                            natureControlOptions,
                          )}
                          <Field
                            label="مانده صفر در پایان دوره"
                            id="coa-zero-balance"
                          >
                            <select
                              id="coa-zero-balance"
                              className={control}
                              value={
                                draft.attributes.zeroBalanceAtClose === true
                                  ? 'true'
                                  : 'false'
                              }
                              onChange={(e) =>
                                attr(
                                  'zeroBalanceAtClose',
                                  e.target.value === 'true',
                                )
                              }
                            >
                              <option value="false">غیر فعال</option>
                              <option value="true">فعال</option>
                            </select>
                          </Field>
                        </>
                      )}
                    </div>
                    <div className="@min-[40rem]:col-span-2">
                      <Field label="توضیحات" id="coa-description">
                        <textarea
                          id="coa-description"
                          className={`${control} min-h-12 py-1`}
                          value={draft.description}
                          maxLength={2000}
                          onChange={(e) => set('description', e.target.value)}
                        />
                      </Field>
                    </div>
                  </div>
                </fieldset>
                {draft.level === 'SUBSIDIARY' && (
                  <Tabs
                    value={subTab}
                    onValueChange={setSubTab}
                    dir="rtl"
                    className="mt-2"
                  >
                    <TabsList className="h-auto w-full flex-wrap justify-start rounded-none border-b bg-slate-50 p-0">
                      {subsidiaryTabs.map((label) => (
                        <TabsTrigger
                          key={label}
                          className="rounded-none text-xs"
                          value={label}
                        >
                          {label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    <TabsContent
                      value="سطوح تفصیلی"
                      className="m-0 grid min-h-60 gap-3 border p-2 sm:grid-cols-[1fr_2fr]"
                    >
                      <fieldset className="min-w-0 border p-1">
                        <legend className="px-1">سطوح تفصیلی</legend>
                        <table className="w-full text-right">
                          <thead className="bg-sky-50">
                            <tr>
                              <th className="w-8" />
                              <th className="p-2">عنوان</th>
                            </tr>
                          </thead>
                          <tbody>
                            {details.map((level) => (
                              <tr
                                key={level}
                                className={`border-t ${detailLevel === Number(level) ? 'bg-sky-100' : ''}`}
                              >
                                <td className="p-2">
                                  <input
                                    type="checkbox"
                                    aria-label={`فعال بودن سطح ${level}`}
                                    checked={
                                      draft.attributes[
                                        `detail${level}Required`
                                      ] === true
                                    }
                                    onChange={(e) =>
                                      attr(
                                        `detail${level}Required`,
                                        e.target.checked,
                                      )
                                    }
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="w-full p-2 text-right"
                                    onClick={() =>
                                      setDetailLevel(Number(level))
                                    }
                                  >
                                    سطح{' '}
                                    {
                                      { '4': 'چهار', '5': 'پنج', '6': 'شش' }[
                                        level
                                      ]
                                    }
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {details.length < 3 && (
                          <div className="mt-2">
                            <IconAction
                              label="اضافه کردن سطح جدید"
                              onClick={() =>
                                attr('detailLevels', [
                                  ...details,
                                  String(4 + details.length),
                                ])
                              }
                            >
                              <Plus className="size-3" />
                            </IconAction>
                          </div>
                        )}
                      </fieldset>
                      <fieldset className="min-w-0 border p-1">
                        <legend className="px-1">انواع تفصیلی</legend>
                        <table className="w-full text-right">
                          <thead className="bg-sky-50">
                            <tr>
                              <th className="w-8" />
                              {draft.attributes.natureControlScope ===
                                'SELECTED_DETAIL' && <th>کنترل ماهیت</th>}
                              <th className="p-2">عنوان</th>
                            </tr>
                          </thead>
                          <tbody>
                            {types.map((type) => (
                              <tr key={type.id} className="border-t">
                                <td className="p-2">
                                  <input
                                    type="checkbox"
                                    aria-label={`انتخاب ${type.title}`}
                                    checked={selectedTypeIds.includes(type.id)}
                                    onChange={(e) =>
                                      toggleType(
                                        typeKey,
                                        type.id,
                                        e.target.checked,
                                      )
                                    }
                                  />
                                </td>
                                {draft.attributes.natureControlScope ===
                                  'SELECTED_DETAIL' && (
                                  <td>
                                    <input
                                      type="checkbox"
                                      aria-label={`کنترل ماهیت ${type.title}`}
                                      disabled={
                                        !selectedTypeIds.includes(type.id)
                                      }
                                      checked={
                                        Array.isArray(
                                          draft.attributes[
                                            `detail${detailLevel}NatureTypeIds`
                                          ],
                                        ) &&
                                        (
                                          draft.attributes[
                                            `detail${detailLevel}NatureTypeIds`
                                          ] as string[]
                                        ).includes(type.id)
                                      }
                                      onChange={(e) =>
                                        toggleType(
                                          `detail${detailLevel}NatureTypeIds`,
                                          type.id,
                                          e.target.checked,
                                        )
                                      }
                                    />
                                  </td>
                                )}
                                <td className="p-2">{type.title}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </fieldset>
                    </TabsContent>
                    <TabsContent
                      value="طرف مقابل"
                      className="m-0 min-h-48 border p-4"
                    >
                      {choice(
                        'counterpartId',
                        'حساب طرف مقابل',
                        book.accounts
                          .filter(
                            (account) =>
                              account.level === 'SUBSIDIARY' &&
                              account.active &&
                              account.id !== selectedId,
                          )
                          .map((account) => [
                            account.id,
                            `${account.code}-${account.title}`,
                          ]),
                        { empty: true },
                      )}
                    </TabsContent>
                    <TabsContent
                      value="تعیین ویژگی مالیاتی"
                      className="m-0 min-h-48 space-y-3 border p-4"
                    >
                      {choice(
                        'taxAccountKind',
                        'معین مالیاتی',
                        [
                          ['TAX', 'معین مالیاتی'],
                          ['TAXABLE', 'معین مالیات پذیر'],
                        ],
                        { empty: true },
                      )}
                      {choice(
                        'taxType',
                        'انواع مالیاتی',
                        taxTypeOptions.map((value) => [value, value]),
                        {
                          empty: true,
                          disabled: draft.attributes.taxAccountKind !== 'TAX',
                          required: draft.attributes.taxAccountKind === 'TAX',
                        },
                      )}
                      {draft.attributes.taxAccountKind === 'TAXABLE' && (
                        <fieldset className="grid gap-3 border p-3 sm:grid-cols-2">
                          <legend className="px-1">پیش فرض</legend>
                          {choice(
                            'taxItemOrService',
                            'کالا/خدمت',
                            [
                              ['کالا', 'کالا'],
                              ['خدمت', 'خدمت'],
                            ],
                            { empty: true },
                          )}
                          {choice(
                            'taxPurchaseOrSale',
                            'خرید/فروش',
                            [
                              ['خرید', 'خرید'],
                              ['فروش', 'فروش'],
                            ],
                            { empty: true },
                          )}
                          {choice(
                            'taxState',
                            'وضعیت مالیاتی',
                            [
                              ['مشمول', 'مشمول'],
                              ['معاف', 'معاف'],
                            ],
                            { empty: true },
                          )}
                          {choice(
                            'taxTransactionType',
                            'نوع معامله',
                            [
                              ['داخلی', 'داخلی'],
                              ['خارجی', 'خارجی'],
                            ],
                            { empty: true },
                          )}
                        </fieldset>
                      )}
                    </TabsContent>
                    <TabsContent
                      value="شرح های پیش فرض"
                      className="m-0 min-h-48 border p-2"
                    >
                      <table className="w-full text-right">
                        <thead className="bg-sky-50">
                          <tr>
                            <th className="p-2">شرح</th>
                            <th className="p-2">شرح به زبان دوم</th>
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {descriptions.map((row, index) => (
                            <tr key={index}>
                              <td>
                                <input
                                  aria-label={`شرح ${index + 1}`}
                                  className={control}
                                  value={row.text}
                                  onChange={(e) =>
                                    attr(
                                      'defaultDescriptions',
                                      JSON.stringify(
                                        descriptions.map((item, i) =>
                                          i === index
                                            ? { ...item, text: e.target.value }
                                            : item,
                                        ),
                                      ),
                                    )
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  aria-label={`شرح به زبان دوم ${index + 1}`}
                                  className={control}
                                  value={row.textEn}
                                  onChange={(e) =>
                                    attr(
                                      'defaultDescriptions',
                                      JSON.stringify(
                                        descriptions.map((item, i) =>
                                          i === index
                                            ? {
                                                ...item,
                                                textEn: e.target.value,
                                              }
                                            : item,
                                        ),
                                      ),
                                    )
                                  }
                                />
                              </td>
                              <td>
                                <IconAction
                                  label={`حذف شرح ${index + 1}`}
                                  onClick={() =>
                                    attr(
                                      'defaultDescriptions',
                                      JSON.stringify(
                                        descriptions.filter(
                                          (_, i) => i !== index,
                                        ),
                                      ),
                                    )
                                  }
                                >
                                  <Trash2 className="size-3" />
                                </IconAction>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-2">
                        <IconAction
                          label="افزودن شرح"
                          onClick={() =>
                            attr(
                              'defaultDescriptions',
                              JSON.stringify([
                                ...descriptions,
                                { text: '', textEn: '' },
                              ]),
                            )
                          }
                        >
                          <Plus className="size-3" />
                        </IconAction>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </TabsContent>
              <TabsContent value="turnover" className="m-0 min-h-60 p-2">
                <table className="w-full text-right">
                  <thead className="bg-sky-50">
                    <tr>
                      {[
                        'بدهکار',
                        'بستانکار',
                        'مانده بدهکار',
                        'مانده بستانکار',
                        'عنوان ارز',
                        'مانده ارز',
                      ].map((title) => (
                        <th className="border p-2" key={title}>
                          {title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {balance && (
                      <tr>
                        {[
                          balance.debit,
                          balance.credit,
                          balance.balance.startsWith('-')
                            ? ''
                            : balance.balance,
                          balance.balance.startsWith('-')
                            ? balance.balance.slice(1)
                            : '',
                          '',
                          '',
                        ].map((value, i) => (
                          <td key={i} className="border p-2" dir="ltr">
                            {value}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
                {turnover.isFetching && (
                  <p role="status" className="p-3">
                    در حال بارگذاری…
                  </p>
                )}
                {turnover.error && (
                  <p role="alert" className="p-3 text-red-600">
                    {turnover.error.message}
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </form>
        )}
      </div>
    </section>
  );
}
