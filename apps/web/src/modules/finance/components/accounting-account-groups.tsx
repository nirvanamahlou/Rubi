'use client';

import {
  AccountingSetupNotes,
  parseSetupNotes,
} from './accounting-setup-notes';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderTree,
  ListPlus,
  ChevronDown,
  ChevronLeft,
  Plus,
  Minus,
} from 'lucide-react';
import type {
  AccountingAccountGroupV1,
  AccountingDetailGroupV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { FormField, Input } from '@/components/ui/form-controls';
import {
  AccountingButton as Button,
  AccountingDeleteButtons,
  AccountingSaveButtons,
  accountingSaveDisposition,
} from './accounting-operations';
import type { PersistedEditorRun } from './accounting-persisted-editor';

export function AccountingAccountGroups({
  book,
  kind,
  run,
  busy,
}: {
  book: AccountingSnapshotV1;
  kind: 'account' | 'detail';
  run: PersistedEditorRun;
  busy: boolean;
}) {
  type Group = AccountingAccountGroupV1 | AccountingDetailGroupV1;
  const router = useRouter();
  const groups: Group[] =
    kind === 'account' ? book.accountGroups : book.detailGroups;
  const candidates = kind === 'account' ? book.accounts : book.details;
  const [selected, setSelected] = useState<Group | null>(null),
    [editing, setEditing] = useState(false),
    [allocation, setAllocation] = useState(false);
  const [code, setCode] = useState(''),
    [title, setTitle] = useState(''),
    [members, setMembers] = useState<string[]>([]),
    [search, setSearch] = useState(''),
    [typeId, setTypeId] = useState('');
  const [tab, setTab] = useState('main'),
    [notes, setNotes] = useState(() => parseSetupNotes(undefined));
  const [activeAccount, setActiveAccount] = useState('');
  const [detailAllocations, setDetailAllocations] = useState<
    { accountId: string; detailId: string }[]
  >([]);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [pendingMembers, setPendingMembers] = useState<string[]>([]);
  const [detailSearchType, setDetailSearchType] = useState('');
  const account = book.accounts.find((row) => row.id === activeAccount);
  const allowedTypes = [4, 5, 6].flatMap((level) => {
    const value = account?.attributes[`detail${level}TypeIds`];
    const single = account?.attributes[`detail${level}TypeId`];
    return Array.isArray(value)
      ? value
      : typeof single === 'string'
        ? [single]
        : [];
  });
  const allocationTypes =
    account?.level === 'SUBSIDIARY'
      ? book.configurations.filter(
          (row) =>
            row.kind === 'detail-types' &&
            row.active &&
            (allowedTypes.length
              ? allowedTypes.includes(row.id)
              : book.details.some(
                  (detail) => detail.active && detail.typeId === row.id,
                )),
        )
      : [];
  const accountVisible = (id: string): boolean => {
    const parent = book.accounts.find((row) => row.id === id)?.parentId;
    return !parent || (!collapsed.includes(parent) && accountVisible(parent));
  };
  const close = () =>
    router.push(
      `/finance/accounting/general-ledger/accounts?bookId=${book.book.id}`,
    );
  const fresh = () => {
    setSelected(null);
    setEditing(true);
    setCode('');
    setTitle('');
    setMembers([]);
    setAllocation(false);
    setNotes([]);
    setTab('main');
    setDetailAllocations([]);
    setActiveAccount('');
    setPendingMembers([]);
  };
  const open = (row: Group) => {
    setSelected(row);
    setEditing(true);
    setCode(row.code);
    setTitle(row.title);
    setNotes(parseSetupNotes(row.notes));
    setDetailAllocations(
      (row as AccountingAccountGroupV1).detailAllocations ?? [],
    );
    setPendingMembers([]);
    setMembers(
      kind === 'account'
        ? (row as AccountingAccountGroupV1).members.map((m) => m.accountId)
        : (row as AccountingDetailGroupV1).members.map((m) => m.detailId),
    );
  };
  const toggle = (id: string, checked: boolean) =>
    setMembers((old) =>
      checked ? [...new Set([...old, id])] : old.filter((item) => item !== id),
    );
  const visible = candidates.filter(
    (row) =>
      `${row.code} ${row.title}`.includes(search) &&
      (kind === 'account' ||
        !typeId ||
        ('typeId' in row && row.typeId === typeId)),
  );
  return (
    <section className="@container space-y-3" dir="rtl">
      <Button onClick={fresh}>گروه جدید</Button>
      <AccountingDeleteButtons
        busy={busy}
        selected={selected}
        entity={kind === 'account' ? 'account-group' : 'detail-group'}
        run={run}
        reset={fresh}
        close={close}
      />
      <div className="grid min-h-[35rem] items-start gap-3 @min-[42rem]:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="min-h-96 rounded-lg border p-3">
          <h2 className="mb-3 flex items-center gap-2 border-b pb-3 font-bold">
            <FolderTree className="size-4" />
            {kind === 'account' ? 'گروهبندی حساب ها' : 'گروهبندی حساب تفصیلی'}
          </h2>
          {groups.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`block w-full rounded px-2 py-2 text-start text-sm ${row.id === selected?.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
              onClick={() => open(row)}
            >
              {row.code} — {row.title}
            </button>
          ))}
        </aside>
        {editing ? (
          <form
            className="space-y-4 rounded-lg border bg-muted/15 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const after = accountingSaveDisposition(event);
              void run<Group>(
                kind === 'account' ? 'save-account-group' : 'save-detail-group',
                {
                  code,
                  title,
                  notes,
                  memberIds: members,
                  ...(kind === 'account'
                    ? {
                        detailAllocations: detailAllocations.filter((row) =>
                          members.includes(row.accountId),
                        ),
                      }
                    : {}),
                  titleEn: selected?.titleEn,
                  description: selected?.description,
                  active: selected?.active ?? true,
                  ...(selected ? { id: selected.id } : {}),
                },
                selected?.version,
              ).then((saved) => {
                if (!saved) return;
                open(saved);
                if (after === 'new') fresh();
                if (after === 'close') close();
              });
            }}
          >
            <div className="flex justify-between border-b pb-2">
              <div role="tablist" className="flex gap-4">
                {(['main', 'notes'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    className={tab === key ? 'font-semibold text-primary' : ''}
                    onClick={() => setTab(key)}
                  >
                    {key === 'main' ? 'اطلاعات اصلی' : 'یادداشت'}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={
                  kind === 'account'
                    ? 'تخصیص حساب به گروه'
                    : 'تخصیص حساب تفصیلی به گروه'
                }
                title={
                  kind === 'account'
                    ? 'تخصیص حساب به گروه'
                    : 'تخصیص حساب تفصیلی به گروه'
                }
                onClick={() => {
                  setTab('main');
                  setAllocation((old) => !old);
                }}
              >
                <ListPlus className="size-4" />
              </Button>
            </div>
            <div hidden={tab !== 'main'} className="space-y-4">
              <div className="grid gap-4 @min-[40rem]:grid-cols-2">
                <FormField label="کد" id="group-code">
                  <Input
                    id="group-code"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </FormField>
                <FormField label="عنوان" id="group-title">
                  <Input
                    id="group-title"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </FormField>
              </div>
              {allocation ? (
                <fieldset className="space-y-3 rounded border p-3">
                  <legend>
                    {kind === 'account'
                      ? 'تخصیص حساب به گروه'
                      : 'حساب های تفصیلی'}
                  </legend>
                  <div className="flex gap-2">
                    <Input
                      aria-label="جستجو"
                      placeholder="جستجو"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {kind === 'detail' ? (
                      <select
                        aria-label="انتخاب نوع تفصیلی"
                        className="rounded border bg-surface px-2"
                        value={typeId}
                        onChange={(e) => setTypeId(e.target.value)}
                      >
                        <option value="">انتخاب نوع تفصیلی...</option>
                        {book.configurations
                          .filter((row) => row.kind === 'detail-types')
                          .map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.title}
                            </option>
                          ))}
                      </select>
                    ) : null}
                  </div>
                  <div
                    className={
                      kind === 'account'
                        ? 'grid gap-3 @min-[45rem]:grid-cols-2'
                        : ''
                    }
                  >
                    <div className="max-h-96 overflow-auto rounded border bg-surface">
                      {kind === 'detail' ? (
                        <table className="w-full text-xs">
                          <thead>
                            <tr>
                              {[
                                '',
                                'کد',
                                'عنوان',
                                'نوع تفصیلی',
                                'عنوان تفصیل پدر',
                                'شماره طبقه بندی',
                                'وضعیت',
                              ].map((label, i) => (
                                <th key={i} className="p-2 border-b">
                                  {label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {visible.map((row) =>
                              'typeId' in row ? (
                                <tr key={row.id}>
                                  <td>
                                    <input
                                      type="checkbox"
                                      aria-label={`انتخاب ${row.title}`}
                                      checked={pendingMembers.includes(row.id)}
                                      onChange={(e) =>
                                        setPendingMembers((old) =>
                                          e.target.checked
                                            ? [...old, row.id]
                                            : old.filter((id) => id !== row.id),
                                        )
                                      }
                                    />
                                  </td>
                                  <td>{row.code}</td>
                                  <td>{row.title}</td>
                                  <td>
                                    {
                                      book.configurations.find(
                                        (t) => t.id === row.typeId,
                                      )?.title
                                    }
                                  </td>
                                  <td>
                                    {
                                      book.details.find(
                                        (t) => t.id === row.parentId,
                                      )?.title
                                    }
                                  </td>
                                  <td>
                                    {String(
                                      row.attributes.classificationNumber ?? '',
                                    )}
                                  </td>
                                  <td>{row.active ? 'فعال' : 'غیرفعال'}</td>
                                </tr>
                              ) : null,
                            )}
                          </tbody>
                        </table>
                      ) : (
                        visible
                          .filter((row) => search || accountVisible(row.id))
                          .map((row) => (
                            <div
                              key={row.id}
                              className={`flex items-center gap-2 border-b px-2 py-1.5 text-sm ${activeAccount === row.id ? 'bg-primary/10' : ''}`}
                              style={{
                                paddingInlineStart:
                                  'level' in row && row.level === 'SUBSIDIARY'
                                    ? 44
                                    : 'level' in row && row.level === 'GENERAL'
                                      ? 28
                                      : 12,
                              }}
                            >
                              {book.accounts.some(
                                (child) => child.parentId === row.id,
                              ) ? (
                                <button
                                  type="button"
                                  aria-label={`${collapsed.includes(row.id) ? 'بازکردن' : 'بستن'} ${row.title}`}
                                  onClick={() =>
                                    setCollapsed((old) =>
                                      old.includes(row.id)
                                        ? old.filter((id) => id !== row.id)
                                        : [...old, row.id],
                                    )
                                  }
                                >
                                  {collapsed.includes(row.id) ? (
                                    <ChevronLeft className="size-3" />
                                  ) : (
                                    <ChevronDown className="size-3" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-3" />
                              )}
                              <input
                                type="checkbox"
                                aria-label={`تخصیص ${row.title}`}
                                checked={members.includes(row.id)}
                                onChange={(e) =>
                                  toggle(row.id, e.target.checked)
                                }
                              />
                              <button
                                type="button"
                                className="flex-1 text-start"
                                onClick={() => {
                                  setActiveAccount(row.id);
                                  setTypeId('');
                                  setDetailSearchType('');
                                }}
                              >
                                {row.code} — {row.title}
                              </button>
                            </div>
                          ))
                      )}
                    </div>
                    {kind === 'account' ? (
                      <fieldset className="rounded border p-3 space-y-2">
                        <legend>تخصیص حساب تفصیلی</legend>
                        <div className="flex gap-2">
                          <select
                            aria-label="نوع تفصیلی تخصیص حساب"
                            className="border rounded p-2 flex-1"
                            value={typeId}
                            onChange={(e) => setTypeId(e.target.value)}
                          >
                            <option value="">انتخاب نوع تفصیلی...</option>
                            {allocationTypes.map((row) => (
                              <option key={row.id} value={row.id}>
                                {row.title}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={!typeId}
                            onClick={() => setDetailSearchType(typeId)}
                          >
                            جستجو
                          </Button>
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr>
                              <th></th>
                              <th>کد</th>
                              <th>عنوان</th>
                            </tr>
                          </thead>
                          <tbody>
                            {book.details
                              .filter(
                                (row) =>
                                  row.typeId === detailSearchType && row.active,
                              )
                              .map((row) => (
                                <tr key={row.id}>
                                  <td>
                                    <input
                                      type="checkbox"
                                      aria-label={`تخصیص تفصیلی ${row.title}`}
                                      checked={detailAllocations.some(
                                        (item) =>
                                          item.accountId === activeAccount &&
                                          item.detailId === row.id,
                                      )}
                                      onChange={(e) => {
                                        if (e.target.checked)
                                          toggle(activeAccount, true);
                                        setDetailAllocations((old) =>
                                          e.target.checked
                                            ? [
                                                ...old,
                                                {
                                                  accountId: activeAccount,
                                                  detailId: row.id,
                                                },
                                              ]
                                            : old.filter(
                                                (item) =>
                                                  !(
                                                    item.accountId ===
                                                      activeAccount &&
                                                    item.detailId === row.id
                                                  ),
                                              ),
                                        );
                                      }}
                                    />
                                  </td>
                                  <td>{row.code}</td>
                                  <td>{row.title}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </fieldset>
                    ) : null}
                  </div>
                  {kind === 'detail' ? (
                    <Button
                      type="button"
                      aria-label="اضافه"
                      title="اضافه"
                      onClick={() => {
                        setMembers((old) => [
                          ...new Set([...old, ...pendingMembers]),
                        ]);
                        setPendingMembers([]);
                      }}
                    >
                      <Plus className="size-4" />
                    </Button>
                  ) : null}
                  {kind === 'detail' ? (
                    <fieldset className="rounded border p-2">
                      <legend>حسابهای تفصیلی تخصیص یافته</legend>
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            <th>کد</th>
                            <th>عنوان</th>
                          </tr>
                        </thead>
                        <tbody>
                          {book.details
                            .filter((row) => members.includes(row.id))
                            .map((row) => (
                              <tr key={row.id}>
                                <td>{row.code}</td>
                                <td>{row.title}</td>
                                <td>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    aria-label={`حذف تخصیص ${row.title}`}
                                    title="حذف تخصیص"
                                    onClick={() => toggle(row.id, false)}
                                  >
                                    <Minus className="size-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </fieldset>
                  ) : null}
                </fieldset>
              ) : null}
            </div>
            <div hidden={tab !== 'notes'}>
              <AccountingSetupNotes
                notes={notes}
                onChange={setNotes}
                book={book}
                record={
                  selected
                    ? {
                        id: selected.id,
                        entityType:
                          kind === 'account'
                            ? 'AccountingAccountGroup'
                            : 'AccountingDetailGroup',
                        title: selected.title,
                      }
                    : undefined
                }
              />
            </div>
            <AccountingSaveButtons busy={busy} />
          </form>
        ) : null}
      </div>
    </section>
  );
}
