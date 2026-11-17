'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  treasuryDocumentTypes,
  type TreasuryDefinition,
  type AccountingSnapshotV1,
  type AccountingConfigurationV1,
} from '@nora/contracts';
import {
  useMasterDataResourceAccess,
  useAccessPermissions,
} from '@/modules/iam/access-context';
import { masterDataApi } from '@/modules/master-data/api/client';
import { GenericMasterDataWorkspace } from '@/modules/master-data/components/master-data-live-workspace';
import { CompanyBankAccounts } from './company-bank-accounts';
import { TreasuryInstruments } from './treasury-instruments';
import { TreasuryBankHistory } from './treasury-bank-history';
import { PettyFundCard } from '@/modules/procurement/petty-fund-card';
import { procurementApi } from '@/modules/procurement/api';
import { AccountingButton as Button } from './accounting-operations';
import { FormField, Input } from '@/components/ui/form-controls';

type Props = {
  definition: TreasuryDefinition;
  book: AccountingSnapshotV1 | null;
  busy: boolean;
  run: <T>(
    action: string,
    payload: Record<string, unknown>,
    version?: number,
  ) => Promise<T | undefined>;
};

function AccountsByBank({ book }: { book: AccountingSnapshotV1 }) {
  const [selected, setSelected] = useState(''),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1);
  const result = useQuery({
    queryKey: ['treasury', 'banks', search, page],
    queryFn: () =>
      masterDataApi.list('banks', {
        search,
        status: 'all',
        sortBy: 'name',
        sortDirection: 'asc',
        page,
        pageSize: 25,
      }),
  });
  return (
    <section className="space-y-3">
      <h2>معرفی حساب بانکی</h2>
      <FormField label="جستجوی بانک">
        <Input
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
            setSelected('');
          }}
        />
      </FormField>
      {result.isPending && <p role="status">در حال بارگذاری…</p>}
      {result.error && <p role="alert">{result.error.message}</p>}
      {result.data && (
        <>
          <FormField label="بانک">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">انتخاب بانک</option>
              {result.data.data.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </FormField>
          <Button
            disabled={page === 1}
            onClick={() => {
              setSelected('');
              setPage(page - 1);
            }}
          >
            صفحه قبل
          </Button>
          <Button
            disabled={page * 25 >= result.data.meta.total}
            onClick={() => {
              setSelected('');
              setPage(page + 1);
            }}
          >
            صفحه بعد
          </Button>
        </>
      )}
      {selected && (
        <CompanyBankAccounts
          key={selected}
          bankId={selected}
          companyBranchId={book.book.branchId}
          treasury={{
            bookId: book.book.id,
            types: book.configurations.filter(
              (c) => c.kind === 'bank-account-types',
            ),
          }}
        />
      )}
    </section>
  );
}
function TreasuryPettyFund({ branchId }: { branchId: string }) {
  const bootstrap = useQuery({
    queryKey: ['procurement', 'bootstrap'],
    queryFn: procurementApi.bootstrap,
  });
  if (bootstrap.isPending) return <p role="status">در حال بارگذاری…</p>;
  if (bootstrap.error) return <p role="alert">{bootstrap.error.message}</p>;
  const branches = bootstrap.data.branches.filter((b) => b.id === branchId);
  return branches.length ? (
    <PettyFundCard
      bootstrap={{ ...bootstrap.data, branches, defaultBranchId: branchId }}
      selectedBranchId={branchId}
    />
  ) : (
    <p role="alert">شعبه خارج از دسترسی است.</p>
  );
}
export function TreasuryDefinitionWorkspace(props: Props) {
  const { definition, book } = props;
  const canUse = useMasterDataResourceAccess();
  if (book && definition.kind === 'bank-history')
    return canUse('banks') ? (
      <TreasuryBankHistory bookId={book.book.id} />
    ) : (
      <p role="alert">مجوز دسترسی به بانک‌ها را ندارید.</p>
    );
  if (book && definition.kind === 'petty-funds')
    return <TreasuryPettyFund branchId={book.book.branchId} />;
  if (definition.kind === 'company-accounts')
    return !book ? null : canUse('banks') ? (
      <AccountsByBank book={book} />
    ) : (
      <p role="alert">مجوز دسترسی به بانک‌ها را ندارید.</p>
    );
  if (definition.kind === 'banks' || definition.kind === 'bank-branches') {
    if (!canUse(definition.kind))
      return <p role="alert">مجوز دسترسی به این بخش را ندارید.</p>;
    return (
      <GenericMasterDataWorkspace
        section={{
          slug: 'finance',
          resources: [definition.kind],
          title: definition.title,
          description: '',
          tone: 'emerald',
        }}
      />
    );
  }
  if (book && ['cashboxes', 'terminals', 'cashiers'].includes(definition.kind))
    return (
      <TreasuryInstruments
        book={book}
        view={definition.kind}
        run={props.run}
        busy={props.busy}
      />
    );
  return book ? <TreasuryForm {...props} book={book} /> : null;
}
function TreasuryForm({
  definition,
  book,
  run,
  busy,
}: Props & { book: AccountingSnapshotV1 }) {
  const isType = definition.kind === 'bank-account-types',
    isCause = definition.kind === 'treasury-causes';
  const editable =
    useAccessPermissions()?.includes('finance.account.manage') === true;
  const [selected, setSelected] = useState<AccountingConfigurationV1 | null>(
    null,
  );
  const defaults = {
    code: '',
    title: '',
    titleEn: '',
    description: '',
    shortName: '',
    phone: '',
    email: '',
    descriptionEn: '',
    documentType: 'دریافت',
    hasCheckbook: false,
  };
  const [draft, setDraft] = useState(defaults);
  const rows = book.configurations.filter((c) => c.kind === definition.kind);
  function open(row: AccountingConfigurationV1 | null) {
    setSelected(row);
    setDraft(
      row
        ? {
            code: row.code,
            title: row.title,
            titleEn: row.titleEn ?? '',
            description: row.description ?? '',
            shortName: String(row.attributes.shortName ?? ''),
            phone: String(row.attributes.phone ?? ''),
            email: String(row.attributes.email ?? ''),
            descriptionEn: String(row.attributes.descriptionEn ?? ''),
            documentType: String(row.attributes.documentType ?? 'دریافت'),
            hasCheckbook: row.attributes.hasCheckbook === true,
          }
        : defaults,
    );
  }
  const field = (
    key: Exclude<keyof typeof defaults, 'hasCheckbook'>,
    label: string,
    required = false,
  ) => (
    <FormField label={label} required={required}>
      <Input
        value={draft[key]}
        required={required}
        type={key === 'email' ? 'email' : 'text'}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      />
    </FormField>
  );
  return (
    <section className="space-y-4" dir="rtl">
      <h2 className="text-lg font-bold">{definition.title}</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const attributes = isType
            ? { hasCheckbook: draft.hasCheckbook }
            : isCause
              ? {
                  documentType: draft.documentType,
                  descriptionEn: draft.descriptionEn,
                }
              : {
                  shortName: draft.shortName,
                  email: draft.email,
                  phone: draft.phone,
                };
          const saved = await run<AccountingConfigurationV1>(
            'save-configuration',
            {
              kind: definition.kind,
              id: selected?.id,
              code: draft.code,
              title: draft.title,
              titleEn: draft.titleEn,
              description: draft.description,
              attributes,
              active: selected?.active ?? true,
            },
            selected?.version,
          );
          if (saved) open(saved);
        }}
      >
        <fieldset
          disabled={!editable || busy}
          className="grid gap-3 border p-3 sm:grid-cols-2"
        >
          {!isType && field('code', 'شماره', true)}
          {field('title', isCause ? 'عنوان' : 'نام', true)}
          {isType ? (
            <label>
              <input
                type="checkbox"
                checked={draft.hasCheckbook}
                onChange={(e) =>
                  setDraft({ ...draft, hasCheckbook: e.target.checked })
                }
              />{' '}
              دسته چک دارد
            </label>
          ) : isCause ? (
            <>
              {field('titleEn', 'عنوان به زبان دوم')}
              <FormField label="نوع سند" required>
                <select
                  required
                  value={draft.documentType}
                  onChange={(e) =>
                    setDraft({ ...draft, documentType: e.target.value })
                  }
                >
                  {treasuryDocumentTypes.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </FormField>
              {field('descriptionEn', 'توضیحات به زبان دوم')}
            </>
          ) : (
            <>
              {field('shortName', 'نام اختصاری')}
              {field('phone', 'تلفن')}
              {field('email', 'پست الکترونیکی')}
            </>
          )}
          {!isType && field('description', 'توضیحات')}
          <div>
            <Button type="submit">ذخیره</Button>{' '}
            <Button type="button" onClick={() => open(null)}>
              جدید
            </Button>
          </div>
        </fieldset>
      </form>
      <table className="w-full">
        <thead>
          <tr>
            {!isType && <th>شماره</th>}
            <th>نام</th>
            {isType && <th>دسته چک دارد</th>}
            {isCause && <th>نوع سند</th>}
            <th>مشاهده</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {!isType && <td>{r.code}</td>}
              <td>{r.title}</td>
              {isType && <td>{r.attributes.hasCheckbook ? 'بله' : 'خیر'}</td>}
              {isCause && <td>{String(r.attributes.documentType)}</td>}
              <td>
                <Button disabled={busy} onClick={() => open(r)}>
                  {editable ? 'ویرایش' : 'مشاهده'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
