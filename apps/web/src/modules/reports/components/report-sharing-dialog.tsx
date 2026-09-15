'use client';

import { Search, Share2, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { EmptyState, Skeleton } from '@/components/ui/surfaces';
import {
  reportingApi,
  type ReportingShareRecipient,
} from '../model/client';

interface ReportSharingDialogProps {
  reportCode: string;
  reportName: string;
  savedReportId?: string;
  filterState?: Record<string, unknown>;
  onShared?: () => void | Promise<void>;
  className?: string;
}

export function ReportSharingDialog({
  reportCode,
  reportName,
  savedReportId,
  filterState,
  onShared,
  className,
}: ReportSharingDialogProps) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<readonly ReportingShareRecipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const visibleRecipients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fa-IR');
    if (!normalized) return recipients;
    return recipients.filter((recipient) =>
      `${recipient.displayName} ${recipient.username}`
        .toLocaleLowerCase('fa-IR')
        .includes(normalized),
    );
  }, [query, recipients]);

  async function load() {
    setLoading(true);
    setError('');
    setFeedback('');
    try {
      const [available, current] = await Promise.all([
        reportingApi.sharingRecipients(reportCode),
        savedReportId
          ? reportingApi.savedReportShares(savedReportId)
          : Promise.resolve({ recipientUserIds: [] as readonly string[] }),
      ]);
      setRecipients(available);
      setSelectedIds(current.recipientUserIds);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'دریافت فهرست کاربران مجاز ناموفق بود.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!selectedIds.length && !savedReportId) {
      setError('حداقل یک دریافت‌کننده را انتخاب کنید.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      let targetId = savedReportId;
      if (!targetId) {
        const saved = await reportingApi.saveReport({
          reportCode,
          name: reportName,
          sharingScope: 'PERSONAL',
          isFavorite: false,
          filterState: filterState ?? {},
        });
        targetId = saved.id;
      }
      await reportingApi.shareSavedReport(targetId, selectedIds);
      setFeedback(selectedIds.length
        ? `گزارش برای ${selectedIds.length.toLocaleString('fa-IR')} کاربر ارسال شد.`
        : 'دسترسی همه دریافت‌کنندگان این گزارش حذف شد.');
      await onShared?.();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'اشتراک‌گذاری گزارش ناموفق بود.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        className={className}
        onClick={() => {
          setOpen(true);
          void load();
        }}
        size={savedReportId ? 'sm' : undefined}
        type="button"
        variant="outline"
      >
        <Share2 aria-hidden="true" className="size-4" />
        اشتراک‌گذاری
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-w-xl" dir="rtl">
          <DialogTitle className="pe-10">اشتراک‌گذاری گزارش</DialogTitle>
          <DialogDescription>
            «{reportName}» فقط برای کاربران فعال و دارای دسترسی همین گزارش ارسال
            می‌شود. گیرنده هنگام اجرا همچنان تابع سطح دسترسی و شعب مجاز خودش است.
          </DialogDescription>

          {loading ? (
            <div className="mt-4 space-y-2" aria-busy="true">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton className="h-14" key={index} />
              ))}
            </div>
          ) : error && !recipients.length ? (
            <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : (
            <>
              <label className="relative mt-4 block">
                <span className="sr-only">جست‌وجوی کاربر</span>
                <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pe-10"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="جست‌وجو با نام یا نام کاربری"
                  value={query}
                />
              </label>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-xl border p-2">
                {!visibleRecipients.length ? (
                  <EmptyState
                    icon={UserRound}
                    title="کاربر مجازی پیدا نشد"
                    description="کاربر دریافت‌کننده باید فعال و دارای مجوز مشاهده این گزارش باشد."
                  />
                ) : (
                  visibleRecipients.map((recipient) => {
                    const checked = selectedIds.includes(recipient.id);
                    return (
                      <label
                        className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"
                        key={recipient.id}
                      >
                        <input
                          checked={checked}
                          className="size-4 accent-primary"
                          onChange={() =>
                            setSelectedIds((current) =>
                              checked
                                ? current.filter((id) => id !== recipient.id)
                                : [...current, recipient.id],
                            )
                          }
                          type="checkbox"
                        />
                        <span className="min-w-0">
                          <strong className="block truncate text-sm">{recipient.displayName}</strong>
                          <span className="block truncate text-xs text-muted-foreground" dir="ltr">
                            {recipient.username}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              {error ? (
                <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-800" role="alert">
                  {error}
                </p>
              ) : null}
              {feedback ? (
                <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-800" role="status">
                  {feedback}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  disabled={(!selectedIds.length && !savedReportId) || submitting}
                  loading={submitting}
                  onClick={() => void submit()}
                  type="button"
                >
                  <Share2 aria-hidden="true" className="size-4" />
                  {selectedIds.length ? 'ارسال گزارش' : 'حذف همه اشتراک‌ها'}
                </Button>
                <Button onClick={() => setOpen(false)} type="button" variant="ghost">
                  بستن
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
