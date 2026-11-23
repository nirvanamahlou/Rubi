'use client';

import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  AccountingConfigurationV1,
  MasterDataListQuery,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { masterDataApi } from '@/modules/master-data/api/client';
import type { PersistedEditorRun } from './accounting-persisted-editor';

export function BankAccountTypeDialog({
  initial,
  run,
  onSaved,
  onClose,
}: {
  initial?: AccountingConfigurationV1 | undefined;
  run: PersistedEditorRun;
  onSaved: (row: AccountingConfigurationV1) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [hasCheckbook, setHasCheckbook] = useState(
    initial?.attributes.hasCheckbook === true,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);

  async function save() {
    if (pending.current) return;
    if (!title.trim()) {
      setError('نام نوع حساب بانکی را وارد کنید.');
      return;
    }
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      const row = await run<AccountingConfigurationV1>(
        'save-configuration',
        {
          kind: 'bank-account-types',
          ...(initial
            ? {
                id: initial.id,
                code: initial.code,
                titleEn: initial.titleEn,
                description: initial.description,
              }
            : {}),
          title: title.trim(),
          active: initial?.active ?? true,
          attributes: { hasCheckbook },
        },
        initial?.version,
      );
      if (row) onSaved(row);
      else setError('ذخیره نوع حساب ناموفق بود.');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'ذخیره نوع حساب ناموفق بود.',
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <DialogContent dir="rtl" aria-describedby={undefined}>
        <DialogTitle>
          {initial ? 'ویرایش نوع حساب بانکی' : 'تعریف نوع حساب بانکی'}
        </DialogTitle>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <FormField id="bank-account-type-title" label="نام" required>
            <Input
              id="bank-account-type-title"
              value={title}
              maxLength={160}
              required
              disabled={saving}
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormField>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hasCheckbook}
              disabled={saving}
              onChange={(event) => setHasCheckbook(event.target.checked)}
            />
            دسته چک دارد
          </label>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              ذخیره نوع حساب
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
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

export const rialDefaults = {
  code: 'IRR',
  name: 'ریال',
  englishName: 'Rial',
  symbol: 'ریال',
  decimalDigits: '0',
};
const rialQuery: MasterDataListQuery = {
  search: 'IRR',
  status: 'all',
  sortBy: 'code',
  sortDirection: 'asc',
  page: 1,
  pageSize: 30,
};

export function BankRialDialog({
  catalogueAccess,
  canCreate,
  onSelected,
  onClose,
}: {
  catalogueAccess: boolean;
  canCreate: boolean;
  onSelected: () => void;
  onClose: () => void;
}) {
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['accounting', 'bank-title-rial', catalogueAccess],
    queryFn: () =>
      masterDataApi.list(
        'currencies',
        rialQuery,
        catalogueAccess ? undefined : 'accounting',
      ),
    staleTime: 0,
  });
  const record = query.data?.data.find((row) => row.code === rialDefaults.code);
  const inactive = record?.status === 'inactive';

  async function accept() {
    if (!query.isSuccess || query.isFetching || pending.current || inactive)
      return;
    if (record) {
      onSelected();
      return;
    }
    if (!canCreate) return;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      await masterDataApi.create('currencies', { values: rialDefaults });
      onSelected();
    } catch (cause) {
      // A concurrent authorized create can complete between the lookup and the write.
      const latest = await query.refetch();
      if (
        latest.data?.data.some(
          (row) => row.code === 'IRR' && row.status === 'active',
        )
      )
        onSelected();
      else
        setError(
          cause instanceof Error ? cause.message : 'ذخیره ارز ناموفق بود.',
        );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const field = (key: string, label: string, value: string) => (
    <FormField id={'bank-rial-' + key} label={label}>
      <Input id={'bank-rial-' + key} value={value} readOnly />
    </FormField>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <DialogContent
        dir="rtl"
        aria-describedby={undefined}
        className="max-h-[90vh] max-w-3xl overflow-auto"
      >
        <DialogTitle>ارز (ریال)</DialogTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-3">
            {field('name', 'عنوان', record?.name ?? rialDefaults.name)}
            {field(
              'englishName',
              'عنوان به زبان دوم',
              String(
                record?.attributes.englishName ?? rialDefaults.englishName,
              ),
            )}
            {field('unit', 'واحد مبادله', '1')}
            {field('rounding', 'روش گرد کردن', 'گرد کردن اتوماتیک')}
            {field('code', 'حروف اختصاری', rialDefaults.code)}
          </div>
          <div className="space-y-3">
            {field('minor', 'عنوان واحد فرعی', '')}
            {field('minorEn', 'عنوان واحد فرعی به زبان دوم', '')}
            {field(
              'digits',
              'تعداد ارقام اعشار',
              String(
                record?.attributes.decimalDigits ?? rialDefaults.decimalDigits,
              ),
            )}
            {field(
              'symbol',
              'علامت',
              String(record?.attributes.symbol ?? rialDefaults.symbol),
            )}
          </div>
        </div>
        {query.isFetching && <p role="status">در حال دریافت…</p>}
        {(error || query.error) && (
          <p role="alert" className="text-destructive">
            {error || query.error?.message}
          </p>
        )}
        {inactive && <p role="alert">ارز ریال در اطلاعات پایه غیرفعال است.</p>}
        {query.isSuccess && !record && !canCreate && (
          <p role="status">ریال برای انتخاب در دسترس نیست.</p>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={
              !query.isSuccess ||
              query.isFetching ||
              saving ||
              inactive ||
              (!record && !canCreate)
            }
            onClick={() => void accept()}
          >
            {record ? 'انتخاب ریال' : 'ثبت و انتخاب ریال'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
          >
            انصراف
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
