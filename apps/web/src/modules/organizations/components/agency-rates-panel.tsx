'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  B2bAgencyAgreedRateV1,
  B2bAgencyProfileDetailsV1,
  B2bAgreedRateKind,
  CreateB2bAgencyAgreedRateRequestV1,
} from '@rubi/contracts';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { MasterDataReferenceSelector } from '@/modules/master-data/components/master-data-reference-selector';
import { agencyClient } from '../api/agency-client';
import { moneyLabel } from '../model/presentation';
import { serviceLabels } from '../model/agreement-terms';
import { DossierFormDialog } from './dossier-form-dialog';
import { useDossierBranch } from './use-dossier-branch';
import { DossierDateFilters } from './dossier-date-filters';
import { inDossierDateRange } from '../model/dossier-date-range';
import { ratesReport } from '../model/commercial-export';
import { CommercialExportActions } from './commercial-export-actions';

const kindLabels: Record<B2bAgreedRateKind, string> = {
  FIXED_AMOUNT: 'نرخ توافقی',
  DISCOUNT_PERCENT: 'تخفیف',
  COMMISSION_PERCENT: 'پورسانت',
};
export function AgencyRatesPanel({
  organizationId,
  organizationName = organizationId,
  kind,
}: {
  organizationId: string;
  organizationName?: string;
  kind: B2bAgreedRateKind;
}) {
  const { branches, branchId, setBranchId, permissions, sessionError } =
    useDossierBranch();
  const [rows, setRows] = useState<readonly B2bAgencyAgreedRateV1[]>([]);
  const [profile, setProfile] =
    useState<B2bAgencyProfileDetailsV1['profile']>();
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [loading, setLoading] = useState(false);
  const [editor, setEditor] = useState<{
    row?: B2bAgencyAgreedRateV1;
    values: CreateB2bAgencyAgreedRateRequestV1;
  }>();
  const [deleting, setDeleting] = useState<B2bAgencyAgreedRateV1>();
  const [reason, setReason] = useState('');
  const sequence = useRef(0);
  const invalidate = useCallback(() => {
    ++sequence.current;
  }, []);
  const load = useCallback(async () => {
    if (!branchId) return;
    const current = ++sequence.current;
    setLoading(true);
    setError('');
    setRows([]);
    setProfile(undefined);
    const [rates, details] = await Promise.allSettled([
      agencyClient.rates(organizationId, branchId),
      agencyClient.profileDetails(organizationId, branchId),
    ]);
    if (current !== sequence.current) return;
    if (rates.status === 'fulfilled') setRows(rates.value.data);
    else {
      setRows([]);
      setError(
        rates.reason instanceof Error
          ? rates.reason.message
          : 'دریافت شرایط تجاری ناموفق بود.',
      );
    }
    setProfile(
      details.status === 'fulfilled' ? details.value.data.profile : undefined,
    );
    setLoading(false);
  }, [organizationId, branchId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      invalidate();
    };
  }, [load, invalidate]);
  const visible = rows.filter(
    (row) => row.kind === kind && inDossierDateRange(row.validFrom, dateRange),
  );
  const close = () => {
    setEditor(undefined);
    setDeleting(undefined);
    void load();
  };
  const change = (patch: Partial<CreateB2bAgencyAgreedRateRequestV1>) =>
    setEditor((current) =>
      current
        ? { ...current, values: { ...current.values, ...patch } }
        : current,
    );
  const create = () =>
    setEditor({
      values: {
        branchId,
        kind,
        title: '',
        serviceReference: 'FLIGHT',
        value: '',
        currencyCode: kind === 'FIXED_AMOUNT' ? 'IRR' : null,
        validFrom: new Date().toISOString().slice(0, 10),
        validTo: null,
        isActive: profile?.status === 'ACTIVE',
      },
    });
  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2 className="panel-title">{kindLabels[kind]}</h2>
          <p className="panel-note">
            {visible.length.toLocaleString('fa-IR')} مورد ثبت‌شده
          </p>
        </div>
        <Button
          disabled={
            !branchId || loading || !permissions.includes('b2b.rate.manage')
          }
          onClick={create}
        >
          <Plus className="size-4" />
          ثبت {kindLabels[kind]}
        </Button>
      </header>
      <div className="panel-body space-y-4">
        <div className="dossier-filter-grid">
          <label className="field">
            شعبه روبی
            <select
              className="input"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <DossierDateFilters
            value={dateRange}
            onChange={setDateRange}
            basis="شروع اعتبار نرخ"
          />
        </div>
        <div className="flex justify-end">
          <CommercialExportActions
            key={`${organizationId}:${branchId}:${kind}:${dateRange.from}:${dateRange.to}`}
            disabled={
              loading ||
              !!sessionError ||
              !!error ||
              !branchId ||
              !permissions.includes('b2b.rate.read') ||
              !!(
                dateRange.from &&
                dateRange.to &&
                dateRange.from > dateRange.to
              )
            }
            loadReport={async () => {
              const result = await agencyClient.rates(organizationId, branchId);
              return ratesReport(result.data, kind, dateRange, [
                `سازمان: ${organizationName}`,
                `شعبه: ${branches.find((b) => b.id === branchId)?.name ?? branchId}`,
              ]);
            }}
          />
        </div>
        {sessionError || error ? (
          <p role="alert" className="form-error">
            {sessionError || error}
          </p>
        ) : null}
        {loading ? (
          <p role="status">در حال دریافت شرایط تجاری…</p>
        ) : !visible.length ? (
          <p>هنوز {kindLabels[kind]} ثبت نشده است.</p>
        ) : null}
        {profile?.status !== 'ACTIVE' ? (
          <p className="boundary-note">
            شرایط تجاری تا فعال‌شدن پروفایل، به‌صورت پیش‌نویس ذخیره می‌شود.
          </p>
        ) : null}
        {visible.map((row) => (
          <article className="rounded-xl border border-border p-4" key={row.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold">
                {row.title}{' '}
                <span className="badge neutral">
                  {row.isActive ? 'فعال' : 'پیش‌نویس / غیرفعال'}
                </span>
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || !permissions.includes('b2b.rate.manage')}
                  onClick={() =>
                    setEditor({
                      row,
                      values: {
                        branchId,
                        title: row.title,
                        serviceReference: row.serviceReference,
                        kind: row.kind,
                        value: row.value,
                        currencyCode: row.currencyCode,
                        validFrom: row.validFrom,
                        validTo: row.validTo,
                        isActive: row.isActive,
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
                  disabled={loading || !permissions.includes('b2b.rate.manage')}
                  onClick={() => {
                    setDeleting(row);
                    setReason('');
                  }}
                >
                  <Trash2 className="size-4" />
                  حذف دائمی
                </Button>
              </div>
            </div>
            <p className="mt-2">
              {serviceLabels[
                row.serviceReference as keyof typeof serviceLabels
              ] ?? row.serviceReference}{' '}
              ·{' '}
              {row.currencyCode
                ? moneyLabel(row.value, row.currencyCode)
                : `${row.value}٪`}
            </p>
            <p className="panel-note">
              از {new Date(row.validFrom).toLocaleDateString('fa-IR')}{' '}
              {row.validTo
                ? `تا ${new Date(row.validTo).toLocaleDateString('fa-IR')}`
                : 'بدون تاریخ پایان'}
            </p>
          </article>
        ))}
        <Button
          variant="outline"
          disabled={!branchId || loading}
          onClick={() => void load()}
        >
          تازه‌سازی
        </Button>
      </div>
      {editor ? (
        <DossierFormDialog
          title={`${editor.row ? 'ویرایش' : 'ثبت'} ${kindLabels[kind]}`}
          description="مبلغ و درصد با دقت کامل ذخیره می‌شود؛ بازه نرخ فعال نباید با مورد مشابه هم‌پوشانی داشته باشد."
          onClose={close}
          onSave={async () => {
            if (
              editor.values.kind === 'FIXED_AMOUNT' &&
              !editor.values.currencyCode
            )
              throw Object.assign(new Error('ارز را انتخاب کنید.'), {
                status: 400,
              });
            if (editor.row)
              await agencyClient.updateRate(organizationId, editor.row.id, {
                ...editor.values,
                version: editor.row.version,
              });
            else
              await agencyClient.createAgreedRate(
                organizationId,
                editor.values,
              );
          }}
        >
          <label className="field">
            عنوان
            <Input
              required
              minLength={2}
              maxLength={160}
              value={editor.values.title}
              onChange={(e) => change({ title: e.target.value })}
            />
          </label>
          <label className="field">
            خدمت
            <select
              className="input"
              value={editor.values.serviceReference}
              onChange={(e) => change({ serviceReference: e.target.value })}
            >
              {Object.entries(serviceLabels).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
              {!(editor.values.serviceReference in serviceLabels) ? (
                <option value={editor.values.serviceReference}>
                  {editor.values.serviceReference}
                </option>
              ) : null}
            </select>
          </label>
          <label className="field">
            {kind === 'FIXED_AMOUNT' ? 'مبلغ توافقی' : 'درصد'}
            <Input
              required
              dir="ltr"
              inputMode="decimal"
              pattern="[0-9]{1,16}(\.[0-9]{1,4})?"
              value={editor.values.value}
              onChange={(e) => change({ value: e.target.value })}
            />
          </label>
          {kind === 'FIXED_AMOUNT' ? (
            <div className="field">
              <label htmlFor="rate-currency">ارز</label>
              <MasterDataReferenceSelector
                closeOnSelect
                id="rate-currency"
                config={{ target: 'currencies', payload: 'code' }}
                label="ارز"
                disabled={false}
                required
                value={editor.values.currencyCode ?? ''}
                onChange={(currencyCode) => change({ currencyCode })}
              />
            </div>
          ) : null}
          <label className="field">
            شروع اعتبار
            <DatePicker
              withinDialog
              required
              value={editor.values.validFrom}
              onChange={(validFrom) => change({ validFrom })}
            />
          </label>
          <label className="field">
            پایان اعتبار
            <DatePicker
              withinDialog
              value={editor.values.validTo ?? ''}
              onChange={(validTo) => change({ validTo: validTo || null })}
            />
          </label>
          <label className="flex gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={editor.values.isActive ?? false}
              disabled={profile?.status !== 'ACTIVE'}
              onChange={(e) => change({ isActive: e.target.checked })}
            />
            فعال {profile?.status !== 'ACTIVE' ? '(پس از تأیید پروفایل)' : ''}
          </label>
        </DossierFormDialog>
      ) : null}
      {deleting ? (
        <DossierFormDialog
          title={`حذف دائمی ${kindLabels[kind]}`}
          description={`«${deleting.title}» حذف می‌شود؛ سابقه این اقدام در تاریخچه باقی می‌ماند.`}
          destructive
          onClose={close}
          onSave={async () => {
            await agencyClient.deleteRate(organizationId, deleting.id, {
              branchId,
              version: deleting.version,
              reason,
            });
          }}
        >
          <label className="field sm:col-span-2">
            دلیل حذف
            <Textarea
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </DossierFormDialog>
      ) : null}
    </section>
  );
}
