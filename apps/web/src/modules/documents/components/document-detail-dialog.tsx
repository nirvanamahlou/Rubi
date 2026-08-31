'use client';

import {
  Activity,
  Download,
  FileClock,
  FileSearch,
  Link2,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import type { DocumentAuditEventV1, DocumentDetailV1 } from '@rubi/contracts';

import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
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
  PENDING_SCAN: 'در انتظار اسکن',
  CLEAN: 'پاک و مجاز',
  INFECTED: 'آلوده',
  SCAN_FAILED: 'خطای اسکن',
  QUARANTINED: 'قرنطینه',
  AWAITING_ANTIVIRUS_ADAPTER: 'در انتظار اتصال آنتی‌ویروس',
} as const;

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
          className="rounded-xl border border-border bg-muted/35 p-3"
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
  onDownload,
  onOpenChange,
  open,
}: {
  audit: readonly DocumentAuditEventV1[];
  document: DocumentDetailV1 | null;
  error: string;
  loading: boolean;
  onDownload: (document: DocumentDetailV1) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90dvh] max-w-5xl overflow-y-auto p-0">
        <div className="sticky top-0 z-10 border-b border-border bg-surface px-6 py-5 pe-14">
          <DialogTitle>{document?.title ?? 'جزئیات سند'}</DialogTitle>
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
              <TabsList className="mb-5 flex w-full gap-1 overflow-x-auto">
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
                  <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-8 text-center dark:bg-blue-950/20">
                    <div>
                      <FileSearch
                        className="mx-auto size-12 text-primary"
                        aria-hidden="true"
                      />
                      <h3 className="mt-4 font-black">
                        نسخه جاری{' '}
                        {document.currentVersion.versionNumber.toLocaleString(
                          'fa-IR',
                        )}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        پیش‌نمایش فقط پس از اسکن پاک و مجوز محتوای فایل فعال
                        می‌شود.
                      </p>
                      <Badge className="mt-4">
                        {scanLabel[document.currentVersion.scanStatus] ??
                          document.currentVersion.scanStatus}
                      </Badge>
                    </div>
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
                    ['وضعیت آرشیو', document.archiveStatus],
                    ['اعتبار', date(document.validUntil)],
                    ['نام فایل', document.currentVersion.safeDownloadName],
                    [
                      'حجم',
                      `${(document.currentVersion.sizeBytes / 1024).toLocaleString('fa-IR')} KB`,
                    ],
                    [
                      'MIME تشخیص‌داده‌شده',
                      document.currentVersion.detectedMimeType,
                    ],
                    ['SHA-256 پوشیده', document.currentVersion.sha256Masked],
                    ['آخرین به‌روزرسانی', date(document.updatedAt)],
                  ]}
                />
              </TabsContent>

              <TabsContent value="relations">
                <div className="space-y-3">
                  <Alert
                    description="Documents فقط Reference دامنه را نگه می‌دارد و به جدول ماژول مبدأ Query مستقیم نمی‌زند."
                    title={`منبع سند: ${document.sourceModule}`}
                  />
                  {document.relations.map((relation) => (
                    <div
                      className="flex items-start gap-3 rounded-xl border border-border p-4"
                      key={relation.id}
                    >
                      <Link2
                        className="mt-0.5 size-5 text-primary"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-bold">{relation.displayLabel}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {relation.sourceModule} · {relation.sourceEntityType}{' '}
                          · {relation.sourceEntityIdMasked}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="versions">
                <div className="space-y-3">
                  {document.versions.map((version) => (
                    <div
                      className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
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
                  <div className="rounded-2xl border border-border p-4">
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
                            {key}: {allowed ? 'مجاز' : 'غیرمجاز'}
                          </Badge>
                        ),
                      )}
                    </div>
                  </div>
                  <Alert
                    description="ایجاد و لغو لینک امن با گیرنده، نسخه ثابت، انقضا و سقف استفاده در Slice مستقل پیاده می‌شود."
                    title="اشتراک امن · مرحله بعد"
                    tone="warning"
                  />
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
                      <h3 className="font-black">Audit Timeline</h3>
                    </div>
                    {audit.length ? (
                      audit.map((event) => (
                        <div
                          className="border-s-2 border-blue-200 ps-4"
                          key={event.id}
                        >
                          <p className="text-sm font-bold">{event.action}</p>
                          <p className="text-xs text-muted-foreground">
                            {event.actor.displayName} · {date(event.occurredAt)}{' '}
                            · {event.outcome}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Audit برای این نقش در دسترس نیست یا رویدادی ثبت نشده
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
                      title="Legal Hold"
                      tone={document.legalHoldActive ? 'warning' : 'info'}
                    />
                    <div className="rounded-xl border border-border p-4">
                      <ShieldCheck
                        className="size-5 text-primary"
                        aria-hidden="true"
                      />
                      <p className="mt-2 font-bold">Retention Policy</p>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">
                        حذف دائمی تا تصویب سیاست نگهداری غیرفعال است.
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
