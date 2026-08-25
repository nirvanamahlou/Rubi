'use client';

import {
  Building2,
  Clock3,
  FileImage,
  History,
  LockKeyhole,
  RefreshCw,
  Save,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import type {
  LegalEntityDetail,
  LegalEntityUpdateRequest,
} from '@rubi/contracts';

import { Button } from '@/components/ui/button';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
} from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import {
  legalEntitiesApi,
  LegalEntitiesApiError,
  type LegalEntitiesListMeta,
  type LegalEntityAuditItem,
} from '../api/client';

const textFields = [
  ['persianName', 'نام فارسی', true],
  ['latinName', 'نام لاتین', false],
  ['tradeName', 'نام تجاری', false],
  ['address', 'آدرس', false],
  ['phone', 'تلفن', false],
  ['email', 'ایمیل', false],
  ['website', 'وب‌سایت', false],
  ['nationalId', 'شناسه ملی', false],
  ['registrationNumber', 'شماره ثبت', false],
  ['economicCode', 'کد اقتصادی', false],
] as const;

type Draft = Record<
  | (typeof textFields)[number][0]
  | 'paymentText'
  | 'primaryColor'
  | 'secondaryColor'
  | 'legalFooterText',
  string
>;
const emptyDraft = (): Draft => ({
  persianName: '',
  latinName: '',
  tradeName: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  nationalId: '',
  registrationNumber: '',
  economicCode: '',
  paymentText: '',
  primaryColor: '',
  secondaryColor: '',
  legalFooterText: '',
});

function toDraft(entity: LegalEntityDetail): Draft {
  const draft = emptyDraft();
  for (const [key] of textFields) draft[key] = entity[key] ?? '';
  draft.paymentText = entity.paymentText ?? '';
  draft.primaryColor = entity.primaryColor ?? '';
  draft.secondaryColor = entity.secondaryColor ?? '';
  draft.legalFooterText = entity.legalFooterText ?? '';
  return draft;
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function LegalEntitiesAdmin() {
  const [entities, setEntities] = useState<LegalEntityDetail[]>([]);
  const [meta, setMeta] = useState<LegalEntitiesListMeta | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [audit, setAudit] = useState<LegalEntityAuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = useMemo(
    () => entities.find(({ id }) => id === selectedId) ?? null,
    [entities, selectedId],
  );
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const response = await legalEntitiesApi.list();
      setEntities(response.data);
      setMeta(response.meta);
      setSelectedId((current) => current ?? response.data[0]?.id ?? null);
    } catch (reason) {
      if (reason instanceof LegalEntitiesApiError && reason.status === 403)
        setForbidden(true);
      else
        setError(
          reason instanceof Error
            ? reason.message
            : 'دریافت شرکت‌ها ناموفق بود.',
        );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!selectedId || !meta?.canReadAudit) return;
    const timer = window.setTimeout(() => {
      void legalEntitiesApi
        .audit(selectedId)
        .then(({ data }) => setAudit(data))
        .catch(() => setAudit([]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedId, meta?.canReadAudit]);

  function selectEntity(entity: LegalEntityDetail) {
    setSelectedId(entity.id);
    setDraft(toDraft(entity));
    setAudit([]);
    setNotice(null);
    setError(null);
  }

  function change(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function replaceEntity(entity: LegalEntityDetail) {
    setEntities((current) =>
      current.map((item) => (item.id === entity.id ? entity : item)),
    );
    setDraft(toDraft(entity));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selected || !meta?.canManage) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const input: LegalEntityUpdateRequest = {
      expectedVersion: selected.version,
      persianName: draft.persianName.trim(),
      latinName: nullable(draft.latinName),
      tradeName: nullable(draft.tradeName),
      address: nullable(draft.address),
      phone: nullable(draft.phone),
      email: nullable(draft.email),
      website: nullable(draft.website),
      nationalId: nullable(draft.nationalId),
      registrationNumber: nullable(draft.registrationNumber),
      economicCode: nullable(draft.economicCode),
      paymentText: nullable(draft.paymentText),
      primaryColor: nullable(draft.primaryColor),
      secondaryColor: nullable(draft.secondaryColor),
      legalFooterText: nullable(draft.legalFooterText),
    };
    try {
      const response = await legalEntitiesApi.update(selected.id, input);
      replaceEntity(response.data);
      setNotice('مشخصات شرکت و Branding Snapshot جدید ثبت شد.');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'ذخیره شرکت ناموفق بود.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    if (!selected || !meta?.canManage) return;
    const next = selected.isActive ? 'inactive' : 'active';
    if (
      !window.confirm(
        next === 'inactive'
          ? 'غیرفعال‌سازی تنها پس از بررسی Context کاربران انجام می‌شود. ادامه می‌دهید؟'
          : 'شرکت دوباره فعال شود؟',
      )
    )
      return;
    setSaving(true);
    setError(null);
    try {
      const response = await legalEntitiesApi.status(
        selected.id,
        next,
        selected.version,
      );
      replaceEntity(response.data);
      setNotice('وضعیت شرکت ثبت شد.');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'تغییر وضعیت ناموفق بود.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Skeleton className="h-80" />
          <Skeleton className="h-[520px]" />
        </div>
      </div>
    );
  if (forbidden)
    return (
      <ErrorState
        description="مجوز legal-entity.read برای مشاهده این صفحه لازم است."
        title="دسترسی به مدیریت شرکت‌ها مجاز نیست"
      />
    );
  if (error && !entities.length)
    return (
      <ErrorState
        action={
          <Button onClick={() => void load()} variant="outline">
            <RefreshCw className="size-4" />
            تلاش دوباره
          </Button>
        }
        description={error}
        title="دریافت شرکت‌ها ناموفق بود"
      />
    );
  if (!entities.length)
    return (
      <EmptyState
        description="Seed دو شرکت اولیه باید اجرا شود."
        title="شرکت صادرکننده‌ای ثبت نشده است"
      />
    );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="مدیریت سیستم"
        title="شرکت‌های صادرکننده"
        description="هویت حقوقی و Branding خروجی‌ها؛ مستقل از شعبه و بدون فیلترکردن داده‌های عملیاتی."
        actions={
          <Badge>{meta?.canManage ? 'دسترسی مدیریت' : 'فقط مشاهده'}</Badge>
        }
      />
      {error ? (
        <Alert description={error} title="عملیات کامل نشد" tone="error" />
      ) : null}
      {notice ? <Alert description={notice} title="ثبت موفق" /> : null}
      <div className="grid gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="space-y-3">
          {entities.map((entity) => (
            <button
              className={cn(
                'w-full rounded-2xl border bg-surface p-4 text-start transition hover:border-primary/40',
                selectedId === entity.id &&
                  'border-primary ring-2 ring-primary/10',
              )}
              key={entity.id}
              onClick={() => selectEntity(entity)}
              type="button"
            >
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">
                    {entity.persianName}
                  </strong>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {entity.code}
                  </span>
                </span>
                <Badge
                  className={
                    entity.isActive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }
                >
                  {entity.isActive ? 'فعال' : 'غیرفعال'}
                </Badge>
              </span>
            </button>
          ))}
          <Alert
            description="این انتخاب هیچ Customer، Contract، Reservation یا Finance record را scope نمی‌کند."
            title="داده عملیاتی مشترک است"
          />
        </aside>
        {selected ? (
          <div className="space-y-5">
            <form className="space-y-5" onSubmit={(event) => void save(event)}>
              <Card className="p-5">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-black">مشخصات حقوقی</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      فیلدهای نامشخص عمداً خالی می‌مانند و مقدار ساختگی ذخیره
                      نمی‌شود.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      disabled={!meta?.canManage}
                      loading={saving}
                      type="submit"
                    >
                      <Save className="size-4" />
                      ذخیره
                    </Button>
                    <Button
                      disabled={!meta?.canManage}
                      onClick={() => void toggleStatus()}
                      type="button"
                      variant={selected.isActive ? 'destructive' : 'outline'}
                    >
                      {selected.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {textFields.map(([key, label, required]) => (
                    <FormField key={key} label={label} required={required}>
                      <Input
                        disabled={!meta?.canManage}
                        onChange={(event) => change(key, event.target.value)}
                        value={draft[key]}
                      />
                    </FormField>
                  ))}
                  <FormField label="رنگ اصلی">
                    <Input
                      disabled={!meta?.canManageBranding}
                      onChange={(event) =>
                        change('primaryColor', event.target.value)
                      }
                      placeholder="#123f8c"
                      value={draft.primaryColor}
                    />
                  </FormField>
                  <FormField label="رنگ مکمل">
                    <Input
                      disabled={!meta?.canManageBranding}
                      onChange={(event) =>
                        change('secondaryColor', event.target.value)
                      }
                      placeholder="#22d3ee"
                      value={draft.secondaryColor}
                    />
                  </FormField>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FormField label="متن پرداخت">
                    <Textarea
                      disabled={!meta?.canManage}
                      onChange={(event) =>
                        change('paymentText', event.target.value)
                      }
                      value={draft.paymentText}
                    />
                  </FormField>
                  <FormField label="متن حقوقی پایین سند">
                    <Textarea
                      disabled={!meta?.canManageBranding}
                      onChange={(event) =>
                        change('legalFooterText', event.target.value)
                      }
                      value={draft.legalFooterText}
                    />
                  </FormField>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="flex items-center gap-2 font-black">
                      <FileImage className="size-5 text-primary" />
                      Branding و فایل‌های Documents
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      لوگو، سربرگ، پابرگ، مهر و امضا فقط از قرارداد عمومی
                      Documents انتخاب می‌شوند. URL عمومی مستقیم ساخته نمی‌شود.
                    </p>
                  </div>
                  <Badge>
                    {meta?.canManageBranding ? 'مجاز' : 'بدون مجوز'}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    'لوگو',
                    'سربرگ PDF',
                    'پابرگ PDF',
                    'مهر حساس',
                    'امضای مجاز',
                  ].map((label) => (
                    <Button
                      disabled
                      key={label}
                      type="button"
                      variant="outline"
                    >
                      <Upload className="size-4" />
                      {label}
                    </Button>
                  ))}
                </div>
                <Alert
                  className="mt-4"
                  description="Documents persistence هنوز Public Upload Adapter اجرایی ندارد؛ دکمه‌ها تا اتصال قرارداد واقعی غیرفعال‌اند و فایل ساختگی ایجاد نشده است."
                  title="نیازمند اتصال Documents"
                  tone="warning"
                />
              </Card>
            </form>

            <Card className="overflow-hidden">
              <div className="border-b bg-muted/40 p-4">
                <h2 className="font-black">Preview سربرگ PDF</h2>
              </div>
              <div
                className="m-5 min-h-64 rounded-xl border bg-white p-8 text-slate-900 shadow-inner"
                style={{
                  borderTopColor: draft.primaryColor || '#123f8c',
                  borderTopWidth: 8,
                }}
              >
                <div className="flex items-start justify-between gap-6">
                  {selected.code === 'NIYAYESH_SEIR_SAHAR' ? (
                    <Image
                      alt="لوگوی نیایش سیر سحر"
                      className="h-16 w-36 object-contain"
                      height={64}
                      src="/brand/niyayesh.png"
                      width={144}
                    />
                  ) : (
                    <div className="grid h-16 w-36 place-items-center rounded-lg border border-dashed text-xs text-slate-500">
                      لوگو تکمیل نشده
                    </div>
                  )}
                  <div className="text-end">
                    <strong>{draft.persianName || selected.persianName}</strong>
                    <p className="mt-2 text-xs">
                      {draft.address || 'آدرس تکمیل نشده'}
                    </p>
                  </div>
                </div>
                {!selected.letterheadFileId ? (
                  <div className="mt-14 rounded-lg border border-dashed p-6 text-center text-sm text-amber-700">
                    سربرگ تکمیل نشده
                  </div>
                ) : null}
                <p className="mt-12 border-t pt-3 text-xs text-slate-500">
                  {draft.legalFooterText || 'متن حقوقی پایین سند تکمیل نشده'}
                </p>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="flex items-center gap-2 font-black">
                <History className="size-5 text-primary" />
                Audit Timeline
              </h2>
              {!meta?.canReadAudit ? (
                <Alert
                  className="mt-4"
                  description="Permission legal-entity.audit.read لازم است."
                  title="مشاهده Audit مجاز نیست"
                  tone="warning"
                />
              ) : audit.length ? (
                <ol className="mt-4 space-y-3">
                  {audit.map((event) => (
                    <li
                      className="flex gap-3 rounded-xl border p-3"
                      key={event.id}
                    >
                      <Clock3 className="mt-0.5 size-4 text-muted-foreground" />
                      <div>
                        <strong className="text-sm">{event.action}</strong>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(event.occurredAt).toLocaleString('fa-IR')} ·{' '}
                          {event.actorUserId}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  هنوز رویدادی ثبت نشده است.
                </p>
              )}
            </Card>
            <div className="grid gap-3 sm:grid-cols-2">
              <Alert
                description="مهر و امضا فقط با Permission Branding و Audit قابل دسترسی‌اند."
                title="فایل حساس"
                tone="warning"
              />
              <Alert
                description={`نسخه رکورد ${selected.version.toLocaleString('fa-IR')} · Branding Snapshot ${selected.brandingSnapshotVersion.toLocaleString('fa-IR')}`}
                title="Optimistic Locking فعال"
              />
            </div>
          </div>
        ) : null}
      </div>
      <Card className="flex items-center gap-3 p-4">
        <ShieldCheck className="size-5 text-emerald-600" />
        <p className="text-sm">
          Backend در Switch و Issue/Reissue، Permission و issuer واقعی را دوباره
          اعتبارسنجی می‌کند.
        </p>
        <LockKeyhole className="ms-auto size-4 text-muted-foreground" />
      </Card>
    </div>
  );
}
