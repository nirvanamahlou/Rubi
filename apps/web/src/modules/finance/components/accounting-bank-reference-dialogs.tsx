'use client';

import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bankInstitutionKinds, type MasterDataRecord } from '@nora/contracts';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { MasterDataReferenceSelector } from '@/modules/master-data/components/master-data-reference-selector';
import { masterDataApi } from '@/modules/master-data/api/client';

type Props = {
  onSaved: (row: MasterDataRecord) => void;
  onClose: () => void;
};

export function BankInstitutionDialog({ onSaved, onClose }: Props) {
  const [draft, setDraft] = useState({
    name: '',
    englishName: '',
    code: '',
    countryId: '',
    institutionKind: 'BANK',
    publicRelationsPhone: '',
    website: '',
    swiftCode: '',
    description: '',
    descriptionEn: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof typeof draft, value: string) =>
    setDraft((old) => ({ ...old, [key]: value }));
  const field = (
    key: keyof typeof draft,
    label: string,
    required = false,
    maxLength = 160,
  ) => (
    <FormField id={'bank-definition-' + key} label={label} required={required}>
      <Input
        id={'bank-definition-' + key}
        value={draft[key]}
        required={required}
        maxLength={maxLength}
        onChange={(e) => set(key, e.target.value)}
      />
    </FormField>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent
        dir="rtl"
        aria-describedby={undefined}
        className="max-h-[90vh] max-w-3xl overflow-auto"
      >
        <DialogTitle>تعریف بانک</DialogTitle>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (saving) return;
            if (!draft.countryId) {
              setError('کشور بانک را انتخاب کنید.');
              return;
            }
            setSaving(true);
            setError('');
            try {
              const values = Object.fromEntries(
                Object.entries(draft)
                  .filter(([, value]) => value.trim())
                  .map(([key, value]) => [key, value.trim()]),
              );
              if (!values.name || !values.code) {
                setError('نام و کد بانک الزامی است.');
                return;
              }
              onSaved((await masterDataApi.create('banks', { values })).data);
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'ذخیره بانک ناموفق بود.',
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-3">
              {field('name', 'نام', true)}
              {field('englishName', 'نام به زبان دوم')}
              <FormField id="bank-definition-kind" label="نوع بانک" required>
                <select
                  id="bank-definition-kind"
                  className="w-full rounded-md border bg-background p-2"
                  value={draft.institutionKind}
                  onChange={(e) => set('institutionKind', e.target.value)}
                >
                  {bankInstitutionKinds.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.label}
                    </option>
                  ))}
                </select>
              </FormField>
              {field('code', 'کد بانک', true, 32)}
              <FormField id="bank-definition-country" label="کشور" required>
                <MasterDataReferenceSelector
                  id="bank-definition-country"
                  disabled={saving}
                  label="کشور"
                  config={{ target: 'countries', payload: 'id' }}
                  value={draft.countryId}
                  onChange={(id) => set('countryId', id)}
                  required
                />
              </FormField>
            </div>
            <div className="space-y-3">
              {field('publicRelationsPhone', 'تلفن روابط عمومی', false, 80)}
              {field('website', 'وب‌سایت', false, 500)}
              {field('swiftCode', 'کد سوئیفت', false, 11)}
            </div>
          </div>
          <FormField id="bank-definition-description" label="شرح">
            <Textarea
              id="bank-definition-description"
              value={draft.description}
              maxLength={2000}
              onChange={(e) => set('description', e.target.value)}
            />
          </FormField>
          {field('descriptionEn', 'شرح به زبان دوم', false, 2000)}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              ذخیره بانک
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

export function BankBranchDialog({
  bankId,
  lockBank = false,
  onSaved,
  onClose,
}: Props & { bankId: string; lockBank?: boolean }) {
  const [draft, setDraft] = useState({
    bankId,
    cityId: '',
    name: '',
    englishName: '',
    code: '',
    swiftCode: '',
    phone: '',
    address: '',
    website: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const bank = useQuery({
    queryKey: ['accounting', 'bank-title-bank-record', draft.bankId],
    queryFn: () => masterDataApi.detail('banks', draft.bankId),
    enabled: !!draft.bankId,
  });
  const countryId = String(bank.data?.data.attributes.countryId ?? '');
  const field = (
    key: Exclude<keyof typeof draft, 'bankId' | 'cityId'>,
    label: string,
    maxLength: number,
    required = false,
  ) => (
    <FormField id={'new-bank-branch-' + key} label={label} required={required}>
      <Input
        id={'new-bank-branch-' + key}
        value={draft[key]}
        maxLength={maxLength}
        required={required}
        dir={key === 'swiftCode' || key === 'website' ? 'ltr' : 'auto'}
        onChange={(event) =>
          setDraft((old) => ({ ...old, [key]: event.target.value }))
        }
      />
    </FormField>
  );

  async function save() {
    if (pending.current) return;
    setError('');
    if (
      !draft.bankId ||
      !draft.cityId ||
      !draft.name.trim() ||
      !draft.code.trim()
    ) {
      setError('بانک، شهر، نام و کد شعبه را وارد کنید.');
      return;
    }
    pending.current = true;
    setSaving(true);
    try {
      const values = Object.fromEntries(
        Object.entries(draft)
          .map(([key, value]) => [key, value.trim()])
          .filter(([, value]) => value),
      );
      onSaved((await masterDataApi.create('bank-branches', { values })).data);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'ذخیره شعبه ناموفق بود.',
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
      <DialogContent
        dir="rtl"
        aria-describedby={undefined}
        className="max-h-[90vh] max-w-3xl overflow-auto"
      >
        <DialogTitle>تعریف شعبه بانک</DialogTitle>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset className="grid gap-3 sm:grid-cols-2" disabled={saving}>
            <div className="space-y-3">
              <FormField id="new-bank-branch-bank" label="نام بانک" required>
                <MasterDataReferenceSelector
                  id="new-bank-branch-bank"
                  label="نام بانک"
                  disabled={saving || lockBank}
                  config={{ target: 'banks', payload: 'id' }}
                  value={draft.bankId}
                  required
                  onChange={(id) =>
                    setDraft((old) =>
                      id === old.bankId
                        ? old
                        : { ...old, bankId: id, cityId: '' },
                    )
                  }
                />
              </FormField>
              {field('name', 'نام شعبه', 160, true)}
              {field('englishName', 'نام به زبان دوم', 160)}
              {field('code', 'کد شعبه', 32, true)}
              {field('swiftCode', 'کد سوئیفت', 11)}
            </div>
            <div className="space-y-3">
              <FormField id="new-bank-branch-city" label="شهر شعبه" required>
                <MasterDataReferenceSelector
                  id="new-bank-branch-city"
                  label="شهر شعبه"
                  disabled={saving || !countryId}
                  config={{
                    target: 'cities',
                    payload: 'id',
                    scopeField: 'countryId',
                  }}
                  scopeValue={countryId}
                  value={draft.cityId}
                  required
                  onChange={(id) => setDraft((old) => ({ ...old, cityId: id }))}
                />
              </FormField>
              {field('phone', 'تلفن', 32)}
              {field('address', 'نشانی', 500)}
              {field('website', 'وب‌سایت', 500)}
            </div>
          </fieldset>
          {(error || bank.error) && (
            <p role="alert" className="text-destructive">
              {error || bank.error?.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              ذخیره شعبه
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
