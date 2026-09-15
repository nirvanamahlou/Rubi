'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Download, Play, RefreshCw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge, Card, EmptyState, Skeleton } from '@/components/ui/surfaces';
import {
  reportingConfigurationState,
  reportingOperationConfigurationHref,
  type ReportingView,
  type SavedReportFilter,
} from '../model/navigation';
import { reportingApi } from '../model/client';
import { ReportSharingDialog } from './report-sharing-dialog';

type Row = Record<string, unknown> & { id: string };

const faDate = (value: unknown) =>
  value
    ? new Intl.DateTimeFormat('fa-IR', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Tehran',
      }).format(new Date(String(value)))
    : '—';
const statusLabel: Record<string, string> = {
  SUCCEEDED: 'موفق',
  FAILED: 'ناموفق',
  RUNNING: 'در حال اجرا',
  QUEUED: 'در صف',
  ACTIVE: 'فعال',
  PAUSED: 'متوقف',
  READY: 'آماده دانلود',
  GENERATING: 'در حال تولید',
  EXPIRED: 'منقضی',
};
const statusClass = (status: unknown) =>
  status === 'SUCCEEDED' || status === 'READY' || status === 'ACTIVE'
    ? 'bg-emerald-500/10 text-emerald-700'
    : status === 'FAILED' || status === 'EXPIRED'
      ? 'bg-red-500/10 text-red-700'
      : 'bg-amber-500/10 text-amber-800';

export function reportingRunActionLabel(action: unknown): string {
  if (action === 'PREVIEW') return 'نمایش نتیجه';
  if (action === 'SAVE') return 'ذخیره گزارش';
  if (action === 'EXPORT') return 'خروجی گرفتن نتیجه';
  return 'اجرای پیشین';
}

function resource(view: ReportingView) {
  if (view === 'saved' || view === 'shared') return 'saved' as const;
  if (view === 'recent') return 'runs' as const;
  return 'exports' as const;
}

export function ReportingOperationsView({
  view,
  savedFilter,
  onMutation,
  mutationRevision = 0,
}: {
  view: Exclude<ReportingView, 'catalog'>;
  savedFilter: SavedReportFilter;
  onMutation?: () => void | Promise<void>;
  mutationRevision?: number;
}) {
  const [rows, setRows] = useState<readonly Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await reportingApi.listWorkspace<Row>(resource(view)));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'دریافت اطلاعات ناموفق بود.',
      );
    } finally {
      setLoading(false);
    }
  }, [view]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load, mutationRevision]);
  const visible = rows.filter((row) => {
    if (view === 'shared') return row.isSharedWithActor === true;
    if (view === 'saved' && row.isSharedWithActor === true) return false;
    if (view === 'saved' && savedFilter === 'favorites')
      return row.isFavorite === true;
    return true;
  });

  if (loading)
    return (
      <Card className="space-y-3 p-5" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton className="h-16" key={i} />
        ))}
      </Card>
    );
  if (error)
    return (
      <Card className="p-5">
        <EmptyState
          icon={AlertTriangle}
          title="دریافت اطلاعات ناموفق بود"
          description={error}
          action={
            <Button onClick={() => void load()}>
              <RefreshCw className="size-4" /> تلاش مجدد
            </Button>
          }
        />
      </Card>
    );
  return (
    <Card className="p-5">
      {feedback ? (
        <p
          className="mb-4 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-800"
          role="status"
        >
          {feedback}
        </p>
      ) : null}
      {!visible.length ? (
        <EmptyState
          title="موردی برای نمایش وجود ندارد"
          description="پس از ذخیره یا اجرای گزارش، اطلاعات این بخش با داده واقعی نمایش داده می‌شود."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[58rem] text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="p-3 text-start">عنوان</th>
                {view === 'recent' ? (
                  <th className="p-3 text-start">اقدام کاربر</th>
                ) : null}
                <th className="p-3 text-start">مالک / اجراکننده</th>
                <th className="p-3 text-start">وضعیت و تنظیمات</th>
                <th className="p-3 text-start">
                  {view === 'recent' ? 'زمان اقدام' : 'زمان'}
                </th>
                <th className="p-3 text-start">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const status = String(
                  row.status ?? row.lastRunStatus ?? row.sharingScope ?? '',
                );
                const reportCode = String(
                  row.reportCode ?? 'sales_by_service_route',
                );
                const configurationState = reportingConfigurationState(
                  reportCode,
                  view === 'recent'
                    ? row.filterSnapshot
                    : (row.savedFilterState ?? row.filterState),
                );
                return (
                  <tr className="border-t align-top" key={row.id}>
                    <td className="p-3">
                      <strong>
                        {String(
                          row.name ??
                            row.savedReportName ??
                            row.reportName ??
                            row.fileName ??
                            reportCode,
                        )}
                      </strong>
                      <p
                        className="mt-1 text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        {reportCode}
                      </p>
                    </td>
                    {view === 'recent' ? (
                      <td className="p-3">
                        <Badge>{reportingRunActionLabel(row.actionType)}</Badge>
                      </td>
                    ) : null}
                    <td className="p-3">
                      {String(
                        row.ownerName ??
                          row.actorName ??
                          row.creatorName ??
                          'کاربر جاری',
                      )}
                    </td>
                    <td className="p-3">
                      <Badge className={statusClass(status)}>
                        {statusLabel[status] ??
                          (row.sharingScope === 'TEAM' ? 'تیمی' : 'شخصی')}
                      </Badge>
                      {row.recordCount !== undefined &&
                      row.recordCount !== null ? (
                        <p className="mt-2 text-xs">
                          {Number(row.recordCount).toLocaleString('fa-IR')}{' '}
                          رکورد ·{' '}
                          {Number(row.durationMs ?? 0).toLocaleString('fa-IR')}{' '}
                          ms
                        </p>
                      ) : null}
                      {view === 'recent' &&
                      status === 'FAILED' &&
                      row.errorMessage ? (
                        <p className="mt-2 text-xs text-red-700">
                          {String(row.errorMessage)}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-3">
                      {faDate(
                        view === 'recent'
                          ? (row.startedAt ?? row.createdAt)
                          : (row.updatedAt ?? row.createdAt ?? row.nextRunAt),
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {view === 'downloads' && status === 'READY' ? (
                          <Button asChild size="sm">
                            <a href={reportingApi.exportDownloadUrl(row.id)}>
                              <Download className="size-4" /> دانلود
                            </a>
                          </Button>
                        ) : view === 'downloads' &&
                          (status === 'FAILED' || status === 'EXPIRED') ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await reportingApi.retryExport(row.id);
                              setFeedback(
                                'درخواست تولید مجدد ثبت و خروجی آماده شد.',
                              );
                              await load();
                              await onMutation?.();
                            }}
                          >
                            <RefreshCw className="size-4" /> تلاش مجدد
                          </Button>
                        ) : (
                          <Button asChild size="sm" variant="outline">
                            <Link
                              href={reportingOperationConfigurationHref(
                                view,
                                savedFilter,
                                configurationState,
                              )}
                              scroll={false}
                              onClick={() => {
                                window.sessionStorage.setItem(
                                  `reporting.filters.${reportCode}`,
                                  JSON.stringify(
                                    configurationState.filterValues,
                                  ),
                                );
                              }}
                            >
                              <Play className="size-4" />{' '}
                              {status === 'FAILED' ? 'تلاش مجدد' : 'اجرا'}
                            </Link>
                          </Button>
                        )}
                        {view === 'saved' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              if (
                                !window.confirm('این گزارش ذخیره‌شده حذف شود؟')
                              )
                                return;
                              await reportingApi.deleteSaved(row.id);
                              setFeedback('گزارش حذف شد.');
                              await load();
                              await onMutation?.();
                            }}
                          >
                            <Trash2 className="size-4" /> حذف
                          </Button>
                        ) : null}
                        {view === 'saved' ? (
                          <ReportSharingDialog
                            reportCode={reportCode}
                            reportName={String(row.name ?? reportCode)}
                            savedReportId={row.id}
                            onShared={async () => {
                              setFeedback(
                                'دسترسی دریافت‌کنندگان گزارش به‌روزرسانی شد.',
                              );
                              await load();
                              await onMutation?.();
                            }}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
