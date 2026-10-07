'use client';
import type { AuthenticatedActor, MarketingAssetViewV1 } from '@nora/contracts';
import {
  Download,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import {
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui/form-controls';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { marketingApi, MarketingApiError } from '../api/records-client';
import {
  assertPromotionSaved,
  promotionDraft,
  promotionInput,
  type PromotionDraft,
} from '../model/promotions';
import { downloadRowsAsExcel } from '../utils/excel-export';
import { MarketingActionButton as Button } from './marketing-action-button';
import {
  OfferAudienceTargetSelector,
  type OfferAudienceTargetKind,
  type OfferAudienceTargetReference,
} from './offer-audience-target-selector';

const statusLabels: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  ACTIVE: 'فعال',
  PAUSED: 'غیرفعال',
  ARCHIVED: 'بایگانی',
};
const serviceLabels: Record<string, string> = {
  ALL: 'همه خدمات',
  TOUR: 'تور',
  FLIGHT: 'پرواز',
  HOTEL: 'هتل',
};
const trashStyle =
  'border-destructive/35 bg-white text-destructive hover:bg-white hover:text-destructive';
function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(options).map(([id, title]) => (
          <SelectItem key={id} value={id}>
            {title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function MarketingPromotionsPanel({
  tab,
  adding,
  onAdd,
  onClose,
  onNotice,
}: {
  tab: string;
  adding: boolean;
  onAdd: () => void;
  onClose: () => void;
  onNotice: (message: string) => void;
}) {
  const kind = tab === 'specials' ? 'OFFER' : 'COUPON';
  const title = kind === 'OFFER' ? 'پیشنهادهای ویژه' : 'کدهای تخفیف';
  const [rows, setRows] = useState<MarketingAssetViewV1[]>([]);
  const [actor, setActor] = useState<AuthenticatedActor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [editor, setEditor] = useState<MarketingAssetViewV1 | null>(null);
  const [viewing, setViewing] = useState(false);
  const [draft, setDraft] = useState<PromotionDraft>(() => promotionDraft());
  const [targetKind, setTargetKind] = useState<OfferAudienceTargetKind>('none');
  const [target, setTarget] = useState<OfferAudienceTargetReference | null>(
    null,
  );
  const [branchId, setBranchId] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [deleting, setDeleting] = useState<MarketingAssetViewV1 | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const deleteAttempt = useRef<string | null>(null);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const [access, records] = await Promise.all([
        marketingApi.access(),
        marketingApi.assets(kind),
      ]);
      if (request !== generation.current) return;
      setActor(access);
      setRows(records.data);
      setBranchId(access.branchIds[0] ?? '');
    } catch (caught) {
      if (request === generation.current)
        setError(
          caught instanceof Error
            ? caught.message
            : 'دریافت پیشنهادها ناموفق بود.',
        );
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [kind]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      invalidate();
    };
  }, [load, invalidate]);
  const managed =
    actor?.permissions.includes('marketing.offer.manage') ?? false;
  const openRow = (row: MarketingAssetViewV1, view: boolean) => {
    setEditor(row);
    setViewing(view);
    setDraft(promotionDraft(row));
    setBranchId(row.branchId);
    const audienceKind = row.targetCustomerId
      ? 'customer'
      : row.targetAgencyId
        ? 'agency'
        : 'none';
    setTargetKind(audienceKind);
    setTarget(
      audienceKind === 'none'
        ? null
        : {
            kind: audienceKind,
            id: row.targetCustomerId ?? row.targetAgencyId!,
            label:
              audienceKind === 'customer'
                ? 'مشتری انتخاب‌شده'
                : 'آژانس انتخاب‌شده',
          },
    );
    setFormError('');
    setUncertain(false);
    attempt.current = null;
  };
  const close = () => {
    if (busy.current || uncertain) return;
    setEditor(null);
    setViewing(false);
    setDraft(promotionDraft());
    setTargetKind('none');
    setTarget(null);
    setFormError('');
    attempt.current = null;
    onClose();
  };
  const update = (field: keyof PromotionDraft, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));
  const submit = async () => {
    if (busy.current || viewing) return;
    setFormError('');
    let input;
    try {
      if (!managed || !branchId)
        throw new Error('مجوز ثبت پیشنهاد وجود ندارد.');
      if (targetKind !== 'none' && (!target || target.kind !== targetKind))
        throw new Error('مخاطب هدف را انتخاب کنید.');
      input = promotionInput(kind, draft, target, editor ?? undefined);
    } catch (caught) {
      setFormError((caught as Error).message);
      return;
    }
    const signature = JSON.stringify([input, branchId, editor?.id]);
    if (!attempt.current || attempt.current.signature !== signature)
      attempt.current = { signature, key: crypto.randomUUID() };
    busy.current = true;
    setSaving(true);
    try {
      const result = await marketingApi.saveAsset(input, {
        ...(editor ? { id: editor.id } : {}),
        branchId,
        key: attempt.current.key,
      });
      const row = assertPromotionSaved(
        result.data,
        input,
        editor?.id,
        branchId,
      );
      generation.current++;
      setLoading(false);
      setError('');
      setRows((current) => [
        row,
        ...current.filter((item) => item.id !== row.id),
      ]);
      setUncertain(false);
      setEditor(null);
      onClose();
      setDraft(promotionDraft());
      setTargetKind('none');
      setTarget(null);
      attempt.current = null;
      onNotice('پیشنهاد ذخیره شد.');
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : 'ثبت پیشنهاد ناموفق بود.',
      );
      const unknown =
        !(caught instanceof MarketingApiError) ||
        caught.status >= 500 ||
        caught.status === 408;
      setUncertain(unknown);
      if (!unknown) attempt.current = null;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!deleting || busy.current) return;
    busy.current = true;
    setSaving(true);
    setFormError('');
    deleteAttempt.current ??= crypto.randomUUID();
    try {
      const response = await marketingApi.deleteAsset(
        deleting.id,
        deleting.version,
        deleteAttempt.current,
      );
      if (
        response.data?.id !== deleting.id ||
        response.data.status !== 'DELETED'
      )
        throw new Error('پاسخ حذف معتبر نیست.');
      generation.current++;
      setLoading(false);
      setError('');
      setRows((current) => current.filter((item) => item.id !== deleting.id));
      setDeleting(null);
      deleteAttempt.current = null;
      onNotice('حذف شد.');
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : 'حذف ناموفق بود.',
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const filtered = rows.filter(
    (row) =>
      (status === 'all' || row.status === status) &&
      `${row.name} ${row.payload.code ?? ''}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()) &&
      (!from || Date.parse(row.expiresAt ?? '') >= Date.parse(from)) &&
      (!to || Date.parse(row.scheduledAt ?? '') < Date.parse(to) + 86400000),
  );
  const open = adding || Boolean(editor);
  return (
    <section
      dir="rtl"
      className="grid gap-4 rounded-2xl border border-border bg-surface p-4 text-start"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">{title}</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            aria-label="بارگذاری مجدد"
            disabled={loading || saving}
            onClick={() => void load()}
          >
            <RefreshCw className="size-4" />
          </Button>
          <Button
            variant="outline"
            aria-label="خروجی اکسل"
            disabled={loading || Boolean(error)}
            onClick={() =>
              downloadRowsAsExcel({
                filename: title,
                sheetName: title,
                columns: ['عنوان', 'کد', 'مقدار', 'وضعیت'],
                rows: filtered.map((row) => [
                  row.name,
                  String(row.payload.code ?? ''),
                  String(row.payload.value),
                  statusLabels[row.status] ?? row.status,
                ]),
              })
            }
          >
            <Download className="size-4" />
          </Button>
          {managed ? (
            <Button
              aria-label={
                kind === 'OFFER' ? 'افزودن پیشنهاد ویژه' : 'افزودن کد تخفیف'
              }
              onClick={() => {
                setEditor(null);
                setDraft(promotionDraft());
                setTargetKind('none');
                setTarget(null);
                setViewing(false);
                setFormError('');
                setUncertain(false);
                attempt.current = null;
                onAdd();
              }}
            >
              <Plus className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Input
          aria-label="جست‌وجو"
          placeholder="جست‌وجو"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Choice
          label="وضعیت"
          value={status}
          onChange={setStatus}
          options={{ all: 'همه وضعیت‌ها', ...statusLabels }}
        />
        <FormField label="از تاریخ" id="promotion-filter-from">
          <DatePicker
            id="promotion-filter-from"
            value={from}
            onChange={setFrom}
          />
        </FormField>
        <FormField label="تا تاریخ" id="promotion-filter-to">
          <DatePicker id="promotion-filter-to" value={to} onChange={setTo} />
        </FormField>
      </div>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : loading ? (
        <p role="status">در حال بارگذاری…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {[
                  'عنوان',
                  'کد',
                  'نوع',
                  'مقدار',
                  'خدمت',
                  'مخاطب هدف',
                  'وضعیت',
                  'عملیات',
                ].map((label) => (
                  <th key={label} className="p-3 text-start">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="p-3">{row.name}</td>
                  <td>{String(row.payload.code ?? '—')}</td>
                  <td>
                    {row.payload.discountType === 'PERCENT'
                      ? 'درصدی'
                      : 'مبلغ ثابت'}
                  </td>
                  <td>
                    {String(row.payload.value)}{' '}
                    {row.payload.discountType === 'PERCENT'
                      ? '٪'
                      : String(row.payload.currencyCode)}
                  </td>
                  <td>{serviceLabels[String(row.payload.service)]}</td>
                  <td>
                    {row.targetCustomerId
                      ? 'مشتری'
                      : row.targetAgencyId
                        ? 'آژانس'
                        : 'بدون مخاطب مشخص'}
                  </td>
                  <td>{statusLabels[row.status]}</td>
                  <td>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        aria-label={`مشاهده ${row.name}`}
                        onClick={() => openRow(row, true)}
                      >
                        <Eye className="size-4" />
                      </Button>
                      {managed ? (
                        <>
                          <Button
                            variant="outline"
                            aria-label={`ویرایش ${row.name}`}
                            onClick={() => openRow(row, false)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            className={trashStyle}
                            aria-label={`حذف ${row.name}`}
                            onClick={() => {
                              setDeleting(row);
                              setFormError('');
                              deleteAttempt.current = null;
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length ? (
            <p className="p-4 text-muted-foreground">رکوردی پیدا نشد.</p>
          ) : null}
        </div>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent
          dir="rtl"
          className="max-h-[90vh] max-w-3xl overflow-y-auto text-start"
        >
          <DialogTitle>
            {viewing
              ? 'مشاهده'
              : editor
                ? 'ویرایش'
                : kind === 'OFFER'
                  ? 'افزودن پیشنهاد ویژه'
                  : 'افزودن کد تخفیف'}
          </DialogTitle>
          <DialogDescription>{title}</DialogDescription>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <fieldset
              disabled={saving || uncertain || viewing}
              className="grid gap-4 sm:grid-cols-2"
            >
              <FormField id="promotion-name" label="عنوان" required>
                <Input
                  id="promotion-name"
                  value={draft.name}
                  minLength={2}
                  maxLength={200}
                  required
                  onChange={(e) => update('name', e.target.value)}
                />
              </FormField>
              {kind === 'COUPON' ? (
                <FormField id="promotion-code" label="کد تخفیف" required>
                  <Input
                    id="promotion-code"
                    value={draft.code}
                    required
                    minLength={3}
                    maxLength={64}
                    onChange={(e) => update('code', e.target.value)}
                  />
                </FormField>
              ) : null}
              <FormField id="promotion-type" label="نوع تخفیف">
                <Choice
                  label="نوع تخفیف"
                  value={draft.discountType}
                  onChange={(v) => update('discountType', v)}
                  options={{ PERCENT: 'درصدی', AMOUNT: 'مبلغ ثابت' }}
                />
              </FormField>
              <FormField id="promotion-value" label="مقدار" required>
                <Input
                  id="promotion-value"
                  inputMode="decimal"
                  required
                  value={draft.value}
                  onChange={(e) => update('value', e.target.value)}
                />
              </FormField>
              <FormField id="promotion-currency" label="ارز">
                <Choice
                  label="ارز"
                  value={draft.currencyCode}
                  onChange={(v) => update('currencyCode', v)}
                  options={{ IRR: 'ریال', USD: 'دلار آمریکا', EUR: 'یورو' }}
                />
              </FormField>
              <FormField id="promotion-status" label="وضعیت">
                <Choice
                  label="وضعیت پیشنهاد"
                  value={draft.status}
                  onChange={(v) => update('status', v)}
                  options={statusLabels}
                />
              </FormField>
              <FormField id="promotion-start" label="شروع اعتبار" required>
                <DatePicker
                  id="promotion-start"
                  includeTime
                  withinDialog
                  value={draft.startsAt}
                  onChange={(v) => update('startsAt', v)}
                />
              </FormField>
              <FormField id="promotion-end" label="پایان اعتبار" required>
                <DatePicker
                  id="promotion-end"
                  includeTime
                  withinDialog
                  value={draft.endsAt}
                  onChange={(v) => update('endsAt', v)}
                />
              </FormField>
              <FormField id="promotion-minimum" label="حداقل خرید">
                <Input
                  id="promotion-minimum"
                  inputMode="decimal"
                  value={draft.minimumPurchase}
                  onChange={(e) => update('minimumPurchase', e.target.value)}
                />
              </FormField>
              <FormField id="promotion-limit" label="سقف استفاده">
                <Input
                  id="promotion-limit"
                  inputMode="numeric"
                  value={draft.usageLimit}
                  onChange={(e) => update('usageLimit', e.target.value)}
                />
              </FormField>
              <FormField id="promotion-customer-limit" label="سقف هر مشتری">
                <Input
                  id="promotion-customer-limit"
                  inputMode="numeric"
                  value={draft.perCustomerLimit}
                  onChange={(e) => update('perCustomerLimit', e.target.value)}
                />
              </FormField>
              <FormField id="promotion-service" label="خدمت">
                <Choice
                  label="خدمت"
                  value={draft.service}
                  onChange={(v) => update('service', v)}
                  options={serviceLabels}
                />
              </FormField>
              <FormField id="promotion-combine" label="ترکیب‌پذیری">
                <Choice
                  label="ترکیب‌پذیری"
                  value={draft.combinability}
                  onChange={(v) => update('combinability', v)}
                  options={{
                    EXCLUSIVE: 'غیرقابل ترکیب',
                    COMBINABLE: 'قابل ترکیب',
                  }}
                />
              </FormField>
              {!editor && actor && actor.branchIds.length > 1 ? (
                <FormField id="promotion-branch" label="شعبه">
                  <Choice
                    label="شعبه"
                    value={branchId}
                    onChange={setBranchId}
                    options={Object.fromEntries(
                      actor.branchIds.map((id, i) => [id, `شعبه ${i + 1}`]),
                    )}
                  />
                </FormField>
              ) : null}
              <OfferAudienceTargetSelector
                kind={targetKind}
                value={target}
                onKindChange={setTargetKind}
                onChange={setTarget}
              />
              <FormField id="promotion-description" label="توضیحات">
                <Textarea
                  id="promotion-description"
                  maxLength={2000}
                  value={draft.description}
                  onChange={(e) => update('description', e.target.value)}
                />
              </FormField>
            </fieldset>
            {formError ? (
              <p role="alert" className="mt-3 text-destructive">
                {formError}
              </p>
            ) : null}
            {uncertain ? (
              <p role="status">
                نتیجه ثبت نامشخص است؛ برای جلوگیری از ثبت تکراری همان درخواست را
                دوباره ارسال کنید.
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                aria-label="بستن"
                disabled={saving || uncertain}
                onClick={close}
                type="button"
              >
                <X className="size-4" />
              </Button>
              {!viewing ? (
                <Button
                  aria-label="ذخیره پیشنهاد"
                  type="submit"
                  disabled={saving || !managed}
                >
                  <Save className="size-4" />
                </Button>
              ) : null}
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(value) => {
          if (!value && !saving) setDeleting(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogTitle>تأیید حذف</DialogTitle>
          <DialogDescription>{deleting?.name}</DialogDescription>
          {formError ? (
            <p role="alert" className="text-destructive">
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              aria-label="انصراف"
              disabled={saving}
              onClick={() => setDeleting(null)}
            >
              <X className="size-4" />
            </Button>
            <Button
              variant="outline"
              className={trashStyle}
              aria-label="تأیید حذف"
              disabled={saving}
              onClick={() => void remove()}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
