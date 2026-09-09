'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type {
  IamPermissionCode,
  MasterOrganizationAddressMutationV1,
  MasterOrganizationAddressV1,
} from '@rubi/contracts';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form-controls';
import { masterDataApi } from '@/modules/master-data/api/client';
import { MasterDataReferenceSelector } from '@/modules/master-data/components/master-data-reference-selector';
import { DossierFormDialog } from './dossier-form-dialog';

const emptyAddress = (): MasterOrganizationAddressMutationV1 => ({
  countryId: '',
  cityId: '',
  label: '',
  postalCode: '',
  addressLine: '',
  isPrimary: false,
  isActive: true,
  displayOrder: 0,
});

export function OrganizationAddressesPanel({
  organizationId,
  permissions,
  presentation = 'cards',
}: {
  organizationId: string;
  permissions: readonly IamPermissionCode[];
  presentation?: 'cards' | 'selector';
}) {
  const selectorId = useId();
  const [selectedId, setSelectedId] = useState('');
  const [rows, setRows] = useState<readonly MasterOrganizationAddressV1[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<{
    id?: string;
    values: MasterOrganizationAddressMutationV1;
  }>();
  const [deleting, setDeleting] = useState<MasterOrganizationAddressV1>();
  const sequence = useRef(0);
  const invalidate = useCallback(() => {
    ++sequence.current;
  }, []);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    setError('');
    try {
      const result = await masterDataApi.organizationAddresses(organizationId);
      if (request === sequence.current) setRows(result.data);
    } catch (caught) {
      if (request === sequence.current) {
        setRows([]);
        setError(
          caught instanceof Error ? caught.message : 'دریافت شعب ناموفق بود.',
        );
      }
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [organizationId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      invalidate();
    };
  }, [load, invalidate]);
  const change = (patch: Partial<MasterOrganizationAddressMutationV1>) =>
    setEditor((current) =>
      current
        ? { ...current, values: { ...current.values, ...patch } }
        : current,
    );
  const close = () => {
    setEditor(undefined);
    setDeleting(undefined);
    void load();
  };
  const selected =
    rows.find((row) => row.id === selectedId) ??
    rows.find((row) => row.isActive && row.isPrimary) ??
    rows.find((row) => row.isActive) ??
    rows[0];
  const visibleRows =
    presentation === 'selector' ? (selected ? [selected] : []) : rows;
  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2 className="panel-title">
            <MapPin size={20} />
            {presentation === 'selector'
              ? 'شعب آژانس طرف همکاری'
              : 'شعب و آدرس‌های سازمان'}
          </h2>
          <p className="panel-note">
            {rows.length.toLocaleString('fa-IR')} آدرس ثبت‌شده
          </p>
        </div>
        <Button
          disabled={!permissions.includes('master_data.update')}
          onClick={() =>
            setEditor({
              values: { ...emptyAddress(), isPrimary: rows.length === 0 },
            })
          }
        >
          <Plus className="size-4" />
          ثبت شعبه یا آدرس
        </Button>
      </header>
      <div className="panel-body space-y-3">
        {loading ? <p role="status">در حال دریافت شعب…</p> : null}
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
        {!loading && !rows.length ? (
          <p>
            هنوز آدرسی ثبت نشده است. از دکمه «ثبت شعبه یا آدرس» استفاده کنید.
          </p>
        ) : null}
        {presentation === 'selector' && rows.length > 0 ? (
          <label className="field" htmlFor={selectorId}>
            شعبه آژانس
            <select
              id={selectorId}
              className="input"
              value={selected?.id ?? ''}
              disabled={loading}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label} · {row.cityName}
                  {row.isPrimary ? ' · اصلی' : ''}
                  {!row.isActive ? ' · غیرفعال' : ''}
                </option>
              ))}
            </select>
            <span className="panel-note">
              برای مشاهده نشانی و اطلاعات هر شعبه، آن را انتخاب کنید. شعب جدید
              را با «ثبت شعبه یا آدرس» اضافه کنید.
            </span>
          </label>
        ) : null}
        {visibleRows.map((row) => (
          <article key={row.id} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold">
                {row.label}
                {row.isPrimary ? ' · آدرس اصلی' : ''}
                {!row.isActive ? ' · غیرفعال' : ''}
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!permissions.includes('master_data.update')}
                  onClick={() =>
                    setEditor({
                      id: row.id,
                      values: {
                        countryId: row.countryId,
                        cityId: row.cityId,
                        label: row.label,
                        postalCode: row.postalCode,
                        addressLine: row.addressLine,
                        isPrimary: row.isPrimary,
                        isActive: row.isActive,
                        displayOrder: row.displayOrder,
                        version: row.version,
                      },
                    })
                  }
                >
                  <Pencil className="size-4" />
                  ویرایش
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!permissions.includes('master_data.delete')}
                  onClick={() => setDeleting(row)}
                >
                  <Trash2 className="size-4" />
                  حذف دائمی
                </Button>
              </div>
            </div>
            <p className="mt-2">
              {row.countryName} · {row.cityName}
            </p>
            <p>{row.addressLine}</p>
            {row.postalCode ? (
              <p>
                کد پستی: <bdi>{row.postalCode}</bdi>
              </p>
            ) : null}
          </article>
        ))}
        <Button
          variant="outline"
          onClick={() => void load()}
          disabled={loading}
        >
          تازه‌سازی
        </Button>
      </div>
      {editor ? (
        <DossierFormDialog
          title={editor.id ? 'ویرایش شعبه و آدرس' : 'ثبت شعبه و آدرس'}
          description="آدرس به همین سازمان متصل می‌شود و در اطلاعات پایه هم در دسترس است."
          onClose={close}
          onSave={async () => {
            if (!editor.values.countryId || !editor.values.cityId)
              throw Object.assign(new Error('کشور و شهر را انتخاب کنید.'), {
                status: 400,
              });
            if (editor.id)
              await masterDataApi.updateOrganizationAddress(
                organizationId,
                editor.id,
                editor.values,
              );
            else {
              const created = await masterDataApi.createOrganizationAddress(
                organizationId,
                editor.values,
              );
              setSelectedId(created.data.id);
            }
          }}
        >
          <label className="field">
            نام شعبه یا عنوان آدرس
            <Input
              required
              maxLength={80}
              value={editor.values.label}
              onChange={(e) => change({ label: e.target.value })}
            />
          </label>
          <label className="field">
            کد پستی
            <Input
              maxLength={24}
              value={editor.values.postalCode ?? ''}
              onChange={(e) => change({ postalCode: e.target.value })}
            />
          </label>
          <div className="field">
            <label htmlFor="agency-address-country">کشور</label>
            <MasterDataReferenceSelector
              id="agency-address-country"
              label="کشور"
              config={{ target: 'countries', payload: 'id' }}
              value={editor.values.countryId}
              disabled={false}
              required
              onChange={(countryId) => change({ countryId, cityId: '' })}
            />
          </div>
          <div className="field">
            <label htmlFor="agency-address-city">شهر</label>
            <MasterDataReferenceSelector
              id="agency-address-city"
              label="شهر"
              config={{
                target: 'cities',
                payload: 'id',
                scopeField: 'countryId',
              }}
              scopeValue={editor.values.countryId}
              value={editor.values.cityId}
              disabled={!editor.values.countryId}
              required
              onChange={(cityId) => change({ cityId })}
            />
          </div>
          <label className="field sm:col-span-2">
            نشانی کامل
            <Textarea
              required
              maxLength={500}
              value={editor.values.addressLine}
              onChange={(e) => change({ addressLine: e.target.value })}
            />
          </label>
          <label className="field">
            ترتیب نمایش
            <Input
              type="number"
              min={0}
              max={2147483646}
              required
              value={editor.values.displayOrder ?? 0}
              onChange={(e) => change({ displayOrder: Number(e.target.value) })}
            />
          </label>
          <div className="space-y-3">
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={editor.values.isPrimary ?? false}
                onChange={(e) => change({ isPrimary: e.target.checked })}
              />
              آدرس اصلی
            </label>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={editor.values.isActive ?? true}
                onChange={(e) => change({ isActive: e.target.checked })}
              />
              فعال
            </label>
          </div>
        </DossierFormDialog>
      ) : null}
      {deleting ? (
        <DossierFormDialog
          title="حذف دائمی آدرس"
          description={`آدرس «${deleting.label}» برای همیشه از این پرونده حذف می‌شود.`}
          destructive
          onClose={close}
          onSave={async () => {
            await masterDataApi.deleteOrganizationAddress(
              organizationId,
              deleting.id,
              deleting.version,
            );
          }}
        >
          <p className="sm:col-span-2">
            این حذف قابل بازگردانی نیست. سایر اطلاعات آژانس باقی می‌ماند.
          </p>
        </DossierFormDialog>
      ) : null}
    </section>
  );
}
