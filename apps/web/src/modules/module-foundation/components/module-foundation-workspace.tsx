'use client';

import {
  Activity,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  FilePenLine,
  Filter,
  KeyRound,
  Link2,
  ListFilter,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
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
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  Skeleton,
} from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import type {
  FoundationModuleConfig,
  FoundationRow,
} from '../model/foundation';

type PreviewState = 'preview' | 'loading' | 'empty' | 'error' | 'forbidden';
type DialogMode = 'create' | 'view' | 'edit';

const stateLabels: Record<PreviewState, string> = {
  preview: 'Preview',
  loading: 'Loading',
  empty: 'Empty',
  error: 'Error',
  forbidden: 'Forbidden',
};

const statusTone: Record<FoundationRow['status'], string> = {
  'منتظر اقدام': 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  'در حال بررسی': 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  'نیازمند تأیید': 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  آماده: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
};

function PreviewBadge() {
  return (
    <Badge className="gap-1.5 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200">
      <Sparkles aria-hidden="true" className="size-3.5" />
      نمونه طراحی و ذخیره‌نشده
    </Badge>
  );
}

function WorkspaceState({
  onReset,
  state,
}: {
  onReset: () => void;
  state: Exclude<PreviewState, 'preview'>;
}) {
  if (state === 'loading') {
    return (
      <section
        aria-label="وضعیت بارگذاری"
        className="space-y-3 rounded-2xl border border-border bg-surface p-5"
      >
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton className="h-12" key={index} />
          ))}
        </div>
      </section>
    );
  }

  if (state === 'empty') {
    return (
      <EmptyState
        action={
          <Button onClick={onReset} variant="outline">
            بازگشت به نمونه طراحی
          </Button>
        }
        description="با اتصال Backend و اعمال فیلترهای واقعی، رکوردهای مجاز این بخش نمایش داده می‌شوند."
        title="رکوردی برای نمایش وجود ندارد"
      />
    );
  }

  if (state === 'forbidden') {
    return (
      <EmptyState
        action={
          <Button onClick={onReset} variant="outline">
            بررسی نمای طراحی
          </Button>
        }
        description="این وضعیت deny-by-default است و دسترسی فقط از Permissionهای ماژول مالک صادر می‌شود."
        icon={LockKeyhole}
        title="دسترسی به این بخش مجاز نیست"
      />
    );
  }

  return (
    <ErrorState
      action={
        <Button onClick={onReset} variant="outline">
          تلاش مجدد نمایشی
        </Button>
      }
      description="در اتصال واقعی، خطا با شناسه پیگیری Redacted ثبت می‌شود و اطلاعات حساس نمایش داده نمی‌شود."
      title="دریافت اطلاعات با خطا روبه‌رو شد"
    />
  );
}

function PreviewDialog({
  config,
  mode,
  onClose,
  onSubmit,
  row,
}: {
  config: FoundationModuleConfig;
  mode: DialogMode;
  onClose: () => void;
  onSubmit: () => void;
  row?: FoundationRow | undefined;
}) {
  const readOnly = mode === 'view';
  const title =
    mode === 'create'
      ? config.createLabel
      : mode === 'edit'
        ? `ویرایش نمایشی ${row?.title ?? ''}`
        : `مشاهده ${row?.title ?? ''}`;

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          این فرم فقط برای بررسی تجربه کاربری است؛ هیچ داده‌ای ارسال یا ذخیره
          نمی‌شود.
        </DialogDescription>
        <div className="mt-3">
          <PreviewBadge />
        </div>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <FormField id="preview-title" label="عنوان رکورد" required>
            <Input
              defaultValue={row?.title ?? `${config.title} جدید`}
              id="preview-title"
              readOnly={readOnly}
            />
          </FormField>
          <FormField id="preview-owner" label="مسئول پیشنهادی">
            <Input
              defaultValue={row?.owner ?? 'کارشناس نمونه'}
              id="preview-owner"
              readOnly={readOnly}
            />
          </FormField>
          <FormField id="preview-status" label="وضعیت">
            <Input
              defaultValue={row?.status ?? 'منتظر اقدام'}
              id="preview-status"
              readOnly
            />
          </FormField>
          <FormField id="preview-reference" label="Reference بین‌ماژولی">
            <Input
              defaultValue={
                config.references[0]?.contract ?? 'Reference پیشنهادی'
              }
              id="preview-reference"
              readOnly
            />
          </FormField>
          <FormField
            description="از ثبت Secret، Credential یا اطلاعات واقعی اشخاص خودداری شود."
            id="preview-note"
            label="یادداشت طراحی"
          >
            <Textarea
              className="sm:col-span-2"
              defaultValue="این متن صرفاً نمونه طراحی است و در هیچ Repository یا Backend ذخیره نمی‌شود."
              id="preview-note"
              readOnly={readOnly}
            />
          </FormField>
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
            <Button onClick={onClose} type="button" variant="ghost">
              بستن
            </Button>
            {!readOnly ? (
              <Button type="submit">ثبت نمایشی بدون ذخیره</Button>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ModuleFoundationWorkspace({
  config,
}: {
  config: FoundationModuleConfig;
}) {
  const [activeSection, setActiveSection] = useState(0);
  const [dialog, setDialog] = useState<{
    mode: DialogMode;
    row?: FoundationRow;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest' | 'title'>('newest');
  const [state, setState] = useState<PreviewState>('preview');
  const [status, setStatus] = useState<'all' | FoundationRow['status']>('all');

  const rows = useMemo(() => {
    const normalized = query.trim();
    return config.rows
      .filter(
        (row) =>
          (status === 'all' || row.status === status) &&
          (!normalized ||
            row.title.includes(normalized) ||
            row.id.toLowerCase().includes(normalized.toLowerCase())),
      )
      .toSorted((a, b) =>
        sort === 'title'
          ? a.title.localeCompare(b.title, 'fa')
          : b.id.localeCompare(a.id),
      );
  }, [config.rows, query, sort, status]);

  const pageSize = 2;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selectedSection = config.sections[activeSection] ?? config.sections[0];

  const resetFilters = () => {
    setPage(1);
    setQuery('');
    setSort('newest');
    setStatus('all');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <>
            {config.key === 'system' ? (
              <>
                <Button asChild variant="secondary">
                  <Link href="/users">
                    <ShieldCheck aria-hidden="true" className="size-4" />
                    کاربران و دسترسی
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/settings">
                    تنظیمات موجود
                    <ArrowLeft aria-hidden="true" className="size-4" />
                  </Link>
                </Button>
              </>
            ) : null}
            <Button
              onClick={() =>
                setNotice(
                  'مسیر خروجی پس از اتصال Worker و Documents فعال می‌شود؛ فایل جعلی تولید نشد.',
                )
              }
              variant="outline"
            >
              <Download aria-hidden="true" className="size-4" />
              خروجی
            </Button>
            <Button onClick={() => setDialog({ mode: 'create' })}>
              <Plus aria-hidden="true" className="size-4" />
              {config.createLabel}
            </Button>
          </>
        }
        description={config.description}
        eyebrow="Foundation عملیاتی ماژول"
        title={config.title}
      />

      <div className="flex flex-wrap items-center gap-2">
        <PreviewBadge />
        <Badge className="bg-primary/10 text-primary">فارسی و RTL</Badge>
        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          Responsive
        </Badge>
      </div>

      <Alert description={config.boundary} title="مرز مالکیت و یکپارچگی داده" />

      {notice ? (
        <Alert
          className="relative"
          description={notice}
          title="نتیجه اقدام نمایشی"
        >
          <Button
            className="absolute end-2 top-2 min-h-8 px-2"
            onClick={() => setNotice('')}
            size="sm"
            variant="ghost"
          >
            بستن
          </Button>
        </Alert>
      ) : null}

      <section
        aria-label={`شاخص‌های ${config.title}`}
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        {config.metrics.map((metric, index) => (
          <Card className="relative overflow-hidden p-4" key={metric.label}>
            <span
              aria-hidden="true"
              className={cn(
                'absolute inset-y-0 start-0 w-1',
                index % 2 ? 'bg-cyan-400' : 'bg-primary',
              )}
            />
            <div className="flex items-start justify-between gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                <Activity aria-hidden="true" className="size-4" />
              </span>
              <PreviewBadge />
            </div>
            <p className="mt-3 text-xs font-bold text-muted-foreground">
              {metric.label}
            </p>
            <p className="mt-1 text-2xl font-black">{metric.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {metric.detail}
            </p>
          </Card>
        ))}
      </section>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <ListFilter aria-hidden="true" className="size-4 text-primary" />
          <h2 className="text-sm font-black">Navigation داخلی قابلیت‌ها</h2>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist">
          {config.sections.map((section, index) => (
            <button
              aria-selected={activeSection === index}
              className={cn(
                'min-h-10 rounded-xl border px-3 text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
                activeSection === index
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              key={section.title}
              onClick={() => setActiveSection(index)}
              role="tab"
              type="button"
            >
              {section.title}
            </button>
          ))}
        </div>
        {selectedSection ? (
          <div
            aria-label={selectedSection.title}
            className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 p-4"
            role="tabpanel"
          >
            <h3 className="font-black">{selectedSection.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedSection.description}
            </p>
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {selectedSection.items.map((item) => (
                <li
                  className="flex items-start gap-2 text-sm leading-6 text-foreground"
                  key={item}
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <section aria-labelledby="records-title" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-black" id="records-title">
              میز کار و صف پیگیری
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              داده‌ها کاملاً ساختگی و فقط برای بررسی رفتار رابط هستند.
            </p>
          </div>
          <PreviewBadge />
        </div>

        <FilterBar className="items-end">
          <FormField id={`${config.key}-search`} label="جست‌وجو">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="absolute end-3 top-3.5 size-4 text-muted-foreground"
              />
              <Input
                className="pe-10"
                id={`${config.key}-search`}
                onChange={(event) => {
                  setPage(1);
                  setQuery(event.target.value);
                }}
                placeholder="عنوان یا شناسه نمونه"
                value={query}
              />
            </div>
          </FormField>
          <FormField label="وضعیت">
            <Select
              onValueChange={(value) => {
                setPage(1);
                setStatus(value as typeof status);
              }}
              value={status}
            >
              <SelectTrigger className="min-w-40">
                <Filter aria-hidden="true" className="size-4 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                {Object.keys(statusTone).map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="مرتب‌سازی">
            <Select
              onValueChange={(value) => setSort(value as typeof sort)}
              value={sort}
            >
              <SelectTrigger className="min-w-40">
                <SlidersHorizontal
                  aria-hidden="true"
                  className="size-4 text-primary"
                />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">جدیدترین نمونه</SelectItem>
                <SelectItem value="title">عنوان</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="بررسی State">
            <Select
              onValueChange={(value) => setState(value as PreviewState)}
              value={state}
            >
              <SelectTrigger className="min-w-40">
                <CircleAlert
                  aria-hidden="true"
                  className="size-4 text-primary"
                />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(stateLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <Button onClick={resetFilters} type="button" variant="ghost">
            پاک‌کردن فیلتر
          </Button>
        </FilterBar>

        {state !== 'preview' ? (
          <WorkspaceState onReset={() => setState('preview')} state={state} />
        ) : rows.length === 0 ? (
          <EmptyState
            action={
              <Button onClick={resetFilters} variant="outline">
                حذف فیلترها
              </Button>
            }
            description="عبارت یا وضعیت دیگری را امتحان کنید."
            title="نمونه‌ای با این فیلتر پیدا نشد"
          />
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="hidden grid-cols-[1.1fr_.8fr_.8fr_.8fr_.7fr] gap-3 border-b border-border bg-muted/50 px-4 py-3 text-xs font-black text-muted-foreground lg:grid">
                <span>پرونده</span>
                <span>جریان</span>
                <span>وضعیت</span>
                <span>مسئول</span>
                <span>اقدام</span>
              </div>
              <div className="divide-y divide-border">
                {pagedRows.map((row) => (
                  <article
                    className="grid gap-3 p-4 lg:grid-cols-[1.1fr_.8fr_.8fr_.8fr_.7fr] lg:items-center"
                    key={row.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{row.title}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {row.id} · {row.updatedAt}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">{row.flow}</p>
                    <span
                      className={cn(
                        'w-fit rounded-full px-2.5 py-1 text-xs font-bold',
                        statusTone[row.status],
                      )}
                    >
                      {row.status}
                    </span>
                    <p className="text-sm text-muted-foreground">{row.owner}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        aria-label={`مشاهده ${row.title}`}
                        onClick={() => setDialog({ mode: 'view', row })}
                        size="sm"
                        variant="ghost"
                      >
                        <Eye aria-hidden="true" className="size-4" />
                        مشاهده
                      </Button>
                      <Button
                        aria-label={`ویرایش ${row.title}`}
                        onClick={() => setDialog({ mode: 'edit', row })}
                        size="sm"
                        variant="outline"
                      >
                        <FilePenLine aria-hidden="true" className="size-4" />
                        ویرایش
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <nav
              aria-label="صفحه‌بندی نمونه‌ها"
              className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
            >
              <span>
                {rows.length.toLocaleString('fa-IR')} نمونه · صفحه{' '}
                {safePage.toLocaleString('fa-IR')} از{' '}
                {pageCount.toLocaleString('fa-IR')}
              </span>
              <div className="flex gap-1">
                <Button
                  aria-label="صفحه قبل"
                  disabled={safePage <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  size="icon"
                  variant="outline"
                >
                  <ChevronRight aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  aria-label="صفحه بعد"
                  disabled={safePage >= pageCount}
                  onClick={() =>
                    setPage((value) => Math.min(pageCount, value + 1))
                  }
                  size="icon"
                  variant="outline"
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </nav>
          </>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <KeyRound aria-hidden="true" className="size-5 text-primary" />
            <h2 className="font-black">Permission Matrix پیشنهادی</h2>
          </div>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            دسترسی‌ها deny-by-default هستند و انتشار نهایی در Work Item مالک
            ماژول انجام می‌شود.
          </p>
          <ul className="mt-4 space-y-2">
            {config.permissions.map((permission) => (
              <li
                className="rounded-lg bg-muted/60 px-3 py-2 font-mono text-xs text-foreground"
                key={permission}
              >
                {permission}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Clock3 aria-hidden="true" className="size-5 text-primary" />
            <h2 className="font-black">Timeline و Audit</h2>
          </div>
          <ol className="mt-4 space-y-4">
            {[
              'ایجاد نمونه طراحی بدون ذخیره',
              'بررسی مرز دسترسی و مالکیت',
              'انتظار اتصال قرارداد عمومی',
            ].map((event, index) => (
              <li className="relative flex gap-3" key={event}>
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary ring-4 ring-primary/10" />
                <div>
                  <p className="text-sm font-bold">{event}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    رویداد Preview {String(index + 1).padStart(2, '0')} · بدون
                    actor یا PII واقعی
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Link2 aria-hidden="true" className="size-5 text-primary" />
            <h2 className="font-black">Referenceهای بین‌ماژولی</h2>
          </div>
          <ul className="mt-4 space-y-3">
            {config.references.map((reference) => (
              <li
                className="rounded-xl border border-border bg-muted/30 p-3"
                key={reference.label}
              >
                <p className="text-sm font-black">{reference.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  مالک: {reference.owner}
                </p>
                <p className="mt-2 break-words font-mono text-[11px] text-primary">
                  {reference.contract}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <Card className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-black">مسیرهای خروجی همین ماژول</h2>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            دکمه‌ها intent و permission را نشان می‌دهند؛ تا اتصال Worker و
            Documents هیچ فایل ساختگی تولید نمی‌شود.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {config.outputFormats.map((format) => (
            <Button
              key={format}
              onClick={() =>
                setNotice(
                  `خروجی «${format}» Deferred است؛ درخواست یا فایل واقعی ایجاد نشد.`,
                )
              }
              variant="outline"
            >
              <Download aria-hidden="true" className="size-4" />
              {format}
            </Button>
          ))}
        </div>
      </Card>

      {dialog ? (
        <PreviewDialog
          config={config}
          mode={dialog.mode}
          onClose={() => setDialog(null)}
          onSubmit={() => {
            setDialog(null);
            setNotice('فرم Preview بسته شد؛ هیچ داده‌ای ذخیره یا ارسال نشد.');
          }}
          row={dialog.row}
        />
      ) : null}
    </div>
  );
}
