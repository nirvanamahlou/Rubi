'use client';

import { tourPriceFields, type PackageTourPriceFieldV1 } from '@nora/contracts';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { MoneyInput } from '@/components/ui/money-input';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
const roles = [
  ...tourPriceFields().map(({ kind, title }) => ({ kind, title })),
  { kind: 'custom' as const, title: 'مبلغ هر پکیج اتاق' },
];

export function TourPriceFields({
  value,
  onChange,
  disabled = false,
}: {
  value: readonly PackageTourPriceFieldV1[];
  onChange: (value: PackageTourPriceFieldV1[]) => void;
  disabled?: boolean;
}) {
  function update(id: string, patch: Partial<PackageTourPriceFieldV1>) {
    onChange(
      value.map((field) => (field.id === id ? { ...field, ...patch } : field)),
    );
  }
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold">فیلدهای قیمت</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || value.length >= 50}
          onClick={() =>
            onChange([
              ...value,
              {
                id: globalThis.crypto.randomUUID(),
                title: '',
                kind: 'custom',
                amount: '0',
                currencyCode: 'IRR',
                mode: 'fixed',
              },
            ])
          }
        >
          <Plus className="size-4" /> افزودن فیلد قیمت
        </Button>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {value.map((field, index) => (
          <div
            key={field.id}
            className="grid grid-cols-[minmax(0,1fr)_5rem_2.5rem] items-end gap-3 rounded-xl border border-border p-3"
          >
            <label className="col-span-full grid gap-2 text-sm font-bold">
              نام فیلد
              <NativeSearchSelect
                aria-label={`نوع فیلد قیمت ${index + 1}`}
                disabled={disabled}
                value={field.kind}
                onChange={(event) => {
                  const role = roles.find(role => role.kind === event.target.value);
                  if (!role || (role.kind !== 'custom' && value.some(row => row.id !== field.id && row.kind === role.kind))) return;
                  update(field.id, { kind: role.kind, title: role.title, mode: role.kind === 'commission' ? field.mode : 'fixed' });
                }}
              >
                {roles.map(role => <option key={role.kind} value={role.kind} disabled={role.kind !== 'custom' && value.some(row => row.id !== field.id && row.kind === role.kind)}>{role.title}</option>)}
              </NativeSearchSelect>
            </label>
            {field.kind === 'custom' && <label className="col-span-full grid gap-2 text-sm">
              نام فیلد
              <Input aria-label={`نام فیلد قیمت ${index + 1}`} maxLength={120} disabled={disabled} value={field.title} onChange={event => update(field.id, { title: event.target.value })} />
            </label>}
            <label className="grid gap-2 text-sm font-bold">
              {field.mode === 'percent' ? 'درصد' : 'مبلغ'}
              <MoneyInput
                aria-label={`مبلغ ${field.title || index + 1}`}
                disabled={disabled}
                value={field.amount}
                onValueChange={(amount) => update(field.id, { amount })}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              {field.mode === 'percent' ? 'نوع کمیسیون' : 'ارز'}
              {field.mode === 'percent' ? (
                <NativeSearchSelect
                  aria-label="نوع کمیسیون"
                  disabled={disabled}
                  value={field.mode}
                  onChange={(event) =>
                    update(field.id, {
                      mode: event.target.value as 'fixed' | 'percent',
                    })
                  }
                >
                  <option value="percent">درصدی</option>
                  <option value="fixed">مبلغ ثابت</option>
                </NativeSearchSelect>
              ) : (
                <Input
                  aria-label={`ارز ${field.title || index + 1}`}
                  dir="ltr"
                  maxLength={3}
                  placeholder="IRR"
                  disabled={disabled}
                  value={field.currencyCode}
                  onChange={(event) =>
                    update(field.id, {
                      currencyCode: event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z]/g, ''),
                    })
                  }
                />
              )}
            </label>
            <Button
              aria-label={`حذف فیلد ${field.title || index + 1}`}
              className="size-10 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() =>
                onChange(value.filter((row) => row.id !== field.id))
              }
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
            {field.kind === 'commission' && field.mode === 'fixed' ? (
              <label className="grid gap-2 text-sm col-span-full">
                نوع کمیسیون
                <NativeSearchSelect
                  aria-label="نوع کمیسیون"
                  disabled={disabled}
                  value={field.mode}
                  onChange={(event) =>
                    update(field.id, {
                      mode: event.target.value as 'fixed' | 'percent',
                    })
                  }
                >
                  <option value="percent">درصدی</option>
                  <option value="fixed">مبلغ ثابت</option>
                </NativeSearchSelect>
              </label>
            ) : null}
            {field.kind === 'custom' ? (
              <span className="col-span-full text-xs text-muted-foreground">
                مبلغ هر پکیج اتاق
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
