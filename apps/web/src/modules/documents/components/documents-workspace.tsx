'use client';

import {
  Archive,
  ArchiveRestore,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileClock,
  FileKey,
  FileLock2,
  FilePlus2,
  Files,
  FileSearch,
  Filter,
  FolderKanban,
  HardDrive,
  History,
  LockKeyhole,
  Search,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  UploadCloud,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import {
  documentsLocalPermissions,
  documentsPhaseANotice,
  documentsPreviewStates,
  type DocumentsPreviewState,
} from '../api/contracts';
import {
  defaultDocumentQuery,
  documentCategories,
  filterPreviewDocuments,
  normalizeDocumentQuery,
  paginatePreviewDocuments,
  previewAccessHistory,
  previewDocuments,
  shouldBlockPreviewDownload,
  stateDescription,
  type DocumentsSection,
  type PreviewConfidentiality,
  type PreviewDocument,
  type PreviewDocumentCategory,
  type PreviewScanStatus,
} from '../model/documents';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterBar,
  FormField,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@/components/ui';
import { cn } from '@/lib/utils';

const sections: readonly {
  key: DocumentsSection;
  label: string;
  icon: typeof Files;
}[] = [
  { key: 'dashboard', label: 'داشبورد اسناد', icon: Boxes },
  { key: 'all', label: 'همه اسناد', icon: Files },
  { key: 'categories', label: 'دسته‌بندی‌ها', icon: FolderKanban },
  { key: 'versions', label: 'نسخه‌های فایل', icon: FileClock },
  { key: 'sensitive', label: 'فایل‌های محرمانه', icon: FileLock2 },
  { key: 'quarantine', label: 'قرنطینه و امنیت', icon: ShieldAlert },
  { key: 'archive', label: 'آرشیو', icon: Archive },
  { key: 'history', label: 'تاریخچه دسترسی', icon: History },
];

const confidentialityLabels: Readonly<Record<PreviewConfidentiality, string>> =
  {
    PUBLIC: 'عمومی',
    INTERNAL: 'داخلی',
    CONFIDENTIAL: 'محرمانه',
    RESTRICTED: 'بسیار محدود',
  };

const scanLabels: Readonly<Record<PreviewScanStatus, string>> = {
  PENDING_SCAN: 'در انتظار اسکن',
  CLEAN: 'پاک',
  INFECTED: 'آلوده',
  SCAN_FAILED: 'خطای اسکن',
  QUARANTINED: 'قرنطینه',
  AWAITING_ANTIVIRUS_ADAPTER: 'در انتظار اتصال آنتی‌ویروس',
};

const scanTone: Readonly<Record<PreviewScanStatus, string>> = {
  PENDING_SCAN: 'bg-amber-100 text-amber-800',
  CLEAN: 'bg-emerald-100 text-emerald-800',
  INFECTED: 'bg-red-100 text-red-800',
  SCAN_FAILED: 'bg-orange-100 text-orange-800',
  QUARANTINED: 'bg-red-100 text-red-800',
  AWAITING_ANTIVIRUS_ADAPTER: 'bg-slate-200 text-slate-700',
};

function formatUtc(value: string): string {
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function PreviewBadge() {
  return (
    <Badge className="border border-cyan-200 bg-cyan-50 text-cyan-800">
      Preview · Awaiting Persistence
    </Badge>
  );
}

function MetricCard({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: typeof Files;
  label: string;
  tone: string;
  value: string;
}) {
  return (
    <Card className="relative overflow-hidden p-4">
      <span
        aria-hidden="true"
        className={cn('absolute inset-y-0 start-0 w-1', tone)}
      />
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-muted text-primary">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <PreviewBadge />
      </div>
      <p className="mt-3 text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
        {detail}
      </p>
    </Card>
  );
}

function StateSurface({
  onReset,
  state,
}: {
  onReset: () => void;
  state: DocumentsPreviewState;
}) {
  if (state === 'loading') {
    return (
      <Card aria-busy="true" className="space-y-4 p-5" role="status">
        <span className="sr-only">در حال بارگذاری اسناد</span>
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton className="h-14" key={index} />
        ))}
      </Card>
    );
  }
  const action = (
    <Button onClick={onReset} variant="outline">
      بازگشت به Preview
    </Button>
  );
  if (state === 'error' || state === 'conflict') {
    return (
      <ErrorState
        action={action}
        description={stateDescription(state)}
        title={state === 'conflict' ? 'تعارض نسخه سند' : 'خطا در دریافت اسناد'}
      />
    );
  }
  return (
    <EmptyState
      action={action}
      description={stateDescription(state)}
      icon={state === 'forbidden' ? LockKeyhole : FileSearch}
      title={
        state === 'unauthorized'
          ? 'ورود به سامانه لازم است'
          : state === 'forbidden'
            ? 'دسترسی به این محدوده مجاز نیست'
            : 'سندی برای نمایش وجود ندارد'
      }
    />
  );
}

function DocumentsTable({
  documents,
  onAction,
}: {
  documents: readonly PreviewDocument[];
  onAction: (message: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="min-w-[1760px] w-full border-collapse text-start text-sm">
        <caption className="sr-only">
          فهرست اسناد Preview با Metadata و کنترل دسترسی
        </caption>
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr>
            {[
              'نام نمایشی',
              'نوع سند',
              'ماژول مالک',
              'رکورد مرتبط',
              'شرکت صادرکننده',
              'نسخه',
              'حجم / فرمت',
              'محرمانگی',
              'وضعیت اسکن',
              'آرشیو',
              'ثبت‌کننده',
              'ایجاد / آخرین تغییر',
              'اقدام',
            ].map((column) => (
              <th
                className="whitespace-nowrap px-4 py-3 text-start font-black"
                key={column}
                scope="col"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {documents.map((document) => (
            <tr className="align-top hover:bg-muted/25" key={document.id}>
              <td className="max-w-64 px-4 py-4">
                <p className="font-black">{document.displayName}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {document.id}
                </p>
              </td>
              <td className="px-4 py-4">{document.category}</td>
              <td className="px-4 py-4">{document.sourceModule}</td>
              <td className="max-w-48 break-all px-4 py-4 font-mono text-xs text-muted-foreground">
                {document.sourceRecord}
              </td>
              <td className="px-4 py-4">{document.issuer}</td>
              <td className="px-4 py-4 font-black">
                v{document.version.toLocaleString('fa-IR')}
              </td>
              <td className="px-4 py-4">
                {document.sizeLabel}
                <span className="ms-1 text-xs text-muted-foreground">
                  · {document.format}
                </span>
              </td>
              <td className="px-4 py-4">
                <Badge
                  className={
                    document.confidentiality === 'RESTRICTED'
                      ? 'bg-red-100 text-red-800'
                      : ''
                  }
                >
                  {confidentialityLabels[document.confidentiality]}
                </Badge>
              </td>
              <td className="px-4 py-4">
                <Badge className={scanTone[document.scanStatus]}>
                  {scanLabels[document.scanStatus]}
                </Badge>
              </td>
              <td className="px-4 py-4">
                {document.archiveStatus === 'ARCHIVED' ? 'آرشیوشده' : 'فعال'}
                {document.legalHold ? (
                  <p className="mt-1 text-xs font-bold text-red-700">
                    Legal Hold
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-4">{document.createdBy}</td>
              <td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground">
                <p>{formatUtc(document.createdAt)}</p>
                <p className="mt-1">{formatUtc(document.updatedAt)}</p>
              </td>
              <td className="px-4 py-4">
                <div className="flex gap-1">
                  <Button
                    aria-label={`مشاهده ${document.displayName}`}
                    onClick={() =>
                      onAction(
                        document.masked
                          ? 'نمایش Masked باقی ماند؛ Permission حساس و Reason معتبر لازم است.'
                          : 'جزئیات Preview نمایش داده می‌شود؛ Access Audit واقعی ثبت نشد.',
                      )
                    }
                    size="sm"
                    variant="ghost"
                  >
                    <Eye aria-hidden="true" className="size-4" />
                    مشاهده
                  </Button>
                  <Button
                    aria-label={`درخواست دانلود ${document.displayName}`}
                    onClick={() =>
                      onAction(
                        `دانلود مسدود شد: ${shouldBlockPreviewDownload(document)}. Signed URL واقعی ساخته نشد.`,
                      )
                    }
                    size="sm"
                    variant="outline"
                  >
                    <Download aria-hidden="true" className="size-4" />
                    دانلود
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionCard({ children }: { children: ReactNode }) {
  return <Card className="p-5">{children}</Card>;
}

export function DocumentsWorkspace() {
  const [activeSection, setActiveSection] =
    useState<DocumentsSection>('dashboard');
  const [previewState, setPreviewState] =
    useState<DocumentsPreviewState>('preview');
  const [query, setQuery] = useState(defaultDocumentQuery);
  const [notice, setNotice] = useState('');
  const [sensitiveReason, setSensitiveReason] = useState('');

  const filtered = useMemo(
    () => filterPreviewDocuments(previewDocuments, query),
    [query],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / query.pageSize));
  const currentPage = Math.min(query.page, totalPages);
  const paged = paginatePreviewDocuments(filtered, currentPage, query.pageSize);

  const setQueryField = <K extends keyof typeof query>(
    field: K,
    value: (typeof query)[K],
  ) =>
    setQuery((current) =>
      normalizeDocumentQuery({ ...current, [field]: value, page: 1 }),
    );

  const metrics = [
    {
      label: 'کل فایل‌ها',
      value: '۱٬۲۴۸',
      detail: 'عدد نمایشی؛ اتصال Persistence انجام نشده',
      icon: Files,
      tone: 'bg-blue-500',
    },
    {
      label: 'اسناد جدید',
      value: '۲۳',
      detail: '۲۴ ساعت گذشته · Preview',
      icon: FilePlus2,
      tone: 'bg-cyan-500',
    },
    {
      label: 'در انتظار اسکن',
      value: '۷',
      detail: 'دانلود تا CLEAN ممنوع',
      icon: ShieldCheck,
      tone: 'bg-amber-500',
    },
    {
      label: 'قرنطینه‌شده',
      value: '۲',
      detail: 'نیازمند Permission مدیریت قرنطینه',
      icon: ShieldAlert,
      tone: 'bg-red-500',
    },
    {
      label: 'اسناد محرمانه',
      value: '۱۸۶',
      detail: 'Reason و Audit برای مشاهده/دانلود',
      icon: FileKey,
      tone: 'bg-violet-500',
    },
    {
      label: 'آرشیوشده',
      value: '۳۱۴',
      detail: 'تاریخچه نسخه حذف نمی‌شود',
      icon: Archive,
      tone: 'bg-slate-500',
    },
    {
      label: 'حجم مصرف‌شده',
      value: '۱۸٫۷ GB',
      detail: 'برآورد synthetic از Object Storage خصوصی',
      icon: HardDrive,
      tone: 'bg-emerald-500',
    },
    {
      label: 'نزدیک حذف یا انقضا',
      value: '۹',
      detail: 'حذف دائمی تا تصویب Policy غیرفعال',
      icon: Clock3,
      tone: 'bg-orange-500',
    },
  ] as const;

  function resetFilters() {
    setQuery(defaultDocumentQuery);
    setPreviewState('preview');
  }

  function renderAllDocuments() {
    return (
      <section aria-labelledby="documents-list-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black" id="documents-list-title">
              همه اسناد
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              جست‌وجو، مرتب‌سازی و Pagination در قرارداد آینده سمت سرور اجرا
              می‌شوند.
            </p>
          </div>
          <PreviewBadge />
        </div>
        <FilterBar className="flex-wrap">
          <FormField id="documents-search" label="نام، شناسه یا مرجع">
            <div className="relative min-w-56">
              <Search
                aria-hidden="true"
                className="absolute end-3 top-3.5 size-4 text-muted-foreground"
              />
              <Input
                className="pe-10"
                id="documents-search"
                onChange={(event) =>
                  setQueryField('search', event.target.value)
                }
                placeholder="جست‌وجوی اسناد"
                value={query.search}
              />
            </div>
          </FormField>
          <FormField label="دسته">
            <Select
              onValueChange={(value) =>
                setQueryField(
                  'category',
                  value as PreviewDocumentCategory | 'ALL',
                )
              }
              value={query.category}
            >
              <SelectTrigger className="min-w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">همه دسته‌ها</SelectItem>
                {documentCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="محرمانگی">
            <Select
              onValueChange={(value) =>
                setQueryField(
                  'confidentiality',
                  value as PreviewConfidentiality | 'ALL',
                )
              }
              value={query.confidentiality}
            >
              <SelectTrigger className="min-w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">همه سطوح</SelectItem>
                {Object.entries(confidentialityLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="وضعیت اسکن">
            <Select
              onValueChange={(value) =>
                setQueryField('scanStatus', value as PreviewScanStatus | 'ALL')
              }
              value={query.scanStatus}
            >
              <SelectTrigger className="min-w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
                {Object.entries(scanLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="آرشیو">
            <Select
              onValueChange={(value) =>
                setQueryField(
                  'archiveStatus',
                  value as 'ALL' | 'ACTIVE' | 'ARCHIVED',
                )
              }
              value={query.archiveStatus}
            >
              <SelectTrigger className="min-w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">همه</SelectItem>
                <SelectItem value="ACTIVE">فعال</SelectItem>
                <SelectItem value="ARCHIVED">آرشیوشده</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="مرتب‌سازی">
            <Select
              onValueChange={(value) =>
                setQueryField('sortBy', value as typeof query.sortBy)
              }
              value={query.sortBy}
            >
              <SelectTrigger className="min-w-36">
                <Filter aria-hidden="true" className="size-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updatedAt">آخرین تغییر</SelectItem>
                <SelectItem value="displayName">نام سند</SelectItem>
                <SelectItem value="sizeBytes">حجم فایل</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <Button onClick={resetFilters} variant="ghost">
            پاک‌کردن فیلترها
          </Button>
        </FilterBar>
        {previewState === 'preview' ? (
          paged.length > 0 ? (
            <>
              <DocumentsTable documents={paged} onAction={setNotice} />
              <nav
                aria-label="صفحه‌بندی اسناد"
                className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
              >
                <span>
                  {filtered.length.toLocaleString('fa-IR')} نتیجه Preview · صفحه{' '}
                  {currentPage.toLocaleString('fa-IR')} از{' '}
                  {totalPages.toLocaleString('fa-IR')}
                </span>
                <div className="flex gap-1">
                  <Button
                    aria-label="صفحه قبل"
                    disabled={currentPage <= 1}
                    onClick={() =>
                      setQuery((current) => ({
                        ...current,
                        page: currentPage - 1,
                      }))
                    }
                    size="icon"
                    variant="outline"
                  >
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </Button>
                  <Button
                    aria-label="صفحه بعد"
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      setQuery((current) => ({
                        ...current,
                        page: currentPage + 1,
                      }))
                    }
                    size="icon"
                    variant="outline"
                  >
                    <ChevronLeft aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              </nav>
            </>
          ) : (
            <EmptyState
              action={
                <Button onClick={resetFilters} variant="outline">
                  حذف فیلترها
                </Button>
              }
              description="عبارت یا فیلتر دیگری را امتحان کنید."
              title="سندی پیدا نشد"
            />
          )
        ) : (
          <StateSurface
            onReset={() => setPreviewState('preview')}
            state={previewState}
          />
        )}
      </section>
    );
  }

  function renderSection(): ReactNode {
    if (activeSection === 'all') return renderAllDocuments();
    if (activeSection === 'dashboard')
      return (
        <div className="space-y-4">
          <section
            aria-label="شاخص‌های اسناد"
            className="grid grid-cols-2 gap-3 xl:grid-cols-4"
          >
            {metrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </section>
          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <SectionCard>
              <div className="flex items-center gap-2">
                <ShieldCheck
                  aria-hidden="true"
                  className="size-5 text-primary"
                />
                <h2 className="font-black">وضعیت امنیت فایل</h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  ['CLEAN', '۱٬۲۳۳', 'دانلود فقط پس از مجوز'],
                  ['PENDING / FAILED', '۹', 'دانلود عمومی مسدود'],
                  ['QUARANTINED', '۲', 'جداسازی در Object Storage'],
                ].map(([label, value, detail]) => (
                  <div className="rounded-xl bg-muted/60 p-4" key={label}>
                    <p className="font-mono text-xs text-primary">{label}</p>
                    <p className="mt-2 text-xl font-black">{value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {detail}
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>
            <Alert
              description="Adapter واقعی Antivirus در این فاز وجود ندارد. وضعیت AWAITING_ANTIVIRUS_ADAPTER صریح است و نتیجه CLEAN ساختگی تولید نمی‌شود."
              title="در انتظار Antivirus Adapter"
              tone="warning"
            />
          </div>
          <Alert
            description="DEC-OPEN-006 هنوز Retention/Residency و مدیریت کلید را تعیین نکرده است. حذف دائمی غیرفعال و تاریخ‌های حذف فقط پیشنهاد Preview هستند."
            title="Retention Policy هنوز قطعی نیست"
            tone="warning"
          />
        </div>
      );
    if (activeSection === 'categories')
      return (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {documentCategories.map((category, index) => (
            <Card className="p-4" key={category}>
              <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                <FolderKanban aria-hidden="true" className="size-5" />
              </span>
              <h2 className="mt-3 font-black">{category}</h2>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                کد دسته ماژول‌محلی و مستقل از جدول ماژول تولیدکننده.
              </p>
              <p className="mt-3 text-sm font-black">
                {(index * 13 + 7).toLocaleString('fa-IR')} فایل Preview
              </p>
            </Card>
          ))}
        </section>
      );
    if (activeSection === 'versions')
      return (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
          <SectionCard>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-black">نسخه‌های قرارداد فروش نمونه</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  نسخه جاری v3 · نسخه‌های قبلی immutable
                </p>
              </div>
              <PreviewBadge />
            </div>
            <ol className="mt-5 space-y-3">
              {[
                ['v3', 'نسخه جاری', 'اصلاح پیوست نهایی', 'CLEAN', '۲٫۴ MB'],
                [
                  'v2',
                  'نسخه قبلی',
                  'اصلاح اطلاعات صادرکننده',
                  'CLEAN',
                  '۲٫۲ MB',
                ],
                [
                  'v1',
                  'نسخه اولیه',
                  'تحویل فایل نهایی از Sales',
                  'CLEAN',
                  '۲٫۱ MB',
                ],
              ].map(([version, status, note, scan, size]) => (
                <li
                  className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={version}
                >
                  <div>
                    <p className="font-black">
                      {version} · {status}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {note} · {scan} · {size}
                    </p>
                  </div>
                  <Button
                    onClick={() =>
                      setNotice(
                        'دانلود نسخه در Preview غیرفعال است؛ Signed URL ساخته نشد.',
                      )
                    }
                    size="sm"
                    variant="outline"
                  >
                    <Download aria-hidden="true" className="size-4" />
                    دانلود مجاز
                  </Button>
                </li>
              ))}
            </ol>
          </SectionCard>
          <Alert
            description="ایجاد نسخه جدید Object Key و SHA-256 جدید می‌خواهد؛ نسخه قبلی هرگز overwrite یا حذف نمی‌شود."
            title="Version Immutability"
          />
        </div>
      );
    if (activeSection === 'sensitive')
      return (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
          <SectionCard>
            <div className="flex items-center gap-2">
              <FileLock2 aria-hidden="true" className="size-5 text-primary" />
              <h2 className="font-black">کنترل فایل حساس</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(confidentialityLabels).map(([code, label]) => (
                <div
                  className="rounded-xl border border-border p-3 text-center"
                  key={code}
                >
                  <p className="font-mono text-xs text-primary">{code}</p>
                  <p className="mt-1 text-sm font-black">{label}</p>
                </div>
              ))}
            </div>
            <FormField
              description="حداقل ۵ نویسه؛ در نسخه واقعی همراه Actor و نتیجه Audit می‌شود."
              id="sensitive-reason"
              label="Reason مشاهده یا دانلود حساس"
              required
            >
              <Input
                id="sensitive-reason"
                onChange={(event) => setSensitiveReason(event.target.value)}
                placeholder="دلیل عملیاتی مجاز"
                value={sensitiveReason}
              />
            </FormField>
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
              <p className="font-black">سند محرمانه ••••••••</p>
              <p className="mt-1 text-xs">
                نمایش Masked برای کاربر فاقد documents.sensitive.read
              </p>
              <Button
                className="mt-3"
                disabled={sensitiveReason.trim().length < 5}
                onClick={() =>
                  setNotice(
                    'Reason در Preview بررسی شد؛ فایل Unmask نشد و Audit واقعی ثبت نشد.',
                  )
                }
                size="sm"
                variant="outline"
              >
                <Eye aria-hidden="true" className="size-4" />
                درخواست مشاهده
              </Button>
            </div>
          </SectionCard>
          <SectionCard>
            <h2 className="font-black">Permissionهای ماژول‌محلی</h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              Proposal است؛ IAM مرکزی به‌علت قفل فعال تغییر نکرد.
            </p>
            <ul className="mt-3 space-y-1.5">
              {documentsLocalPermissions.map((permission) => (
                <li
                  className="rounded-lg bg-muted px-3 py-2 font-mono text-xs"
                  key={permission}
                >
                  {permission}
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      );
    if (activeSection === 'quarantine')
      return (
        <div className="space-y-4">
          <Alert
            description="فایل PENDING_SCAN، SCAN_FAILED، INFECTED یا QUARANTINED قابل دانلود عمومی نیست. Adapter غایب با AWAITING_ANTIVIRUS_ADAPTER نمایش داده می‌شود."
            title="Fail-closed Security Gate"
            tone="warning"
          />
          <DocumentsTable
            documents={previewDocuments.filter(
              (document) => document.scanStatus !== 'CLEAN',
            )}
            onAction={setNotice}
          />
        </div>
      );
    if (activeSection === 'archive')
      return (
        <div className="grid gap-4 xl:grid-cols-3">
          <SectionCard>
            <Archive aria-hidden="true" className="size-6 text-primary" />
            <h2 className="mt-3 font-black">Archive / Restore</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              هر دو عملیات Reason، Permission، Actor، UTC و رکورد تاریخچه
              immutable می‌خواهند.
            </p>
            <Button
              className="mt-4"
              onClick={() => setNotice('Restore در Preview ذخیره نشد.')}
              variant="outline"
            >
              <ArchiveRestore aria-hidden="true" className="size-4" />
              بازیابی نمایشی
            </Button>
          </SectionCard>
          <SectionCard>
            <FileKey aria-hidden="true" className="size-6 text-primary" />
            <h2 className="mt-3 font-black">Legal Hold</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Hold فعال حذف و گردش Retention را متوقف می‌کند؛ Release مجوز و
              دلیل مستقل دارد.
            </p>
            <Badge className="mt-4 bg-red-100 text-red-800">
              ۱ Hold فعال Preview
            </Badge>
          </SectionCard>
          <SectionCard>
            <TriangleAlert
              aria-hidden="true"
              className="size-6 text-amber-600"
            />
            <h2 className="mt-3 font-black">Retention Policy</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Policy حقوقی قطعی نشده است. تاریخ حذف پیشنهادی فقط هشدار است.
            </p>
            <Button className="mt-4" disabled variant="destructive">
              حذف دائمی غیرفعال
            </Button>
          </SectionCard>
        </div>
      );
    return (
      <SectionCard>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-black">تاریخچه دسترسی</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              IP خلاصه‌شده، User Agent، Reason و نتیجه؛ بدون URL امضاشده یا PII
              حساس.
            </p>
          </div>
          <PreviewBadge />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                {[
                  'عملیات',
                  'Actor',
                  'زمان UTC',
                  'IP خلاصه',
                  'User Agent',
                  'Reason',
                  'نتیجه',
                ].map((column) => (
                  <th className="px-3 py-3 text-start" key={column}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {previewAccessHistory.map((event) => (
                <tr key={event.id}>
                  <td className="px-3 py-4 font-black">{event.action}</td>
                  <td className="px-3 py-4">{event.actor}</td>
                  <td className="px-3 py-4">{formatUtc(event.occurredAt)}</td>
                  <td className="px-3 py-4 font-mono text-xs">
                    {event.ipSummary}
                  </td>
                  <td className="px-3 py-4">{event.userAgent}</td>
                  <td className="px-3 py-4">{event.reason}</td>
                  <td className="px-3 py-4">
                    <Badge
                      className={
                        event.outcome === 'ردشده'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }
                    >
                      {event.outcome}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    );
  }

  return (
    <main className="space-y-6" id="main-content">
      <PageHeader
        actions={
          <>
            <Button
              onClick={() => {
                setActiveSection('all');
                setNotice(
                  'نشست Upload فقط Preview است؛ Object Storage و Persistence متصل نیستند.',
                );
              }}
            >
              <UploadCloud aria-hidden="true" className="size-4" />
              بارگذاری فایل
            </Button>
            <PreviewBadge />
          </>
        }
        description="Archive مرکزی فایل نهایی، Metadata، نسخه، محرمانگی، اسکن امنیتی و تاریخچه دسترسی؛ Render و Issue در ماژول تولیدکننده باقی می‌ماند."
        eyebrow="DOCUMENTS-001 · PC-B · Phase A"
        title="اسناد و فایل‌ها"
      />
      <Alert
        description={documentsPhaseANotice}
        title="Foundation ماژول‌محلی؛ بدون فایل یا موفقیت ساختگی"
      />
      {notice ? (
        <Alert
          className="relative"
          description={notice}
          title="نتیجه اقدام Preview"
        >
          <Button
            className="absolute end-2 top-2"
            onClick={() => setNotice('')}
            size="sm"
            variant="ghost"
          >
            بستن
          </Button>
        </Alert>
      ) : null}
      <Card className="p-3">
        <nav
          aria-label="بخش‌های Workspace اسناد"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {sections.map(({ icon: Icon, key, label }) => (
            <button
              aria-current={activeSection === key ? 'page' : undefined}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
                activeSection === key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              key={key}
              onClick={() => setActiveSection(key)}
              type="button"
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </button>
          ))}
        </nav>
      </Card>
      <FilterBar className="items-end">
        <FormField label="بررسی Stateهای UI">
          <Select
            onValueChange={(value) =>
              setPreviewState(value as DocumentsPreviewState)
            }
            value={previewState}
          >
            <SelectTrigger className="min-w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {documentsPreviewStates.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <p className="pb-3 text-xs text-muted-foreground">
          Loading · Empty · Error · Unauthorized · Forbidden · Conflict ·
          Preview
        </p>
      </FilterBar>
      {activeSection === 'all' ? (
        renderSection()
      ) : previewState === 'preview' ? (
        renderSection()
      ) : (
        <StateSurface
          onReset={() => setPreviewState('preview')}
          state={previewState}
        />
      )}
    </main>
  );
}
