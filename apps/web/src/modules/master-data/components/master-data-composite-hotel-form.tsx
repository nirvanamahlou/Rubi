'use client';

import { useRef, useState, type FormEvent } from 'react';
import type { MasterDataRecord } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { Alert } from '@/components/ui/surfaces';
import { masterDataApi } from '../api/client';
import { getMasterDataDefinition } from '../model/catalog';
import {
  compositeHotelRows,
  compositeHotelValues,
} from '../model/composite-hotel-form';
import { MasterDataProfileDialog } from './master-data-profile-dialog';
import { MasterDataReferenceSelector } from './master-data-reference-selector';
import { MasterDataLiveForm } from './master-data-live-form';

export function MasterDataCompositeHotelForm({
  record,
  mode,
  onOpenChange,
  onPersist,
}: {
  record?: MasterDataRecord;
  mode: 'create' | 'edit' | 'view';
  onOpenChange: (open: boolean) => void;
  onPersist: (values: Record<string, string>) => Promise<void>;
}) {
  const [name, setName] = useState(record?.name ?? '');
  const [rows, setRows] = useState(() => compositeHotelRows(record));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const [adding, setAdding] = useState<{ key: string; cityId: string } | null>(
    null,
  );
  const pending = useRef(false);
  const sequence = useRef(0);
  const readonly = mode === 'view';
  const disabled = readonly || saving;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || pending.current) return;
    setError('');
    try {
      const values = compositeHotelValues(name, rows);
      pending.current = true;
      setSaving(true);
      await onPersist(values);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ذخیره انجام نشد.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  return (
    <>
      <MasterDataProfileDialog
        open
        title={
          readonly
            ? 'مشخصات هتل ترکیبی'
            : mode === 'edit'
              ? 'ویرایش هتل ترکیبی'
              : 'ایجاد هتل ترکیبی'
        }
        onOpenChange={(open) => {
          if (!pending.current) onOpenChange(open);
        }}
      >
        <form className="space-y-5" onSubmit={(event) => void submit(event)}>
          <FormField id="composite-name" label="عنوان" required>
            <Input
              id="composite-name"
              value={name}
              maxLength={160}
              disabled={disabled}
              required
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>
          {rows.map((row, index) => (
            <fieldset
              key={row.key}
              className="space-y-3 rounded-xl border p-4"
              disabled={disabled}
            >
              <legend className="px-2">اقامت {index + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <MasterDataReferenceSelector
                  id={`city-${row.key}`}
                  label="شهر"
                  config={{ target: 'cities', payload: 'id' }}
                  value={row.cityId}
                  disabled={disabled}
                  required
                  onChange={(cityId) =>
                    setRows((current) =>
                      current.map((item) =>
                        item.key === row.key
                          ? { ...item, cityId, hotelId: '' }
                          : item,
                      ),
                    )
                  }
                />
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <MasterDataReferenceSelector
                      id={`hotel-${row.key}`}
                      label="هتل"
                      config={{
                        target: 'hotels',
                        payload: 'id',
                        scopeField: 'cityId',
                      }}
                      scopeValue={row.cityId}
                      value={row.hotelId}
                      refreshKey={revision}
                      disabled={disabled || !row.cityId}
                      required
                      onChange={(hotelId) =>
                        setRows((current) =>
                          current.map((item) =>
                            item.key === row.key ? { ...item, hotelId } : item,
                          ),
                        )
                      }
                    />
                  </div>
                  {!readonly && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={disabled || !row.cityId}
                      onClick={() =>
                        setAdding({ key: row.key, cityId: row.cityId })
                      }
                    >
                      افزودن هتل
                    </Button>
                  )}
                </div>
              </div>
              {!readonly && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled || rows.length === 1}
                  onClick={() =>
                    setRows((current) =>
                      current.filter((item) => item.key !== row.key),
                    )
                  }
                >
                  حذف اقامت {index + 1}
                </Button>
              )}
            </fieldset>
          ))}
          {!readonly && (
            <Button
              type="button"
              variant="outline"
              disabled={disabled || rows.length >= 50}
              onClick={() =>
                setRows((current) => [
                  ...current,
                  { key: `new-${++sequence.current}`, cityId: '', hotelId: '' },
                ])
              }
            >
              افزودن شهر و هتل
            </Button>
          )}
          {error && <Alert title={error} tone="error" />}
          <div className="flex gap-2">
            {!readonly && (
              <Button type="submit" disabled={saving}>
                {saving ? 'در حال ذخیره…' : 'ذخیره'}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              بستن
            </Button>
          </div>
        </form>
      </MasterDataProfileDialog>
      {adding && (
        <MasterDataLiveForm
          key={adding.key}
          definition={getMasterDataDefinition('hotels')!}
          mode="create"
          open
          initialValues={{ cityId: adding.cityId }}
          lockedFields={['cityId']}
          onOpenChange={(open) => {
            if (!open) setAdding(null);
          }}
          onPersist={async (values, logoChange) => {
            const response = await masterDataApi.persistWithLogo({
              resource: 'hotels',
              values,
              title: 'هتل',
              ...(logoChange ? { logoChange } : {}),
            });
            setRows((current) =>
              current.map((row) =>
                row.key === adding.key && row.cityId === adding.cityId
                  ? { ...row, hotelId: response.data.id }
                  : row,
              ),
            );
            setRevision((current) => current + 1);
            setError(response.warning ?? '');
            setAdding(null);
          }}
        />
      )}
    </>
  );
}
