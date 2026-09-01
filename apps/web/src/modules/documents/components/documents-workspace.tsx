'use client';

import {
  Archive,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  ClockAlert,
  Copy,
  FileLock2,
  Files,
  FileSearch,
  HeartHandshake,
  LayoutDashboard,
  Link2,
  PackageSearch,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  ShoppingCart,
  Star,
  UploadCloud,
  UserRound,
} from 'lucide-react';
import type {
  BranchReference,
  DocumentAuditEventV1,
  DocumentDetailV1,
  DocumentDomainCode,
  DocumentListItemV1,
  DocumentListQueryV1,
  DocumentOptionsResponseV1,
} from '@rubi/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { documentsApi, DocumentsApiError } from '../api/client';
import { DocumentDetailDialog } from './document-detail-dialog';
import { DocumentUploadDialog } from './document-upload-dialog';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  DatePicker,
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

type SectionKey =
  | 'overview'
  | 'all'
  | 'customer'
  | 'sales'
  | 'travel'
  | 'procurement'
  | 'hr'
  | 'expired'
  | 'shares'
  | 'archive';

type PersonalViewKey = 'owned' | 'uploaded' | 'recent' | 'favorites';

const sections: readonly {
  key: SectionKey;
  label: string;
  icon: typeof Files;
  domain?: DocumentDomainCode;
}[] = [
  { key: 'overview', label: 'نمای کلی', icon: LayoutDashboard },
  { key: 'all', label: 'همه اسناد', icon: Files },
  {
    key: 'customer',
    label: 'مشتری و هویت',
    icon: UserRound,
    domain: 'CUSTOMER_IDENTITY',
  },
  {
    key: 'sales',
    label: 'فروش و قرارداد',
    icon: ShoppingCart,
    domain: 'SALES',
  },
  {
    key: 'travel',
    label: 'سفر و رزرواسیون',
    icon: PackageSearch,
    domain: 'TRAVEL',
  },
  {
    key: 'procurement',
    label: 'خرید و مالی',
    icon: Building2,
    domain: 'PROCUREMENT',
  },
  {
    key: 'hr',
    label: 'سازمان و منابع انسانی',
    icon: HeartHandshake,
    domain: 'HUMAN_RESOURCES',
  },
  { key: 'expired', label: 'مدارک ناقص و منقضی', icon: ClockAlert },
  { key: 'shares', label: 'اشتراک‌گذاری‌ها', icon: Link2 },
  { key: 'archive', label: 'مدیریت آرشیو', icon: Archive },
];

const archiveSections = [
  'دسته‌بندی و برچسب',
  'سیاست نوع سند',
  'بررسی و قرنطینه',
  'مسئول و مالک فایل',
  'نگهداری و توقف حذف',
  'حذف منطقی و بازیابی',
  'سلامت آرشیو',
  'خروجی‌ها و پردازش‌ها',
] as const;

const personalViews: readonly {
  key: PersonalViewKey;
  label: string;
  icon: typeof Files;
}[] = [
  { key: 'owned', label: 'اسناد من', icon: FileLock2 },
  { key: 'uploaded', label: 'بارگذاری‌های من', icon: UploadCloud },
  { key: 'recent', label: 'اخیراً دیده‌شده', icon: FileSearch },
  { key: 'favorites', label: 'علاقه‌مندی‌ها', icon: Star },
] as const;

const sectionSurface =
  'border-sky-200/80 bg-gradient-to-br from-white via-sky-50/55 to-blue-100/45 shadow-sm transition duration-200 hover:border-sky-300 hover:shadow-md dark:border-sky-400/20 dark:from-surface dark:via-sky-950/30 dark:to-blue-950/25';

const archiveTone = [
  'border-sky-200 bg-gradient-to-br from-sky-50 to-blue-100/70 dark:border-sky-400/20 dark:from-sky-950/45 dark:to-blue-950/30',
  'border-violet-200 bg-gradient-to-br from-violet-50 to-purple-100/70 dark:border-violet-400/20 dark:from-violet-950/45 dark:to-purple-950/30',
  'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100/70 dark:border-emerald-400/20 dark:from-emerald-950/45 dark:to-teal-950/30',
  'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-100/70 dark:border-amber-400/20 dark:from-amber-950/45 dark:to-orange-950/30',
] as const;

const confidentialityLabel = {
  PUBLIC: 'عمومی',
  INTERNAL: 'داخلی',
  CONFIDENTIAL: 'محرمانه',
  RESTRICTED: 'بسیار محدود',
} as const;

const scanLabel = {
  PENDING_SCAN: 'در حال اسکن امنیتی',
  CLEAN: 'پاک',
  INFECTED: 'آلوده',
  SCAN_FAILED: 'خطای اسکن',
  QUARANTINED: 'قرنطینه',
  AWAITING_ANTIVIRUS_ADAPTER: 'نیازمند بررسی امنیتی',
} as const;

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(new Date(value))
    : 'بدون انقضا';
}

function scanTone(status: DocumentListItemV1['currentVersion']['scanStatus']) {
  if (status === 'CLEAN') return 'bg-emerald-100 text-emerald-800';
  if (status === 'PENDING_SCAN' || status === 'AWAITING_ANTIVIRUS_ADAPTER')
    return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

function Metric({
  hint,
  icon: Icon,
  label,
  tone = 'sky',
  value,
}: {
  hint: string;
  icon: typeof Files;
  label: string;
  tone?: 'amber' | 'emerald' | 'sky' | 'violet';
  value: number;
}) {
  const toneClasses = {
    amber: {
      accent: 'bg-amber-400',
      card: 'border-amber-200/80 bg-gradient-to-br from-amber-50 to-amber-100/70 dark:border-amber-400/20 dark:from-amber-950/55 dark:to-amber-900/30',
      icon: 'bg-amber-200/70 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
    },
    emerald: {
      accent: 'bg-emerald-400',
      card: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-emerald-100/70 dark:border-emerald-400/20 dark:from-emerald-950/55 dark:to-emerald-900/30',
      icon: 'bg-emerald-200/70 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
    },
    sky: {
      accent: 'bg-sky-400',
      card: 'border-sky-200/80 bg-gradient-to-br from-sky-50 to-sky-100/70 dark:border-sky-400/20 dark:from-sky-950/55 dark:to-sky-900/30',
      icon: 'bg-sky-200/70 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
    },
    violet: {
      accent: 'bg-violet-400',
      card: 'border-violet-200/80 bg-gradient-to-br from-violet-50 to-violet-100/70 dark:border-violet-400/20 dark:from-violet-950/55 dark:to-violet-900/30',
      icon: 'bg-violet-200/70 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
    },
  }[tone];

  return (
    <Card
      className={cn(
        'relative min-h-28 overflow-hidden p-4 shadow-sm sm:p-5',
        toneClasses.card,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0 start-0 w-1 opacity-80',
          toneClasses.accent,
        )}
      />
      <div className="flex items-center gap-4">
        <span
          className={cn(
            'grid size-12 shrink-0 place-items-center rounded-2xl',
            toneClasses.icon,
          )}
        >
          <Icon aria-hidden="true" className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-black text-foreground">
            {value.toLocaleString('fa-IR')}
          </p>
          <p className="mt-1 truncate text-[10px] text-muted-foreground">
            {hint}
          </p>
        </div>
      </div>
    </Card>
  );
}

export function DocumentsWorkspace() {
  const [section, setSection] = useState<SectionKey>('overview');
  const [sectionDomain, setSectionDomain] = useState<DocumentDomainCode | null>(
    null,
  );
  const [query, setQuery] = useState<DocumentListQueryV1>({
    page: 1,
    pageSize: 25,
    sortBy: 'updatedAt',
    sortDirection: 'desc',
  });
  const [documents, setDocuments] = useState<readonly DocumentListItemV1[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState(0);
  const [options, setOptions] = useState<
    DocumentOptionsResponseV1['data'] | null
  >(null);
  const [branches, setBranches] = useState<readonly BranchReference[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detail, setDetail] = useState<DocumentDetailV1 | null>(null);
  const [audit, setAudit] = useState<readonly DocumentAuditEventV1[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [personalView, setPersonalView] = useState<PersonalViewKey | null>(
    null,
  );
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [copiedDocumentId, setCopiedDocumentId] = useState('');

  const effectiveQuery = useMemo(() => {
    const active = sections.find((item) => item.key === section);
    const domain = sectionDomain ?? active?.domain;
    const serverPersonalView =
      personalView === 'owned'
        ? ('OWNED' as const)
        : personalView === 'uploaded'
          ? ('UPLOADED' as const)
          : personalView === 'recent'
            ? ('RECENTLY_VIEWED' as const)
            : undefined;
    return {
      ...query,
      ...(personalView === 'favorites' ? { page: 1, pageSize: 100 } : {}),
      ...(domain ? { domain } : {}),
      ...(section === 'expired' ? { validity: 'EXPIRED' as const } : {}),
      ...(serverPersonalView ? { personalView: serverPersonalView } : {}),
    };
  }, [personalView, query, section, sectionDomain]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await documentsApi.list(effectiveQuery);
      const visible =
        personalView === 'favorites'
          ? response.data.filter((item) => favoriteIds.has(item.id))
          : response.data;
      setDocuments(visible);
      setTotal(
        personalView === 'favorites' ? visible.length : response.meta.total,
      );
      setTotalPages(
        personalView === 'favorites' ? 1 : response.meta.totalPages,
      );
      setSelected(new Set());
    } catch (caught) {
      const apiError = caught instanceof DocumentsApiError ? caught : null;
      setError(apiError?.message ?? 'ارتباط با سرویس اسناد برقرار نشد.');
      setErrorStatus(apiError?.status ?? 0);
    } finally {
      setLoading(false);
    }
  }, [effectiveQuery, favoriteIds, personalView]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    Promise.all([documentsApi.options(), documentsApi.sessionContext()])
      .then(([documentOptions, sessionUser]) => {
        setOptions(documentOptions.data);
        setBranches(sessionUser.branches);
        setCurrentUserId(sessionUser.id);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!currentUserId || typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(
      `rubi.documents.favorites.${currentUserId}`,
    );
    if (!stored) return;
    try {
      const values = JSON.parse(stored) as unknown;
      if (Array.isArray(values)) {
        setFavoriteIds(
          new Set(
            values.filter(
              (value): value is string => typeof value === 'string',
            ),
          ),
        );
      }
    } catch {
      window.localStorage.removeItem(
        `rubi.documents.favorites.${currentUserId}`,
      );
    }
  }, [currentUserId]);

  function updateQuery(patch: Partial<DocumentListQueryV1>) {
    setQuery((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  }

  function removeQuery(key: keyof DocumentListQueryV1) {
    setQuery((current) => {
      const next = { ...current };
      delete next[key];
      return { ...next, page: 1 };
    });
  }

  function changeSection(next: SectionKey) {
    setPersonalView(null);
    setSection(next);
    setSectionDomain(
      next === 'procurement'
        ? 'PROCUREMENT'
        : next === 'hr'
          ? 'HUMAN_RESOURCES'
          : null,
    );
    setQuery((current) => ({ ...current, page: 1 }));
  }

  function changePersonalView(next: PersonalViewKey) {
    setPersonalView(next);
    setSection('all');
    setSectionDomain(null);
    setQuery((current) => ({
      ...current,
      page: 1,
      pageSize: next === 'favorites' ? 100 : 25,
    }));
  }

  function internalShareLink(id: string) {
    if (typeof window === 'undefined') return `/documents?document=${id}`;
    const url = new URL('/documents', window.location.origin);
    url.searchParams.set('document', id);
    return url.toString();
  }

  async function copyInternalLink(document: DocumentListItemV1) {
    const link = internalShareLink(document.id);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedDocumentId(document.id);
      setNotice(`لینک داخلی «${document.title}» کپی شد.`);
      window.setTimeout(() => setCopiedDocumentId(''), 2500);
    } catch {
      setNotice('کپی خودکار ممکن نبود؛ لینک را از جزئیات سند انتخاب کنید.');
    }
  }

  function toggleFavorite(document: DocumentListItemV1) {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(document.id)) next.delete(document.id);
      else next.add(document.id);
      if (currentUserId && typeof window !== 'undefined') {
        window.localStorage.setItem(
          `rubi.documents.favorites.${currentUserId}`,
          JSON.stringify([...next]),
        );
      }
      return next;
    });
  }

  function changeDetailOpen(open: boolean) {
    setDetailOpen(open);
    if (!open && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('document')) {
        url.searchParams.delete('document');
        window.history.replaceState({}, '', url);
      }
    }
  }

  const openDetail = useCallback(async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError('');
    setDetail(null);
    setAudit([]);
    try {
      const response = await documentsApi.detail(id);
      setDetail(response.data);
      if (response.data.capabilities.viewAudit) {
        documentsApi
          .audit(id)
          .then((events) => setAudit(events.data))
          .catch(() => undefined);
      }
    } catch (caught) {
      setDetailError(
        caught instanceof Error
          ? caught.message
          : 'جزئیات سند قابل دریافت نیست.',
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const requestedDocumentId = new URL(window.location.href).searchParams.get(
      'document',
    );
    if (/^[0-9a-f-]{36}$/i.test(requestedDocumentId ?? '')) {
      void openDetail(requestedDocumentId!);
    }
  }, [openDetail]);

  async function upload(form: FormData) {
    setUploading(true);
    setUploadError('');
    try {
      const response = await documentsApi.upload(form);
      setUploadOpen(false);
      setNotice(
        response.data.currentVersion.scanStatus === 'CLEAN'
          ? `سند ${response.data.archiveCode} ثبت و با موفقیت اسکن شد.`
          : `سند ${response.data.archiveCode} ثبت شد؛ دریافت فایل تا پایان بررسی امنیتی بسته می‌ماند.`,
      );
      await load();
      await openDetail(response.data.id);
    } catch (caught) {
      setUploadError(
        caught instanceof Error ? caught.message : 'بارگذاری ناموفق بود.',
      );
    } finally {
      setUploading(false);
    }
  }

  async function download(document: DocumentDetailV1) {
    try {
      const response = await documentsApi.download(document.id);
      const url = URL.createObjectURL(response.blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = document.currentVersion.safeDownloadName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'دانلود مجاز نیست.');
    }
  }

  const hasFilters = Boolean(
    query.search ||
    query.typeCode ||
    query.categoryId ||
    query.branchId ||
    query.archiveStatus ||
    query.scanStatus ||
    query.validity ||
    query.ownerUserId ||
    query.confidentiality ||
    query.createdFrom ||
    query.createdTo ||
    personalView,
  );
  const page = query.page ?? 1;
  const visibleQuarantine = documents.filter(
    (item) => item.currentVersion.scanStatus !== 'CLEAN',
  ).length;
  const visibleExpired = documents.filter(
    (item) => item.validUntil && new Date(item.validUntil) < new Date(),
  ).length;
  const visibleExpiring = documents.filter((item) => {
    if (!item.validUntil) return false;
    const remaining = new Date(item.validUntil).getTime() - Date.now();
    return remaining >= 0 && remaining <= 30 * 86_400_000;
  }).length;
  const followUpDocuments = documents
    .filter(
      (item) =>
        item.currentVersion.scanStatus !== 'CLEAN' ||
        (item.validUntil && new Date(item.validUntil) < new Date()),
    )
    .slice(0, 3);

  function table() {
    if (loading)
      return (
        <div className="space-y-3" aria-label="در حال بارگذاری اسناد">
          <Skeleton className="h-12" />
          {[1, 2, 3, 4].map((item) => (
            <Skeleton className="h-16" key={item} />
          ))}
        </div>
      );
    if (error) {
      if (errorStatus === 403)
        return (
          <ErrorState
            action={<Button onClick={() => void load()}>تلاش دوباره</Button>}
            description={error}
            title="دسترسی به اسناد مجاز نیست"
          />
        );
      return (
        <ErrorState
          action={<Button onClick={() => void load()}>تلاش دوباره</Button>}
          description={error}
          title={
            errorStatus === 401
              ? 'نشست شما پایان یافته است'
              : 'خطای دریافت اسناد'
          }
        />
      );
    }
    if (!documents.length)
      return (
        <EmptyState
          action={
            hasFilters ? (
              <Button
                onClick={() => {
                  setPersonalView(null);
                  setQuery({
                    page: 1,
                    pageSize: 25,
                    sortBy: 'updatedAt',
                    sortDirection: 'desc',
                  });
                }}
                variant="outline"
              >
                پاک‌کردن فیلترها
              </Button>
            ) : (
              <Button onClick={() => setUploadOpen(true)}>
                بارگذاری اولین سند
              </Button>
            )
          }
          description={
            hasFilters
              ? 'عبارت یا فیلتر دیگری را امتحان کنید.'
              : 'هنوز سندی در دامنه مجاز شما ثبت نشده است.'
          }
          title={hasFilters ? 'نتیجه‌ای پیدا نشد' : 'آرشیو خالی است'}
        />
      );
    return (
      <>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-50 p-3 text-sm dark:bg-blue-950/20">
          <span>{selected.size.toLocaleString('fa-IR')} سند انتخاب شده</span>
          <div className="flex gap-2">
            <Button
              disabled={!selected.size}
              onClick={() =>
                setNotice(
                  'عملیات گروهی پس از کنترل مجوز تک‌تک اسناد در Slice بعد فعال می‌شود.',
                )
              }
              size="sm"
              variant="outline"
            >
              عملیات گروهی
            </Button>
            <Button
              onClick={() =>
                setNotice('خروجی Excel/PDF به Export Worker مستقل نیاز دارد.')
              }
              size="sm"
              variant="outline"
            >
              خروجی
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="min-w-[1180px] w-full text-sm">
            <thead className="bg-blue-50/80 text-xs text-blue-950 dark:bg-blue-950/30 dark:text-blue-100">
              <tr>
                <th className="px-3 py-3 text-start">
                  <span className="sr-only">انتخاب</span>
                </th>
                {[
                  'عنوان و فایل',
                  'کد آرشیو',
                  'نوع',
                  'مالک',
                  'محرمانگی',
                  'وضعیت اسکن',
                  'اعتبار',
                  'آخرین تغییر',
                ].map((column) => (
                  <th className="px-3 py-3 text-start" key={column}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documents.map((document) => (
                <tr
                  className="hover:bg-blue-50/45 dark:hover:bg-blue-950/15"
                  key={document.id}
                >
                  <td className="px-3 py-4">
                    <Checkbox
                      aria-label={`انتخاب ${document.title}`}
                      checked={selected.has(document.id)}
                      onCheckedChange={(checked) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (checked) next.add(document.id);
                          else next.delete(document.id);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className="max-w-80 px-3 py-4">
                    <div className="flex items-start gap-2">
                      <button
                        aria-label={
                          favoriteIds.has(document.id)
                            ? `حذف ${document.title} از علاقه‌مندی‌ها`
                            : `افزودن ${document.title} به علاقه‌مندی‌ها`
                        }
                        className="mt-0.5 shrink-0 rounded-md text-amber-500 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => toggleFavorite(document)}
                        type="button"
                      >
                        <Star
                          aria-hidden="true"
                          className={cn(
                            'size-4',
                            favoriteIds.has(document.id) && 'fill-amber-400',
                          )}
                        />
                      </button>
                      <button
                        className="text-start font-black text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => void openDetail(document.id)}
                        type="button"
                      >
                        {document.title}
                      </button>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {document.currentVersion.safeDownloadName} · v
                      {document.currentVersion.versionNumber.toLocaleString(
                        'fa-IR',
                      )}
                    </p>
                  </td>
                  <td className="px-3 py-4 font-mono text-xs">
                    {document.archiveCode}
                  </td>
                  <td className="px-3 py-4">{document.type.name}</td>
                  <td className="px-3 py-4">{document.owner.displayName}</td>
                  <td className="px-3 py-4">
                    <Badge>
                      {confidentialityLabel[document.confidentiality]}
                    </Badge>
                  </td>
                  <td className="px-3 py-4">
                    <Badge
                      className={scanTone(document.currentVersion.scanStatus)}
                    >
                      {scanLabel[document.currentVersion.scanStatus]}
                    </Badge>
                  </td>
                  <td className="px-3 py-4">{date(document.validUntil)}</td>
                  <td className="px-3 py-4">{date(document.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <nav
          aria-label="صفحه‌بندی اسناد"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
        >
          <span>
            {total.toLocaleString('fa-IR')} سند · صفحه{' '}
            {page.toLocaleString('fa-IR')} از{' '}
            {totalPages.toLocaleString('fa-IR')}
          </span>
          <div className="flex gap-1">
            <Button
              aria-label="صفحه قبل"
              disabled={page <= 1}
              onClick={() => updateQuery({ page: page - 1 })}
              size="icon"
              variant="outline"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
            <Button
              aria-label="صفحه بعد"
              disabled={page >= totalPages}
              onClick={() => updateQuery({ page: page + 1 })}
              size="icon"
              variant="outline"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </nav>
      </>
    );
  }

  function filters() {
    return (
      <FilterBar className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FormField id="documents-search" label="جست‌وجو">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute end-3 top-3.5 size-4 text-muted-foreground"
            />
            <Input
              className="pe-10"
              id="documents-search"
              onChange={(event) => updateQuery({ search: event.target.value })}
              placeholder="عنوان، کد آرشیو یا نام فایل"
              value={query.search ?? ''}
            />
          </div>
        </FormField>
        <FormField label="نوع سند">
          <Select
            onValueChange={(value) =>
              value === 'ALL'
                ? removeQuery('typeCode')
                : updateQuery({ typeCode: value })
            }
            value={query.typeCode ?? 'ALL'}
          >
            <SelectTrigger aria-label="نوع سند">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه انواع</SelectItem>
              {options?.documentTypes.map((type) => (
                <SelectItem key={type.id} value={type.code}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="وضعیت آرشیو">
          <Select
            onValueChange={(value) =>
              value === 'ALL'
                ? removeQuery('archiveStatus')
                : updateQuery({ archiveStatus: value as never })
            }
            value={query.archiveStatus ?? 'ALL'}
          >
            <SelectTrigger aria-label="وضعیت آرشیو">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
              <SelectItem value="ACTIVE">فعال</SelectItem>
              <SelectItem value="ARCHIVED">آرشیوی</SelectItem>
              <SelectItem value="DELETED">حذف منطقی</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="دسته‌بندی">
          <Select
            onValueChange={(value) =>
              value === 'ALL'
                ? removeQuery('categoryId')
                : updateQuery({ categoryId: value })
            }
            value={query.categoryId ?? 'ALL'}
          >
            <SelectTrigger aria-label="دسته‌بندی سند">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه دسته‌ها</SelectItem>
              {options?.categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="شعبه">
          <Select
            onValueChange={(value) =>
              value === 'ALL'
                ? removeQuery('branchId')
                : updateQuery({ branchId: value })
            }
            value={query.branchId ?? 'ALL'}
          >
            <SelectTrigger aria-label="شعبه سند">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه شعب مجاز</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="وضعیت اسکن">
          <Select
            onValueChange={(value) =>
              value === 'ALL'
                ? removeQuery('scanStatus')
                : updateQuery({ scanStatus: value as never })
            }
            value={query.scanStatus ?? 'ALL'}
          >
            <SelectTrigger aria-label="وضعیت اسکن سند">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
              <SelectItem value="CLEAN">پاک</SelectItem>
              <SelectItem value="PENDING_SCAN">در انتظار اسکن</SelectItem>
              <SelectItem value="AWAITING_ANTIVIRUS_ADAPTER">
                در انتظار آنتی‌ویروس
              </SelectItem>
              <SelectItem value="QUARANTINED">قرنطینه</SelectItem>
              <SelectItem value="INFECTED">آلوده</SelectItem>
              <SelectItem value="SCAN_FAILED">خطای اسکن</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="اعتبار و انقضا">
          <Select
            onValueChange={(value) =>
              value === 'ALL'
                ? removeQuery('validity')
                : updateQuery({ validity: value as never })
            }
            value={query.validity ?? 'ALL'}
          >
            <SelectTrigger aria-label="اعتبار سند">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه</SelectItem>
              <SelectItem value="VALID">معتبر</SelectItem>
              <SelectItem value="EXPIRING">نزدیک انقضا</SelectItem>
              <SelectItem value="EXPIRED">منقضی</SelectItem>
              <SelectItem value="WITHOUT_EXPIRY">بدون انقضا</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="مالک">
          <Select
            onValueChange={(value) =>
              value === 'ALL'
                ? removeQuery('ownerUserId')
                : updateQuery({ ownerUserId: value })
            }
            value={query.ownerUserId ?? 'ALL'}
          >
            <SelectTrigger aria-label="مالک سند">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه مالکان</SelectItem>
              {options?.owners.map((owner) => (
                <SelectItem key={owner.id} value={owner.id}>
                  {owner.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="محرمانگی">
          <Select
            onValueChange={(value) =>
              value === 'ALL'
                ? removeQuery('confidentiality')
                : updateQuery({ confidentiality: value as never })
            }
            value={query.confidentiality ?? 'ALL'}
          >
            <SelectTrigger aria-label="محرمانگی">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه سطوح</SelectItem>
              <SelectItem value="PUBLIC">عمومی</SelectItem>
              <SelectItem value="INTERNAL">داخلی</SelectItem>
              <SelectItem value="CONFIDENTIAL">محرمانه</SelectItem>
              <SelectItem value="RESTRICTED">بسیار محدود</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="documents-created-from" label="ثبت از تاریخ">
          <DatePicker
            id="documents-created-from"
            onChange={(value) =>
              value
                ? updateQuery({ createdFrom: value })
                : removeQuery('createdFrom')
            }
            required={false}
            value={query.createdFrom ?? ''}
          />
        </FormField>
        <FormField id="documents-created-to" label="ثبت تا تاریخ">
          <DatePicker
            id="documents-created-to"
            onChange={(value) =>
              value
                ? updateQuery({ createdTo: value })
                : removeQuery('createdTo')
            }
            required={false}
            value={query.createdTo ?? ''}
          />
        </FormField>
        <FormField label="مرتب‌سازی">
          <Select
            onValueChange={(value) => updateQuery({ sortBy: value as never })}
            value={query.sortBy ?? 'updatedAt'}
          >
            <SelectTrigger aria-label="مرتب‌سازی">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt">آخرین تغییر</SelectItem>
              <SelectItem value="createdAt">تاریخ ثبت</SelectItem>
              <SelectItem value="title">عنوان</SelectItem>
              <SelectItem value="archiveCode">کد آرشیو</SelectItem>
              <SelectItem value="validUntil">تاریخ اعتبار</SelectItem>
              <SelectItem value="sizeBytes">حجم فایل</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <div className="flex gap-2 pb-0.5">
          <Button
            className="flex-1"
            onClick={() => {
              setPersonalView(null);
              setQuery({
                page: 1,
                pageSize: 25,
                sortBy: 'updatedAt',
                sortDirection: 'desc',
              });
            }}
            variant="outline"
          >
            پاک‌کردن
          </Button>
          <Button
            aria-label="بازخوانی"
            onClick={() => void load()}
            size="icon"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </FilterBar>
    );
  }

  function content() {
    if (section === 'archive')
      return (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {archiveSections.map((label, index) => (
            <Card
              className={cn(
                'group relative overflow-hidden p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md',
                archiveTone[index % archiveTone.length],
              )}
              key={label}
            >
              <span className="absolute -end-7 -top-7 size-24 rounded-full bg-white/50 blur-2xl dark:bg-white/5" />
              <Settings2 aria-hidden="true" className="size-6 text-primary" />
              <h2 className="mt-3 font-black">{label}</h2>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                تنظیمات و وضعیت این بخش از همین آرشیو مدیریت می‌شود.
              </p>
            </Card>
          ))}
        </section>
      );
    if (section === 'shares')
      return (
        <section className="space-y-4">
          <Card className={cn('relative overflow-hidden p-5', sectionSurface)}>
            <span className="absolute -end-12 -top-12 size-40 rounded-full bg-violet-200/40 blur-3xl dark:bg-violet-500/10" />
            <div className="relative flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-200/70 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300">
                <Link2 aria-hidden="true" className="size-6" />
              </span>
              <div>
                <h2 className="text-lg font-black">لینک‌های داخلی اسناد</h2>
                <p className="mt-1 text-sm leading-7 text-muted-foreground">
                  لینک‌ها مستقیم سند را باز می‌کنند؛ ورود و مجوز همان سند برای
                  گیرنده الزامی است و دانلود ناامن ایجاد نمی‌شود.
                </p>
              </div>
            </div>
          </Card>
          {loading ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Skeleton className="h-36" />
              <Skeleton className="h-36" />
            </div>
          ) : documents.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {documents.map((item) => (
                <Card className={cn('p-4', sectionSurface)} key={item.id}>
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-200/70 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300">
                      <Files aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <button
                        className="block max-w-full truncate text-start font-black text-primary hover:underline"
                        onClick={() => void openDetail(item.id)}
                        type="button"
                      >
                        {item.title}
                      </button>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.archiveCode} · نسخه{' '}
                        {item.currentVersion.versionNumber.toLocaleString(
                          'fa-IR',
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Input
                      aria-label={`لینک داخلی ${item.title}`}
                      className="text-left text-xs"
                      dir="ltr"
                      readOnly
                      value={internalShareLink(item.id)}
                    />
                    <Button
                      onClick={() => void copyInternalLink(item)}
                      type="button"
                    >
                      {copiedDocumentId === item.id ? (
                        <Check aria-hidden="true" className="size-4" />
                      ) : (
                        <Copy aria-hidden="true" className="size-4" />
                      )}
                      {copiedDocumentId === item.id ? 'کپی شد' : 'کپی'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              description="برای ساخت لینک داخلی ابتدا یک سند بارگذاری کنید."
              icon={Link2}
              title="سندی برای اشتراک وجود ندارد"
            />
          )}
        </section>
      );
    if (section === 'overview')
      return (
        <div className="space-y-4">
          <section
            aria-label="شاخص‌های اسناد"
            className="grid grid-cols-2 gap-3 xl:grid-cols-4"
          >
            <Metric
              icon={Files}
              hint="در دامنه دسترسی شما"
              label="اسناد قابل مشاهده"
              tone="sky"
              value={total}
            />
            <Metric
              icon={ClockAlert}
              hint="تا ۳۰ روز آینده"
              label="نزدیک انقضا"
              tone="emerald"
              value={visibleExpiring}
            />
            <Metric
              icon={ShieldAlert}
              hint="نیازمند بررسی یا اسکن"
              label="مدارک نیازمند پیگیری"
              tone="violet"
              value={visibleQuarantine}
            />
            <Metric
              icon={ClockAlert}
              hint="نیازمند بازبینی"
              label="مدارک منقضی"
              tone="amber"
              value={visibleExpired}
            />
          </section>
          <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
            <Card className={cn('p-5', sectionSurface)}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <ClockAlert aria-hidden="true" className="size-5" />
                  تازه‌های آرشیو
                </h2>
                <button
                  className="text-sm font-bold text-primary hover:underline"
                  onClick={() => changeSection('all')}
                  type="button"
                >
                  همه اسناد
                </button>
              </div>
              {documents.length ? (
                <div className="mt-4 divide-y divide-border">
                  {documents.slice(0, 5).map((item) => (
                    <button
                      className="flex w-full items-center gap-3 py-4 text-start hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      key={item.id}
                      onClick={() => void openDetail(item.id)}
                      type="button"
                    >
                      <Files
                        aria-hidden="true"
                        className="size-5 shrink-0 text-primary"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">
                          {item.title}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {item.type.name} · نسخه{' '}
                          {item.currentVersion.versionNumber.toLocaleString(
                            'fa-IR',
                          )}
                        </span>
                      </span>
                      <Badge className="bg-emerald-100 text-emerald-700">
                        فعال
                      </Badge>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-muted-foreground">
                  هنوز سندی برای نمایش وجود ندارد.
                </p>
              )}
            </Card>
            <Card className={cn('p-5', sectionSurface)}>
              <h2 className="flex items-center gap-2 text-lg font-black">
                <UserRound aria-hidden="true" className="size-5" />
                کارهای من
              </h2>
              {followUpDocuments.length ? (
                <div className="mt-4 divide-y divide-border">
                  {followUpDocuments.map((item) => {
                    const expired = Boolean(
                      item.validUntil && new Date(item.validUntil) < new Date(),
                    );
                    return (
                      <div
                        className="flex items-center justify-between gap-3 py-4"
                        key={item.id}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-bold">
                            {expired
                              ? `تمدید ${item.title}`
                              : `پیگیری بررسی ${item.title}`}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {expired
                              ? `منقضی در ${date(item.validUntil)}`
                              : scanLabel[item.currentVersion.scanStatus]}
                          </p>
                        </div>
                        <button
                          className="shrink-0 text-sm font-bold text-primary hover:underline"
                          onClick={() => void openDetail(item.id)}
                          type="button"
                        >
                          پیگیری
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-5 text-sm text-muted-foreground">
                  کار بازی برای پیگیری ندارید.
                </p>
              )}
              <div className="mt-5 border-t border-border pt-5">
                <h3 className="font-black">مسیرهای پیشنهادی برای بررسی</h3>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  از منوی آرشیو وارد هر بخش شوید یا روی عنوان سند کلیک کنید.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() => setUploadOpen(true)}
                    size="sm"
                    variant="outline"
                  >
                    <UploadCloud aria-hidden="true" className="size-4" />
                    فرم بارگذاری
                  </Button>
                  <Button
                    onClick={() => changeSection('all')}
                    size="sm"
                    variant="outline"
                  >
                    <Files aria-hidden="true" className="size-4" />
                    همه اسناد
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      );
    return (
      <div className="space-y-4">
        {section === 'procurement' ? (
          <Card
            className={cn(
              'flex flex-wrap items-center gap-2 p-3',
              sectionSurface,
            )}
          >
            <span className="me-2 text-sm font-bold">دامنه فعال:</span>
            <Button
              onClick={() => setSectionDomain('PROCUREMENT')}
              size="sm"
              variant={sectionDomain === 'PROCUREMENT' ? 'primary' : 'outline'}
            >
              خرید و تدارکات
            </Button>
            <Button
              onClick={() => setSectionDomain('FINANCE')}
              size="sm"
              variant={sectionDomain === 'FINANCE' ? 'primary' : 'outline'}
            >
              مالی
            </Button>
          </Card>
        ) : null}
        {section === 'hr' ? (
          <Card
            className={cn(
              'flex flex-wrap items-center gap-2 p-3',
              sectionSurface,
            )}
          >
            <span className="me-2 text-sm font-bold">دامنه فعال:</span>
            <Button
              onClick={() => setSectionDomain('ORGANIZATION')}
              size="sm"
              variant={sectionDomain === 'ORGANIZATION' ? 'primary' : 'outline'}
            >
              سازمان
            </Button>
            <Button
              onClick={() => setSectionDomain('HUMAN_RESOURCES')}
              size="sm"
              variant={
                sectionDomain === 'HUMAN_RESOURCES' ? 'primary' : 'outline'
              }
            >
              منابع انسانی
            </Button>
          </Card>
        ) : null}
        {filters()}
        <Card className={cn('p-4', sectionSurface)}>{table()}</Card>
      </div>
    );
  }

  return (
    <main className="space-y-5" id="documents-workspace">
      <PageHeader
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <UploadCloud aria-hidden="true" className="size-4" />
            بارگذاری فایل
          </Button>
        }
        title="اسناد و فایل‌ها"
      />
      {notice ? (
        <Alert className="relative pe-20" title={notice}>
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
      <div className="grid gap-4 xl:grid-cols-[15.5rem_minmax(0,1fr)]">
        <Card className="h-fit overflow-hidden border-sky-200/80 bg-gradient-to-b from-sky-50 via-blue-50/85 to-indigo-100/65 p-3 shadow-sm dark:border-sky-400/20 dark:from-sky-950/55 dark:via-blue-950/40 dark:to-indigo-950/35 xl:sticky xl:top-20">
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs font-black text-sky-900 shadow-sm dark:bg-white/5 dark:text-sky-100">
            <Sparkles aria-hidden="true" className="size-4 text-sky-600" />
            آرشیو اسناد
          </div>
          <nav
            aria-label="بخش‌های اسناد"
            className="grid gap-1 sm:grid-cols-2 xl:grid-cols-1"
          >
            {sections.map(({ icon: Icon, key, label }) => (
              <button
                aria-current={
                  !personalView && section === key ? 'page' : undefined
                }
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-xl px-3 text-start text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
                  !personalView && section === key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-sky-950/75 hover:bg-white/80 hover:text-sky-950 hover:shadow-sm dark:text-sky-100/75 dark:hover:bg-white/10 dark:hover:text-white',
                )}
                key={key}
                onClick={() => changeSection(key)}
                type="button"
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
          <div className="my-3 border-t border-sky-200 dark:border-sky-400/20" />
          <p className="px-3 text-xs font-black text-sky-900/70 dark:text-sky-100/70">
            نماهای شخصی
          </p>
          <div className="mt-2 grid gap-1">
            {personalViews.map(({ icon: Icon, key, label }) => {
              const active = personalView === key;
              return (
                <button
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-10 items-center gap-2 rounded-lg px-3 text-start text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-sky-950/70 hover:bg-white/80 hover:text-sky-950 dark:text-sky-100/70 dark:hover:bg-white/10 dark:hover:text-white',
                  )}
                  key={key}
                  onClick={() => changePersonalView(key)}
                  type="button"
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </Card>
        <div className="min-w-0 space-y-3">
          {section !== 'overview' ? (
            <Card
              className={cn(
                'flex flex-wrap items-center justify-between gap-3 p-3',
                sectionSurface,
              )}
            >
              <h2 className="flex items-center gap-2 font-black">
                <Sparkles aria-hidden="true" className="size-4 text-primary" />
                {personalView
                  ? personalViews.find((item) => item.key === personalView)
                      ?.label
                  : sections.find((item) => item.key === section)?.label}
              </h2>
              <Button
                onClick={() => changeSection('overview')}
                size="sm"
                variant="outline"
              >
                <ChevronRight aria-hidden="true" className="size-4" />
                بازگشت به نمای کلی
              </Button>
            </Card>
          ) : null}
          {content()}
        </div>
      </div>
      <DocumentUploadDialog
        branches={branches}
        error={uploadError}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) setUploadError('');
        }}
        onSubmit={upload}
        open={uploadOpen}
        options={options}
        submitting={uploading}
      />
      <DocumentDetailDialog
        audit={audit}
        document={detail}
        error={detailError}
        favorite={Boolean(detail && favoriteIds.has(detail.id))}
        loading={detailLoading}
        onCopyLink={(document) => void copyInternalLink(document)}
        onDownload={(document) => void download(document)}
        onOpenChange={changeDetailOpen}
        onToggleFavorite={toggleFavorite}
        open={detailOpen}
        shareLink={detail ? internalShareLink(detail.id) : ''}
      />
    </main>
  );
}
