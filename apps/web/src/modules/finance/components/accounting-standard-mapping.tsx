'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { accountingApi } from '../api/accounting-api';
import { AccountingButton as Button } from './accounting-operations';
import type { PersistedEditorRun } from './accounting-persisted-editor';

export type StandardCode = {
  id: string;
  code: string;
  title: string;
  titleEn: string | null;
};
export type StandardEntity = {
  id: string;
  rowId: string;
  title: string;
  titleEn: string;
  systemEntity: string;
  version: number;
};
export type StandardMapping = {
  entities: StandardEntity[];
  entity: StandardEntity | null;
  codes: StandardCode[];
  supported: boolean;
  page: number;
  mappedPage: number;
  pageSize: number;
  total: number;
  mappedTotal: number;
  unmapped: { id: string; code: string; title: string; active: boolean }[];
  mapped: { id: string; code: string; title: string; active: boolean }[];
};

export function AccountingStandardMapping({
  book,
  run,
  busy,
}: {
  book: AccountingSnapshotV1;
  run: PersistedEditorRun;
  busy: boolean;
}) {
  const permissions = useAccessPermissions();
  const writable = !!permissions?.includes('finance.account.manage');
  const [standardId, setStandard] = useState(''),
    [entityId, setEntity] = useState(''),
    [codeId, setCode] = useState('');
  const [page, setPage] = useState(1),
    [mappedPage, setMappedPage] = useState(1),
    [search, setSearch] = useState(''),
    [treeSearch, setTreeSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]),
    [mappedSelected, setMappedSelected] = useState<string[]>([]);
  const query = useQuery({
    queryKey: [
      'accounting-standard-mapping',
      book.book.id,
      standardId,
      entityId,
      codeId,
      search,
      page,
      mappedPage,
    ],
    enabled: !!standardId,
    queryFn: () =>
      accountingApi.analytical<StandardMapping>(
        book.book.id,
        'standard-mapping',
        {
          standardId,
          ...(entityId ? { entityId } : {}),
          ...(codeId ? { codeId } : {}),
          search,
          page: String(page),
          mappedPage: String(mappedPage),
        },
      ),
  });
  const data = !query.isFetching && !query.isError ? query.data : undefined;
  const resetSelection = () => {
    setSelected([]);
    setMappedSelected([]);
  };
  const mutate = async (action: string, ids: string[]) => {
    if (!data?.entity || !ids.length || !writable) return;
    const result = await run(
      action,
      { entityId, codeId, accountIds: ids },
      data.entity.version,
    );
    if (result) {
      resetSelection();
      await query.refetch();
    }
  };
  const panel = (mapped: boolean) => {
    const rows = mapped ? data?.mapped : data?.unmapped,
      chosen = mapped ? mappedSelected : selected;
    const total = (mapped ? data?.mappedTotal : data?.total) ?? 0,
      current = mapped ? mappedPage : page;
    const changePage = mapped ? setMappedPage : setPage,
      choose = mapped ? setMappedSelected : setSelected;
    return (
      <fieldset className="min-w-0 border p-2">
        <legend>{mapped ? 'کدهای نگاشت شده' : 'کدهای نگاشت نشده'}</legend>
        <div className="min-h-72 overflow-auto">
          <table className="w-full text-start text-xs">
            <thead>
              <tr>
                <th>انتخاب</th>
                <th>کد</th>
                <th>عنوان</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${mapped ? 'برداشتن نگاشت' : 'انتخاب حساب'} ${row.code}`}
                      checked={chosen.includes(row.id)}
                      disabled={busy || !writable}
                      onChange={(event) =>
                        choose(
                          event.target.checked
                            ? [...chosen, row.id]
                            : chosen.filter((id) => id !== row.id),
                        )
                      }
                    />
                  </td>
                  <td dir="ltr">{row.code}</td>
                  <td>
                    {row.title}
                    {!row.active && ' (غیرفعال)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          {total} رکورد — {current}
        </p>
        <div className="flex gap-2">
          <Button
            disabled={current <= 1 || query.isFetching}
            onClick={() => {
              changePage(current - 1);
              resetSelection();
            }}
          >
            قبلی
          </Button>
          <Button
            disabled={current * 50 >= total || query.isFetching}
            onClick={() => {
              changePage(current + 1);
              resetSelection();
            }}
          >
            بعدی
          </Button>
        </div>
      </fieldset>
    );
  };
  return (
    <section
      className="space-y-3 border bg-slate-50/40 p-3"
      aria-busy={query.isFetching}
    >
      <h2>نگاشت کدهای استاندارد</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <SearchCombobox
          label="کدینگ استاندارد"
          value={standardId}
          options={book.configurations
            .filter((row) => row.kind === 'coding-standards' && row.active)
            .map((row) => ({
              value: row.id,
              label: `${row.title} — ${row.attributes.protocolVersion || ''}`,
            }))}
          onValueChange={(id) => {
            setStandard(id);
            setEntity('');
            setCode('');
            setPage(1);
            setMappedPage(1);
            resetSelection();
          }}
        />
        <label>
          نسخه پروتکل
          <input
            readOnly
            className="w-full border bg-slate-100"
            value={String(
              book.configurations.find((row) => row.id === standardId)
                ?.attributes.protocolVersion || '',
            )}
          />
        </label>
        <SearchCombobox
          label="موجودیت استاندارد"
          value={entityId}
          options={(data?.entities ?? query.data?.entities ?? []).map(
            (row) => ({
              value: row.id,
              label: `${row.title} — ${row.systemEntity}`,
            }),
          )}
          onValueChange={(id) => {
            setEntity(id);
            setCode('');
            setPage(1);
            setMappedPage(1);
            resetSelection();
          }}
        />
      </div>
      <label className="block text-xs">
        <input type="checkbox" disabled /> نمایش کدهای نگاشت نشده دارای گردش
      </label>
      <p className="text-xs">
        مبنای گزینهٔ «دارای گردش» برای این موجودیت در منبع تأیید نشده و فعلاً
        فعال نیست.
      </p>
      {query.error && <p role="alert">{query.error.message}</p>}
      {entityId && data && !data.supported && (
        <p role="status">نگاشت برای این نوع موجودیت هنوز فعال نشده است.</p>
      )}
      <label className="block">
        جستجوی حساب
        <input
          className="ms-2 border"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
            setMappedPage(1);
            resetSelection();
          }}
        />
      </label>
      <div className="grid gap-2 xl:grid-cols-[1fr_1fr_auto_1fr]">
        <fieldset className="min-w-0 border p-2">
          <legend>کدهای استاندارد</legend>
          <input
            aria-label="جستجوی کد استاندارد"
            className="w-full border"
            value={treeSearch}
            onChange={(event) => setTreeSearch(event.target.value)}
          />
          <div
            className="max-h-96 overflow-auto"
            role="tree"
            aria-label="کدهای استاندارد"
          >
            {data?.codes
              .filter((code) =>
                `${code.code} ${code.title}`.includes(treeSearch),
              )
              .map((code) => (
                <button
                  key={code.id}
                  type="button"
                  role="treeitem"
                  aria-selected={codeId === code.id}
                  className={`block w-full p-1 text-start text-xs ${codeId === code.id ? 'bg-blue-100' : ''}`}
                  onClick={() => {
                    setCode(code.id);
                    setPage(1);
                    setMappedPage(1);
                    resetSelection();
                  }}
                >
                  {code.code}: {code.title}
                </button>
              ))}
          </div>
        </fieldset>
        {panel(false)}
        <div className="flex items-center justify-center gap-2 xl:flex-col">
          <Button
            disabled={busy || !writable || !data?.supported || !selected.length}
            onClick={() => void mutate('standard-map', selected)}
          >
            نگاشت ←
          </Button>
          <Button
            disabled={
              busy || !writable || !data?.supported || !mappedSelected.length
            }
            onClick={() => void mutate('standard-unmap', mappedSelected)}
          >
            → حذف نگاشت
          </Button>
          <Button
            disabled={query.isFetching || busy || !standardId}
            onClick={() => {
              resetSelection();
              void query.refetch();
            }}
          >
            بارگذاری مجدد
          </Button>
        </div>
        {panel(true)}
      </div>
    </section>
  );
}

/** The selected metadata row resolves to its own persisted entity before editing codes. */
export function AccountingStandardCodes({
  bookId,
  standardId,
  rowId,
  readonly,
  run,
}: {
  bookId: string;
  standardId: string;
  rowId: string;
  readonly: boolean;
  run: PersistedEditorRun;
}) {
  const [codeId, selectCode] = useState(''),
    [draft, setDraft] = useState<{
      id?: string;
      code: string;
      title: string;
      titleEn: string;
    } | null>(null);
  const metadata = useQuery({
    queryKey: ['accounting-standard-entities', bookId, standardId],
    enabled: !!standardId,
    queryFn: () =>
      accountingApi.analytical<StandardMapping>(bookId, 'standard-mapping', {
        standardId,
      }),
  });
  const entity = metadata.data?.entities.find((row) => row.rowId === rowId);
  const query = useQuery({
    queryKey: ['accounting-standard-codes', bookId, standardId, entity?.id],
    enabled: !!entity,
    queryFn: () =>
      accountingApi.analytical<StandardMapping>(bookId, 'standard-mapping', {
        standardId,
        entityId: entity!.id,
      }),
  });
  const data = !query.isFetching && !query.isError ? query.data : undefined;
  const code = data?.codes.find((row) => row.id === codeId);
  const mutate = async (action: string) => {
    if (!data?.entity || readonly) return;
    const result = await run(
      action,
      {
        entityId: data.entity.id,
        ...(action === 'standard-code-save' && draft
          ? {
              codeId: draft.id,
              code: draft.code,
              title: draft.title,
              titleEn: draft.titleEn,
            }
          : { codeId }),
      },
      data.entity.version,
    );
    if (result) {
      setDraft(null);
      selectCode('');
      await query.refetch();
    }
  };
  return (
    <div className="space-y-2">
      {!entity && (
        <p className="text-xs">
          ابتدا استاندارد را ذخیره و یک موجودیت را انتخاب کنید.
        </p>
      )}
      {(metadata.error || query.error) && (
        <p role="alert">{(metadata.error || query.error)?.message}</p>
      )}
      <div
        role="tree"
        aria-label="کدهای استاندارد"
        className="max-h-80 min-h-64 overflow-auto"
      >
        {data?.codes.map((item) => (
          <button
            type="button"
            role="treeitem"
            aria-selected={codeId === item.id}
            key={item.id}
            className={`block w-full p-1 text-start text-xs ${codeId === item.id ? 'bg-blue-100' : ''}`}
            onClick={() => {
              selectCode(item.id);
              setDraft(null);
            }}
          >
            {item.code}: {item.title}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={readonly || !data?.entity}
          onClick={() => setDraft({ code: '', title: '', titleEn: '' })}
        >
          جدید — کد استاندارد
        </Button>
        <Button
          disabled={readonly || !code}
          onClick={() =>
            code &&
            setDraft({
              id: code.id,
              code: code.code,
              title: code.title,
              titleEn: code.titleEn ?? '',
            })
          }
        >
          ویرایش کد استاندارد
        </Button>
        <Button
          disabled={readonly || !code}
          onClick={() => {
            if (window.confirm('کد استاندارد انتخاب‌شده حذف شود؟'))
              void mutate('standard-code-delete');
          }}
        >
          حذف کد استاندارد
        </Button>
        <Button
          disabled={!entity || query.isFetching}
          onClick={() => {
            setDraft(null);
            void query.refetch();
          }}
        >
          بارگذاری مجدد کدهای استاندارد
        </Button>
      </div>
      {draft && (
        <div className="space-y-2 border p-2">
          {(['code', 'title', 'titleEn'] as const).map((key) => (
            <label className="block" key={key}>
              {key === 'code'
                ? 'کد استاندارد'
                : key === 'title'
                  ? 'عنوان کد استاندارد'
                  : 'عنوان به زبان دوم'}
              <input
                className="ms-2 border"
                maxLength={key === 'code' ? 40 : 160}
                value={draft[key]}
                onChange={(event) =>
                  setDraft({ ...draft, [key]: event.target.value })
                }
              />
            </label>
          ))}
          <Button
            disabled={readonly || !draft.code.trim() || !draft.title.trim()}
            onClick={() => void mutate('standard-code-save')}
          >
            ذخیره کد استاندارد
          </Button>
          <Button onClick={() => setDraft(null)}>انصراف</Button>
        </div>
      )}
    </div>
  );
}
