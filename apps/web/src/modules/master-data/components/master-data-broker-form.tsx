'use client';

import { useRef, useState, type FormEvent } from 'react';
import type { MasterDataRecord } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { MasterDataProfileDialog } from './master-data-profile-dialog';
import { MasterDataReferenceSelector } from './master-data-reference-selector';
import {
  brokerFormValues,
  brokerLeaderValues,
  brokerMutationValues,
} from '../model/broker-form';

export function MasterDataBrokerForm({
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
  const [values, setValues] = useState(() => brokerFormValues(record));
  const [leaders, setLeaders] = useState(() => brokerLeaderValues(record));
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const leaderSequence = useRef(0);
  const disabled = saving || mode === 'view';
  function change(key: string, value: string) {
    setValues((current) => ({
      ...current,
      [key]: value,
      ...(key === 'countryId' ? { cityIds: '' } : {}),
    }));
    if (key === 'primaryPhone') setPhoneTouched(true);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || pending.current) return;
    if (
      !String(values.name ?? '').trim() ||
      !values.countryId ||
      !values.cityIds
    ) {
      setError('نام فارسی، کشور و حداقل یک شهر را وارد کنید.');
      return;
    }
    if (
      leaders.some(
        (l) => !l.name.trim() || ((!l.id || l.phoneTouched) && !l.phone.trim()),
      )
    ) {
      setError('نام و شماره هر تورلیدر را وارد کنید.');
      return;
    }
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      await onPersist(
        brokerMutationValues(values, leaders, record, phoneTouched),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره کارگزار انجام نشد.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  if (mode === 'view')
    return (
      <MasterDataProfileDialog
        open
        title="مشخصات کارگزار"
        onOpenChange={onOpenChange}
      >
        <dl className="grid gap-3">
          {[
            ['نام فارسی کارگزار', record?.name],
            ['نام انگلیسی کارگزار', values.englishName],
            ['شماره کارگزار', record?.attributes.primaryPhoneMasked],
            ['Board', values.boardText],
            ['کشور', record?.attributes.countryName],
            ['شهرهای فعالیت', record?.attributes.cityNames],
            ...leaders.map((l) => [l.name, l.phoneMasked]),
          ].map(([label, value], index) => (
            <div key={index}>
              <dt className="font-semibold">{label}</dt>
              <dd>{value || '—'}</dd>
            </div>
          ))}
        </dl>
      </MasterDataProfileDialog>
    );
  return (
    <MasterDataProfileDialog
      open
      title={
        mode === 'create'
          ? 'کارگزار جدید'
          : mode === 'edit'
            ? 'ویرایش کارگزار'
            : 'مشخصات کارگزار'
      }
      onOpenChange={(open) => {
        if (!pending.current) onOpenChange(open);
      }}
    >
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        {error ? (
          <p role="alert" className="text-danger">
            {error}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['name', 'نام فارسی کارگزار', 160],
            ['englishName', 'نام انگلیسی کارگزار', 160],
            ['primaryPhone', 'شماره کارگزار', 80],
            ['boardText', 'متن تابلوی استقبال فرودگاه (Board)', 300],
          ].map(([key, label, max]) => (
            <label className="grid gap-2" key={String(key)}>
              {label}
              <Input
                id={`live-brokers-${key}`}
                disabled={disabled}
                dir={
                  key === 'primaryPhone' || key === 'englishName'
                    ? 'ltr'
                    : undefined
                }
                maxLength={Number(max)}
                value={values[String(key)] ?? ''}
                placeholder={
                  key === 'primaryPhone'
                    ? String(record?.attributes.primaryPhoneMasked ?? '')
                    : ''
                }
                required={key === 'name'}
                onChange={(e) => change(String(key), e.target.value)}
              />
            </label>
          ))}
          <label className="grid gap-2">
            کشور
            <MasterDataReferenceSelector
              id="broker-country"
              label="کشور"
              config={{ target: 'countries', payload: 'id' }}
              disabled={disabled}
              value={values.countryId ?? ''}
              onChange={(value) => change('countryId', value)}
            />
          </label>
          <label className="grid gap-2">
            شهرهای فعالیت
            <MasterDataReferenceSelector
              id="broker-cities"
              label="شهرهای فعالیت"
              config={{
                target: 'cities',
                payload: 'id',
                multiple: true,
                scopeField: 'countryId',
              }}
              scopeValue={values.countryId ?? ''}
              disabled={disabled || !values.countryId}
              value={values.cityIds ?? ''}
              onChange={(value) => change('cityIds', value)}
            />
          </label>
        </div>
        <section className="space-y-3 rounded-xl border border-border p-3">
          <h3 className="font-semibold">تورلیدرهای کارگزار</h3>
          {leaders.map((leader, index) => (
            <div
              className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
              key={leader.key}
            >
              <label>
                نام تورلیدر {index + 1}
                <Input
                  disabled={disabled}
                  required
                  maxLength={160}
                  value={leader.name}
                  onChange={(e) =>
                    setLeaders((current) =>
                      current.map((l) =>
                        l.key === leader.key
                          ? { ...l, name: e.target.value }
                          : l,
                      ),
                    )
                  }
                />
              </label>
              <label>
                شماره تورلیدر {index + 1}
                <Input
                  disabled={disabled}
                  dir="ltr"
                  type="tel"
                  maxLength={80}
                  required={!leader.id}
                  value={leader.phone}
                  placeholder={leader.phoneMasked}
                  onChange={(e) =>
                    setLeaders((current) =>
                      current.map((l) =>
                        l.key === leader.key
                          ? { ...l, phone: e.target.value, phoneTouched: true }
                          : l,
                      ),
                    )
                  }
                />
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() =>
                  setLeaders((current) =>
                    current.filter((l) => l.key !== leader.key),
                  )
                }
              >
                حذف تورلیدر
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={disabled || leaders.length >= 100}
            onClick={() => {
              const key = `new-${++leaderSequence.current}`;
              setLeaders((current) => [
                ...current,
                {
                  key,
                  name: '',
                  phone: '',
                  phoneMasked: '',
                  phoneTouched: false,
                },
              ]);
            }}
          >
            افزودن تورلیدر
          </Button>
        </section>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            بستن
          </Button>
          <Button type="submit" loading={saving}>
            ثبت کارگزار
          </Button>
        </div>
      </form>
    </MasterDataProfileDialog>
  );
}
