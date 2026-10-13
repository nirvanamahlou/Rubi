'use client';
import {
  AccountingSetupNotes,
  parseSetupNotes,
} from './accounting-setup-notes';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  AccountingDetailTypeConversionV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import {
  AccountingButton as Button,
  AccountingSaveButtons,
  accountingSaveDisposition,
} from './accounting-operations';
import type { PersistedEditorRun } from './accounting-persisted-editor';

const entities: Record<string, string> = {
  شخص: 'شخص/شرکت',
  شرکت: 'شخص/شرکت',
  شعبه: 'شعبه',
  'مرکز هزینه': 'مرکز هزینه',
  پروژه: 'پروژه',
  'منبع تامین اعتبار': 'منبع تأمین اعتبار',
  'دوره مالی': 'دوره مالی',
};
export function AccountingDetailConversion({
  book,
  run,
  busy,
}: {
  book: AccountingSnapshotV1;
  run: PersistedEditorRun;
  busy: boolean;
}) {
  const router = useRouter(),
    params = useSearchParams();
  const [selected, setSelected] = useState(
    () =>
      book.detailConversions?.find((row) => row.id === params.get('id')) ??
      null,
  );
  const [userTypeId, setUserType] = useState(selected?.userTypeId ?? ''),
    [systemTypeId, setSystemType] = useState(selected?.systemTypeId ?? ''),
    [description, setDescription] = useState(selected?.description ?? '');
  const [tab, setTab] = useState('main'),
    [notes, setNotes] = useState(() => parseSetupNotes(selected?.notes));
  const types = book.configurations.filter(
    (row) => row.kind === 'detail-types' && row.active,
  );
  const entity =
    entities[types.find((row) => row.id === systemTypeId)?.title ?? ''] ?? '';
  const fresh = () => {
    setSelected(null);
    setUserType('');
    setSystemType('');
    setDescription('');
    setNotes([]);
    setTab('main');
  };
  const close = () =>
    router.push(
      `/finance/accounting/general-ledger/accounts/lists/detail-type-converters?bookId=${book.book.id}`,
    );
  const readOnly = selected?.state === 'CONVERTED';
  return (
    <section dir="rtl" className="@container space-y-3">
      <Button onClick={fresh}>جدید</Button>
      {(['new', 'close'] as const).map((after) => (
        <Button
          key={after}
          disabled={busy || !selected || readOnly}
          permission="finance.account.manage"
          onClick={() => {
            if (!selected || !window.confirm('تعریف تبدیل انتخاب‌شده حذف شود؟'))
              return;
            void run(
              'delete-detail-type-conversion',
              { id: selected.id },
              selected.version,
            ).then((result) => {
              if (!result) return;
              fresh();
              if (after === 'close') close();
            });
          }}
        >
          {after === 'new' ? 'حذف و جدید' : 'حذف و بستن'}
        </Button>
      ))}
      <div className="flex justify-between border-b pb-2">
        <h2 className="font-bold">مبدل نوع تفصیل</h2>
        <Button variant="outline" onClick={close}>
          فهرست
        </Button>
      </div>
      <form
        className="space-y-4 rounded-lg border bg-muted/15 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const after = accountingSaveDisposition(event);
          void run<AccountingDetailTypeConversionV1>(
            'save-detail-type-conversion',
            {
              userTypeId,
              systemTypeId,
              notes,
              description,
              ...(selected ? { id: selected.id } : {}),
            },
            selected?.version,
          ).then((saved) => {
            if (!saved) return;
            setSelected(saved);
            setNotes(parseSetupNotes(saved.notes));
            if (after === 'new') fresh();
            if (after === 'close') close();
          });
        }}
      >
        <div role="tablist" className="flex gap-4 border-b pb-2">
          {[
            ['main', 'اطلاعات اصلی'],
            ['notes', 'یادداشت'],
          ].map(([key, title]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? 'font-semibold text-primary' : ''}
              onClick={() => setTab(key!)}
            >
              {title}
            </button>
          ))}
        </div>
        <div hidden={tab !== 'main'} className="space-y-4">
          <div className="grid items-start gap-4 @min-[40rem]:grid-cols-2">
            <div className="space-y-4">
              <FormField label="نوع تفصیلی کاربر">
                <SearchCombobox
                  label="نوع تفصیلی کاربر"
                  disabled={readOnly}
                  value={userTypeId}
                  onValueChange={setUserType}
                  options={types
                    .filter((row) => row.attributes.isSystem !== true)
                    .map((row) => ({ value: row.id, label: row.title }))}
                />
              </FormField>
              <FormField label="نوع تفصیلی سیستم">
                <SearchCombobox
                  label="نوع تفصیلی سیستم"
                  disabled={readOnly}
                  value={systemTypeId}
                  onValueChange={setSystemType}
                  options={types
                    .filter((row) => row.attributes.isSystem === true)
                    .map((row) => ({ value: row.id, label: row.title }))}
                />
              </FormField>
              <FormField label="موجودیت">
                <Input aria-label="موجودیت" disabled value={entity} />
              </FormField>
            </div>
            <FormField label="تاریخ">
              <Input
                aria-label="تاریخ"
                disabled
                value={selected?.date ?? new Date().toISOString().slice(0, 10)}
              />
            </FormField>
          </div>
          <FormField label="توضیحات">
            <Textarea
              aria-label="توضیحات"
              disabled={readOnly}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
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
                    entityType: 'AccountingDetailTypeConversion',
                    title: 'مبدل نوع تفصیل',
                  }
                : undefined
            }
          />
        </div>
        <AccountingSaveButtons
          busy={busy || readOnly || !userTypeId || !entity}
        />
      </form>
    </section>
  );
}
