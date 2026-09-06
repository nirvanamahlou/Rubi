'use client';

import {
  Award,
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCheck,
  Clock3,
  FileText,
  LockKeyhole,
  Plus,
  Search,
  Settings2,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import {
  applyPreview,
  kpis,
  previewRecords,
  queryRecords,
  sections,
  uiStates,
  validatePreview,
  type PreviewRecord,
  type Section,
  type UiState,
} from './hr.model';

const icons = {
  chart: ChartNoAxesCombined,
  users: Users,
  building: Building2,
  file: FileText,
  clock: Clock3,
  calendar: CalendarDays,
  check: CheckCheck,
  award: Award,
  wallet: Wallet,
  box: Boxes,
  bell: Bell,
  settings: Settings2,
};
const statusLabels = {
  DRAFT: 'پیش‌نویس',
  ACTIVE: 'فعال',
  PENDING: 'در انتظار تأیید',
};
const control =
  'min-h-11 w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
const panel = 'rounded-2xl border border-border bg-surface p-5 shadow-sm';

export function HrState({ state }: { state: UiState }) {
  const messages: Record<UiState, string> = {
    preview: 'داده نمایشی؛ هیچ اطلاعات واقعی دریافت نشده است.',
    loading: 'در حال دریافت اطلاعات منابع انسانی…',
    empty: 'هنوز رکوردی برای نمایش وجود ندارد.',
    error: 'دریافت اطلاعات انجام نشد. دوباره تلاش کنید.',
    unauthorized: 'برای ادامه باید وارد حساب کاربری شوید.',
    forbidden: 'مجوز مشاهده این بخش یا شعبه را ندارید.',
    conflict:
      'نسخه رکورد تغییر کرده است. اطلاعات را دوباره دریافت و بررسی کنید.',
    success:
      'اعتبارسنجی نمایشی موفق بود؛ هیچ اطلاعاتی در سامانه ذخیره نشده است.',
  };
  return (
    <div
      className={`${panel} py-12 text-center`}
      role={state === 'error' || state === 'conflict' ? 'alert' : 'status'}
    >
      <LockKeyhole
        aria-hidden="true"
        className="mx-auto mb-3 size-8 text-blue-600"
      />
      <h2 className="font-bold">{uiStates[state]}</h2>
      <p className="mt-3 text-sm text-muted-foreground">{messages[state]}</p>
      {state === 'unauthorized' ? (
        <Link
          className="mt-4 inline-block text-blue-700 underline"
          href="/login?next=/hr"
        >
          ورود به سامانه
        </Link>
      ) : null}
    </div>
  );
}

export function HrDashboard() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((label, index) => (
          <div key={label} className={panel}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm text-muted-foreground">{label}</span>
              <ChartNoAxesCombined
                aria-hidden="true"
                className={`size-5 shrink-0 ${index % 2 ? 'text-cyan-600' : 'text-blue-600'}`}
              />
            </div>
            <p
              className="my-4 text-3xl font-bold"
              aria-label="داده متصل موجود نیست"
            >
              —
            </p>
            <p className="text-xs text-muted-foreground">
              پس از اتصال منبع تأییدشده
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={panel}>
          <h2 className="font-bold">رسیدگی‌های روزانه</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            برای بررسی درخواست‌ها به بخش مربوط بروید.
          </p>
          <div className="mt-4 grid gap-2">
            {sections
              .filter((item) =>
                ['leave', 'contracts', 'reminders'].includes(item.id),
              )
              .map((item) => (
                <Link
                  key={item.id}
                  href={`/hr?section=${item.id}`}
                  className="rounded-xl bg-blue-50 p-3 text-sm font-medium text-blue-900 focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  {item.title} ←
                </Link>
              ))}
          </div>
        </section>
        <section className={panel}>
          <h2 className="font-bold">پرونده امن هر همکار</h2>
          <p className="mt-3 text-sm leading-8 text-muted-foreground">
            کد ملی، اطلاعات بانکی، حقوق، مدارک، اطلاعات پزشکی و انضباطی پیش‌فرض
            پوشیده‌اند. نمایش واقعی به مجوز مستقل، دلیل مشاهده و ثبت رخداد نیاز
            دارد.
          </p>
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            انتخاب شرکت صادرکننده، دسترسی شعبه یا کارکنان را تغییر نمی‌دهد.
          </p>
        </section>
      </div>
    </div>
  );
}

export function HrPreviewForm({
  section,
  record,
  mode,
  onSubmit,
}: {
  section: Section;
  record?: PreviewRecord;
  mode: 'create' | 'view' | 'edit';
  onSubmit: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    record ? { ...record.values, title: record.title } : {},
  );
  const [error, setError] = useState<string | null>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = validatePreview(section, values);
    setError(invalid);
    if (!invalid) onSubmit(values);
  }
  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <p className="rounded-xl bg-amber-50 p-3 text-sm leading-7 text-amber-950">
        فقط داده نمایشی وارد کنید. این فرم برای بررسی طراحی است و با بستن یا
        بارگذاری مجدد صفحه، تغییرات از بین می‌روند.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {section.fields.map((field) => (
          <div key={field.key} className="min-w-0">
            <label
              htmlFor={`hr-${field.key}`}
              className="mb-2 block text-sm font-medium"
            >
              {field.label}
              {field.required ? ' *' : ''}
            </label>
            {field.type === 'sensitive' ? (
              <>
                <input
                  id={`hr-${field.key}`}
                  className={control}
                  value="••••••••"
                  disabled
                  aria-label={`${field.label} پوشیده`}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  نمایش و ورود پس از اتصال امن سرویس
                </p>
              </>
            ) : field.type === 'date' ? (
              <DatePicker
                id={`hr-${field.key}`}
                value={values[field.key] ?? ''}
                onChange={(value) =>
                  setValues({ ...values, [field.key]: value })
                }
                disabled={mode === 'view'}
              />
            ) : field.type === 'select' ? (
              <select
                id={`hr-${field.key}`}
                className={control}
                value={values[field.key] ?? ''}
                disabled={mode === 'view'}
                onChange={(event) =>
                  setValues({ ...values, [field.key]: event.target.value })
                }
              >
                <option value="">انتخاب کنید</option>
                {field.options?.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input
                id={`hr-${field.key}`}
                className={control}
                maxLength={500}
                value={values[field.key] ?? ''}
                readOnly={mode === 'view'}
                inputMode={
                  field.type === 'number' || field.type === 'money'
                    ? 'decimal'
                    : 'text'
                }
                onChange={(event) =>
                  setValues({ ...values, [field.key]: event.target.value })
                }
              />
            )}
          </div>
        ))}
      </div>
      {section.id === 'employees' && mode === 'view' ? (
        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="font-bold">سوابق و فعالیت‌ها</h3>
          <p className="text-sm text-muted-foreground">
            قراردادها، مرخصی‌ها، آموزش‌ها، تجهیزات، ارزیابی‌ها و تاریخچه فعالیت
            پس از اتصال سرویس نمایش داده می‌شوند.
          </p>
          <div className="flex flex-wrap gap-3">
            {['contracts', 'leave', 'training', 'assets', 'performance'].map(
              (id) => (
                <Link
                  className="text-sm text-blue-700 underline"
                  href={`/hr?section=${id}`}
                  key={id}
                >
                  {sections.find((item) => item.id === id)?.title}
                </Link>
              ),
            )}
          </div>
        </section>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {mode !== 'view' ? (
        <Button type="submit">اعمال در پیش‌نمایش</Button>
      ) : null}
    </form>
  );
}

export function HrWorkspace({
  sectionId = 'dashboard',
}: {
  sectionId?: string;
}) {
  const section =
    sections.find((item) => item.id === sectionId) ?? sections[0]!;
  const [state, setState] = useState<UiState>('preview');
  const [records, setRecords] = useState(previewRecords);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<{
    mode: 'create' | 'view' | 'edit';
    record?: PreviewRecord;
  } | null>(null);
  const result = queryRecords(records, {
    section: section.id,
    search,
    status,
    direction,
    page,
  });
  function apply(values: Record<string, string>) {
    if (!dialog) return;
    const row: PreviewRecord = {
      id: dialog.record?.id ?? `preview-${section.id}-${crypto.randomUUID()}`,
      section: section.id,
      title: values.title ?? 'رکورد نمایشی',
      unit: dialog.record?.unit ?? 'واحد نمایشی',
      status: dialog.record?.status ?? 'DRAFT',
      version: dialog.record?.version ?? 0,
      values,
    };
    try {
      setRecords(applyPreview(records, row, dialog.record?.version ?? 0));
      setNotice('تغییر فقط در پیش‌نمایش اعمال شد؛ ذخیره دائمی انجام نشده است.');
      setDialog(null);
    } catch {
      setState('conflict');
      setDialog(null);
    }
  }
  return (
    <div
      dir="rtl"
      lang="fa"
      className="min-w-0 space-y-6"
      data-hr-mode="preview"
    >
      <header className="rounded-3xl bg-gradient-to-l from-blue-950 via-blue-900 to-blue-700 p-6 text-white sm:p-8">
        <p className="text-xs text-blue-200">RUBI / منابع انسانی</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">
              {section.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">
              {section.description}
            </p>
          </div>
          <Users aria-hidden="true" className="size-12 text-blue-200" />
        </div>
        <div className="mt-5 inline-flex rounded-full border border-blue-300/40 bg-white/10 px-3 py-1 text-xs">
          داده نمایشی · بدون ذخیره دائمی
        </div>
      </header>
      <nav
        aria-label="بخش‌های منابع انسانی"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4"
      >
        {sections.map((item) => {
          const Icon = icons[item.icon as keyof typeof icons] ?? FileText;
          return (
            <Link
              key={item.id}
              href={`/hr?section=${item.id}`}
              aria-current={item.id === section.id ? 'page' : undefined}
              className={`flex min-w-0 items-center gap-2 rounded-xl border p-3 text-sm transition focus-visible:ring-2 focus-visible:ring-blue-500 ${item.id === section.id ? 'border-blue-700 bg-blue-700 font-bold text-white' : 'border-border bg-surface hover:border-blue-400 hover:bg-blue-50 hover:text-blue-950'}`}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p>اتصال عملیاتی هنوز آماده نیست. اطلاعات واقعی کارکنان وارد نکنید.</p>
        <label className="flex items-center gap-2">
          بررسی حالت رابط
          <select
            className="max-w-40 rounded-lg border border-amber-300 bg-white p-2"
            value={state}
            onChange={(event) => setState(event.target.value as UiState)}
          >
            {Object.entries(uiStates).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {notice ? (
        <p
          role="status"
          className="rounded-xl bg-blue-50 p-4 text-sm text-blue-950"
        >
          {notice}
        </p>
      ) : null}
      {state !== 'preview' ? (
        <>
          <HrState state={state} />
          <Button onClick={() => setState('preview')}>
            بازگشت به پیش‌نمایش
          </Button>
        </>
      ) : section.id === 'dashboard' ? (
        <HrDashboard />
      ) : section.id === 'reports' ? (
        <section className={panel}>
          <h2 className="font-bold">گزارش‌ها و خروجی‌ها</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            گزارش نیروی انسانی، حضور و مرخصی، پایان قرارداد، آموزش، تجهیزات و
            ورودی مالی پس از اتصال داده تأییدشده آماده می‌شود. در حال حاضر فایل
            قابل دریافت وجود ندارد.
          </p>
          <div className="mt-5 flex gap-3">
            <Button disabled>دریافت Excel</Button>
            <Button disabled>دریافت PDF</Button>
          </div>
        </section>
      ) : (
        <section className={panel}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">فهرست {section.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                همه رکوردهای این فهرست داده نمایشی هستند.
              </p>
            </div>
            <Button onClick={() => setDialog({ mode: 'create' })}>
              <Plus aria-hidden="true" className="size-4" />
              افزودن نمونه
            </Button>
          </div>
          {section.id === 'organization' ? (
            <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
              <h3 className="mb-3 font-bold">چارت نمایشی</h3>
              <ul className="space-y-2">
                <li>
                  شعبه نمایشی
                  <ul className="ms-5 mt-2 border-s-2 border-blue-300 ps-4">
                    <li>واحد عملیات · سمت مدیر · ظرفیت پس از اتصال</li>
                    <li className="mt-2">
                      تیم پشتیبانی · سمت کارشناس · جانشین تعیین‌نشده
                    </li>
                  </ul>
                </li>
              </ul>
            </div>
          ) : null}
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              <span className="mb-2 flex items-center gap-2">
                <Search aria-hidden="true" className="size-4" />
                جست‌وجو
              </span>
              <input
                className={control}
                value={search}
                placeholder="عنوان، شناسه یا واحد"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="text-sm">
              <span className="mb-2 block">وضعیت</span>
              <select
                className={control}
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">همه وضعیت‌ها</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-2 block">مرتب‌سازی عنوان</span>
              <select
                className={control}
                value={direction}
                onChange={(event) => {
                  setDirection(event.target.value as 'asc' | 'desc');
                  setPage(1);
                }}
              >
                <option value="asc">صعودی</option>
                <option value="desc">نزولی</option>
              </select>
            </label>
          </div>
          {result.items.length === 0 ? (
            <HrState state="empty" />
          ) : (
            <ul className="space-y-3">
              {result.items.map((record) => (
                <li
                  key={record.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4"
                >
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold">
                      {record.title}
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {record.unit} · {statusLabels[record.status]} · داده
                      نمایشی
                    </p>
                    <p
                      className="mt-1 break-all text-xs text-muted-foreground"
                      dir="ltr"
                    >
                      {record.id}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setDialog({ mode: 'view', record })}
                    >
                      مشاهده
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDialog({ mode: 'edit', record })}
                    >
                      ویرایش نمونه
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">
              {result.total.toLocaleString('fa-IR')} رکورد نمایشی · صفحه{' '}
              {result.page.toLocaleString('fa-IR')} از{' '}
              {result.pages.toLocaleString('fa-IR')}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={result.page <= 1}
                onClick={() => setPage(result.page - 1)}
              >
                قبلی
              </Button>
              <Button
                variant="outline"
                disabled={result.page >= result.pages}
                onClick={() => setPage(result.page + 1)}
              >
                بعدی
              </Button>
            </div>
          </div>
        </section>
      )}
      <Dialog
        open={Boolean(dialog)}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent
          dir="rtl"
          className="max-h-[85vh] max-w-3xl overflow-y-auto"
        >
          <DialogTitle>
            {dialog?.mode === 'view'
              ? 'مشاهده'
              : dialog?.mode === 'edit'
                ? 'ویرایش نمونه'
                : 'افزودن نمونه'}{' '}
            · {section.title}
          </DialogTitle>
          <DialogDescription>
            داده نمایشی؛ اطلاعات حساس قابل نمایش یا ثبت نیست.
          </DialogDescription>
          {dialog ? (
            <HrPreviewForm
              key={`${dialog.mode}-${dialog.record?.id ?? 'new'}`}
              section={section}
              {...(dialog.record ? { record: dialog.record } : {})}
              mode={dialog.mode}
              onSubmit={apply}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
