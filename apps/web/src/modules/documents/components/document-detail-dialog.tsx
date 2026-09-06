'use client';

import Link from 'next/link';
import {
  Activity,
  ArrowUpLeft,
  Copy,
  Download,
  FileClock,
  FolderOpen,
  Link2,
  LockKeyhole,
  Pencil,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react';
import type { DocumentAuditEventV1, DocumentDetailV1 } from '@rubi/contracts';

import {
  createDocumentConnectionHref,
  documentRelationSourceLabel,
  documentRelationTypeLabel,
  getDocumentConnection,
  getDocumentRelationConnection,
} from '../model/document-connections';
import { DocumentImagePreview } from './document-image-preview';

import {
  Alert,
  Badge,
  Button,
  buttonVariants,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';

const confidentialityLabel = {
  PUBLIC: 'عمومی',
  INTERNAL: 'داخلی',
  CONFIDENTIAL: 'محرمانه',
  RESTRICTED: 'بسیار محدود',
} as const;

const scanLabel = {
  PENDING_SCAN: 'در حال اسکن امنیتی',
  CLEAN: 'پاک و مجاز',
  INFECTED: 'آلوده',
  SCAN_FAILED: 'خطای اسکن',
  QUARANTINED: 'قرنطینه',
  AWAITING_ANTIVIRUS_ADAPTER: 'نیازمند بررسی امنیتی',
} as const;

const archiveStatusLabel = {
  ACTIVE: 'فعال',
  ARCHIVED: 'آرشیوشده',
  DELETED: 'حذف‌شده',
} as const;

const capabilityLabel: Record<string, string> = {
  viewFile: 'مشاهده فایل',
  download: 'دانلود',
  uploadVersion: 'ثبت نسخه جدید',
  editMetadata: 'ویرایش اطلاعات',
  viewAudit: 'مشاهده فعالیت‌ها',
  archive: 'آرشیوکردن',
  restore: 'بازیابی',
  markIncomplete: 'تعیین وضعیت نقص',
  permanentDelete: 'حذف دائمی',
};

const auditActionLabel: Record<string, string> = {
  'documents.upload': 'بارگذاری سند',
  'documents.metadata.view': 'مشاهده اطلاعات سند',
  'documents.metadata.update': 'ویرایش اطلاعات سند',
  'documents.download': 'دانلود فایل',
  'documents.file.preview': 'مشاهده پیش‌نمایش',
  'documents.antivirus.scan': 'بررسی امنیتی فایل',
  'documents.archive': 'انتقال به آرشیو',
  'documents.restore': 'بازیابی از آرشیو',
  'documents.completion.update': 'تغییر وضعیت کامل‌بودن مدرک',
};

const auditReasonLabel: Record<string, string> = {
  UPLOAD_ACCEPTED_TO_QUARANTINE: 'فایل برای بررسی امنیتی پذیرفته شد',
  WINDOWS_DEFENDER_CLEAN: 'فایل پاک تشخیص داده شد',
  DOCUMENT_MARKED_INCOMPLETE: 'مدرک به‌عنوان ناقص علامت‌گذاری شد',
  DOCUMENT_METADATA_UPDATED: 'اطلاعات سند به‌روزرسانی شد',
  SENSITIVE_METADATA_MASKED: 'اطلاعات حساس پوشانده شد',
  DOWNLOAD_POLICY_DENIED: 'دانلود طبق سطح دسترسی رد شد',
  PREVIEW_SCAN_BLOCKED: 'پیش‌نمایش تا پایان بررسی امنیتی بسته است',
  PREVIEW_TYPE_UNSUPPORTED: 'این نوع فایل پیش‌نمایش ندارد',
  PREVIEW_POLICY_DENIED: 'پیش‌نمایش طبق سطح دسترسی رد شد',
};

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(new Date(value))
    : 'بدون تاریخ';
}

function InfoGrid({ rows }: { rows: readonly [string, string][] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(([label, value]) => (
        <div
          className="rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50 to-blue-50/80 p-3 shadow-sm dark:border-sky-400/20 dark:from-sky-950/35 dark:to-blue-950/25"
          key={label}
        >
          <dt className="text-xs font-semibold text-muted-foreground">
            {label}
          </dt>
          <dd className="mt-1 break-words text-sm font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DocumentDetailDialog({
  audit,
  document,
  error,
  loading,
  favorite,
  onCopyLink,
  onDownload,
  onLoadPreview,
  onOpenChange,
  onDelete,
  onEdit,
  onToggleFavorite,
  open,
  shareLink,
}: {
  audit: readonly DocumentAuditEventV1[];
  document: DocumentDetailV1 | null;
  error: string;
  loading: boolean;
  favorite: boolean;
  onCopyLink: (document: DocumentDetailV1) => void;
  onDownload: (document: DocumentDetailV1) => void;
  onLoadPreview: (
    document: DocumentDetailV1,
    sensitiveReason: string | undefined,
    signal: AbortSignal,
  ) => Promise<Blob>;
  onOpenChange: (open: boolean) => void;
  onDelete: (document: DocumentDetailV1) => void;
  onEdit: (document: DocumentDetailV1) => void;
  onToggleFavorite: (document: DocumentDetailV1) => void;
  open: boolean;
  shareLink: string;
}) {
  const documentConnection = document
    ? getDocumentConnection(document.type.domain)
    : null;
  const documentConnectionHref =
    document && documentConnection
      ? createDocumentConnectionHref(documentConnection, {
          documentId: document.id,
        })
      : null;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90dvh] max-w-5xl overflow-y-auto p-0">
        <div className="sticky top-0 z-10 border-b border-sky-200 bg-gradient-to-l from-sky-50 via-white to-blue-50 px-6 py-5 pe-14 dark:border-sky-400/20 dark:from-sky-950/70 dark:via-surface dark:to-blue-950/50">
          <div className="flex items-center gap-3">
            <DialogTitle>{document?.title ?? 'جزئیات سند'}</DialogTitle>
            {document ? (
              <div className="flex items-center gap-1">
                <Button
                  aria-label="ویرایش سند"
                  disabled={!document.capabilities.editMetadata}
                  onClick={() => onEdit(document)}
                  size="icon"
                  variant="ghost"
                >
                  <Pencil aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  aria-label="حذف دائمی سند"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                  disabled={!document.capabilities.permanentDelete}
                  onClick={() => onDelete(document)}
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  aria-label={
                    favorite
                      ? 'حذف از علاقه‌مندی‌ها'
                      : 'افزودن به علاقه‌مندی‌ها'
                  }
                  onClick={() => onToggleFavorite(document)}
                  size="icon"
                  variant="ghost"
                >
                  <Star
                    aria-hidden="true"
                    className={
                      favorite
                        ? 'size-5 fill-amber-400 text-amber-500'
                        : 'size-5'
                    }
                  />
                </Button>
              </div>
            ) : null}
          </div>
          <DialogDescription>
            {document
              ? `${document.archiveCode} · ${document.type.name}`
              : 'اطلاعات و دسترسی سند از Backend دریافت می‌شود.'}
          </DialogDescription>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="space-y-4" aria-label="در حال بارگذاری جزئیات">
              <Skeleton className="h-16" />
              <Skeleton className="h-72" />
            </div>
          ) : error ? (
            <Alert
              description={error}
              title="نمایش جزئیات ممکن نیست"
              tone="error"
            />
          ) : document ? (
            <Tabs defaultValue="preview" dir="rtl">
              <TabsList className="mb-5 flex w-full gap-1 overflow-x-auto border border-sky-200 bg-sky-50/80 p-1 dark:border-sky-400/20 dark:bg-sky-950/30">
                {(
                  [
                    ['preview', 'پیش‌نمایش'],
                    ['information', 'اطلاعات'],
                    ['relations', 'ارتباطات'],
                    ['versions', 'نسخه‌ها'],
                    ['access', 'دسترسی و اشتراک'],
                    ['activity', 'فعالیت و نگهداری'],
                  ] as const
                ).map(([value, label]) => (
                  <TabsTrigger className="shrink-0" key={value} value={value}>
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="preview">
                <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
                  <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-sky-300 bg-gradient-to-br from-sky-50 via-blue-50/70 to-indigo-50 p-4 text-center shadow-inner sm:p-8 dark:border-sky-400/30 dark:from-sky-950/50 dark:via-blue-950/30 dark:to-indigo-950/30">
                    <DocumentImagePreview
                      document={document}
                      key={document.currentVersion.id}
                      onLoadPreview={onLoadPreview}
                    />
                  </div>
                  <div className="space-y-3">
                    <Alert
                      description="هیچ فایل Pending، آلوده یا قرنطینه‌شده از این نما تحویل نمی‌شود."
                      title="کنترل امنیت فایل"
                      tone="warning"
                    />
                    <Button
                      className="w-full"
                      disabled={
                        !document.capabilities.download ||
                        document.currentVersion.scanStatus !== 'CLEAN'
                      }
                      onClick={() => onDownload(document)}
                    >
                      <Download className="size-4" aria-hidden="true" />
                      دانلود نسخه مجاز
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="information">
                <InfoGrid
                  rows={[
                    ['کد آرشیو', document.archiveCode],
                    ['نوع سند', document.type.name],
                    ['دسته‌بندی', document.category?.name ?? '—'],
                    ['مالک', document.owner.displayName],
                    [
                      'محرمانگی',
                      confidentialityLabel[document.confidentiality],
                    ],
                    ['وضعیت آرشیو', archiveStatusLabel[document.archiveStatus]],
                    ['وضعیت مدرک', document.isIncomplete ? 'ناقص' : 'کامل'],
                    ['اعتبار', date(document.validUntil)],
                    ['نام فایل', document.currentVersion.safeDownloadName],
                    [
                      'حجم',
                      `${(document.currentVersion.sizeBytes / 1024).toLocaleString('fa-IR')} KB`,
                    ],
                    [
                      'نوع فایل',
                      `.${document.currentVersion.extension.replace(/^\./, '').toUpperCase()}`,
                    ],
                    ['آخرین به‌روزرسانی', date(document.updatedAt)],
                  ]}
                />
              </TabsContent>

              <TabsContent value="relations">
                <div className="space-y-4">
                  {documentConnection ? (
                    <div className="relative overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 p-5 shadow-sm dark:border-sky-400/20 dark:from-sky-950/45 dark:via-blue-950/30 dark:to-indigo-950/25">
                      <span className="absolute -end-10 -top-10 size-32 rounded-full bg-sky-200/50 blur-3xl dark:bg-sky-500/10" />
                      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-200/75 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200">
                            <Link2 aria-hidden="true" className="size-5" />
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-black">
                                ارتباط با {documentConnection.moduleLabel}
                              </h3>
                              <Badge>
                                {documentConnection.moduleHref
                                  ? 'متصل به ماژول'
                                  : 'داخل آرشیو'}
                              </Badge>
                            </div>
                            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                              {documentConnection.description}
                            </p>
                          </div>
                        </div>
                        {documentConnectionHref ? (
                          <Link
                            className={buttonVariants({
                              className: 'shrink-0',
                              size: 'sm',
                            })}
                            href={documentConnectionHref}
                          >
                            رفتن به {documentConnection.moduleLabel}
                            <ArrowUpLeft
                              aria-hidden="true"
                              className="size-4"
                            />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {document.relations.length ? (
                    document.relations.map((relation) => {
                      const relationConnection = getDocumentRelationConnection(
                        relation,
                        document.type.domain,
                      );
                      const relationHref = createDocumentConnectionHref(
                        relationConnection,
                        {
                          documentId: document.id,
                          relationId: relation.id,
                        },
                      );
                      return (
                        <div
                          className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/70 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-emerald-400/20 dark:from-emerald-950/35 dark:to-teal-950/25"
                          key={relation.id}
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <Link2
                              className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-300"
                              aria-hidden="true"
                            />
                            <div className="min-w-0">
                              <p className="break-words font-bold">
                                {relation.displayLabel}
                              </p>
                              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                                {documentRelationTypeLabel(
                                  relation.relationType,
                                )}{' '}
                                ·{' '}
                                {documentRelationSourceLabel(
                                  relation,
                                  document.type.domain,
                                )}
                              </p>
                            </div>
                          </div>
                          {relationHref ? (
                            <Link
                              className={buttonVariants({
                                className: 'shrink-0',
                                size: 'sm',
                                variant: 'outline',
                              })}
                              href={relationHref}
                            >
                              بازکردن بخش مربوطه
                              <ArrowUpLeft
                                aria-hidden="true"
                                className="size-4"
                              />
                            </Link>
                          ) : (
                            <Badge className="shrink-0">داخل آرشیو</Badge>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex items-start gap-3 rounded-xl border border-dashed border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/70 p-4 dark:border-amber-400/25 dark:from-amber-950/30 dark:to-orange-950/20">
                      <FolderOpen
                        aria-hidden="true"
                        className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300"
                      />
                      <div>
                        <p className="font-bold">
                          پرونده‌ای برای این فایل ثبت نشده است
                        </p>
                        <p className="mt-1 text-xs leading-6 text-muted-foreground">
                          خود فایل در آرشیو موجود است، اما هنوز ارتباط مشخصی با
                          یک پرونده مبدأ برای آن ثبت نشده است.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="versions">
                <div className="space-y-3">
                  {document.versions.map((version) => (
                    <div
                      className="flex flex-col gap-3 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50/70 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-violet-400/20 dark:from-violet-950/35 dark:to-indigo-950/25"
                      key={version.id}
                    >
                      <div className="flex items-start gap-3">
                        <FileClock
                          className="mt-0.5 size-5 text-primary"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-black">
                            نسخه {version.versionNumber.toLocaleString('fa-IR')}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {version.versionNote} · {date(version.createdAt)} ·{' '}
                            {version.createdBy.displayName}
                          </p>
                        </div>
                      </div>
                      <Badge>
                        {scanLabel[version.scanStatus] ?? version.scanStatus}
                      </Badge>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="access">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-100/60 p-4 shadow-sm dark:border-sky-400/20 dark:from-sky-950/45 dark:to-blue-950/30">
                    <LockKeyhole
                      className="size-6 text-primary"
                      aria-hidden="true"
                    />
                    <h3 className="mt-3 font-black">مجوزهای مؤثر</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(document.capabilities).map(
                        ([key, allowed]) => (
                          <Badge
                            className={
                              allowed
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }
                            key={key}
                          >
                            {capabilityLabel[key] ?? 'عملیات سند'}:{' '}
                            {allowed ? 'مجاز' : 'غیرمجاز'}
                          </Badge>
                        ),
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-100/60 p-4 shadow-sm dark:border-violet-400/20 dark:from-violet-950/45 dark:to-indigo-950/30">
                    <Link2
                      aria-hidden="true"
                      className="size-6 text-violet-700 dark:text-violet-300"
                    />
                    <h3 className="mt-3 font-black">لینک داخلی سند</h3>
                    <p className="mt-2 text-xs leading-6 text-muted-foreground">
                      گیرنده پس از ورود و فقط در صورت داشتن مجوز همین سند
                      می‌تواند آن را باز کند.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Input
                        aria-label="لینک داخلی سند"
                        className="text-left text-xs"
                        dir="ltr"
                        readOnly
                        value={shareLink}
                      />
                      <Button
                        onClick={() => onCopyLink(document)}
                        type="button"
                      >
                        <Copy aria-hidden="true" className="size-4" />
                        کپی لینک
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="activity">
                <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Activity
                        className="size-5 text-primary"
                        aria-hidden="true"
                      />
                      <h3 className="font-black">تاریخچه فعالیت‌ها</h3>
                    </div>
                    {audit.length ? (
                      audit.map((event) => (
                        <div
                          className="rounded-xl border-s-4 border-sky-300 bg-sky-50/70 p-3 ps-4 dark:bg-sky-950/25"
                          key={event.id}
                        >
                          <p className="text-sm font-bold">
                            {auditActionLabel[event.action] ?? 'فعالیت سند'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {event.actor.displayName} · {date(event.occurredAt)}{' '}
                            · {event.outcome === 'SUCCESS' ? 'موفق' : 'ناموفق'}
                          </p>
                          {event.reason ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {auditReasonLabel[event.reason] ??
                                'توضیحات این فعالیت ثبت شده است.'}
                            </p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        تاریخچه برای این نقش در دسترس نیست یا رویدادی ثبت نشده
                        است.
                      </p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <Alert
                      description={
                        document.legalHoldActive
                          ? 'توقف حذف فعال است.'
                          : 'توقف حذف فعال نیست.'
                      }
                      title="توقف حقوقی حذف"
                      tone={document.legalHoldActive ? 'warning' : 'info'}
                    />
                    <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 dark:border-emerald-400/20 dark:from-emerald-950/35 dark:to-teal-950/25">
                      <ShieldCheck
                        className="size-5 text-primary"
                        aria-hidden="true"
                      />
                      <p className="mt-2 font-bold">سیاست نگهداری</p>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">
                        حذف دائمی فقط با مجوز، تأیید صریح و در نبود توقف حقوقی
                        انجام می‌شود.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
