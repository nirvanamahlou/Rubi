'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Eye, PackageOpen, RefreshCw } from 'lucide-react';
import type {
  WorkbenchDailyPackageOptionsV1,
  WorkbenchDailyPackagesResponseV1,
  WorkbenchDailyPackageV1,
} from '@nora/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { DatePicker } from '@/components/ui/date-picker';
import { tehranDay } from './calendar-model';
import { WorkbenchSelect } from './workbench-select';
import { workbenchDate } from './model';
import { workbenchPersonalApi } from './workbench-personal-api';

export function WorkbenchDailyPackages() {
  const [branches, setBranches] = useState<
    WorkbenchDailyPackageOptionsV1['data']
  >([]);
  const [branchId, setBranchId] = useState('');
  const [date, setDate] = useState(() => tehranDay(new Date())!);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<WorkbenchDailyPackagesResponseV1 | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    item: WorkbenchDailyPackageV1;
    url: string;
  } | null>(null);
  const generation = useRef(0);
  const previewGeneration = useRef(0);
  const previewUrl = useRef('');
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);

  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError('');
    try {
      let selected = branchId;
      if (!selected) {
        const options = await workbenchPersonalApi.dailyPackageOptions();
        if (request !== generation.current) return;
        setBranches(options.data);
        selected = options.data[0]?.id ?? '';
        if (selected) {
          setBranchId(selected);
          return;
        }
      }
      if (!selected) {
        setData(null);
        return;
      }
      const result = await workbenchPersonalApi.dailyPackages({
        branchId: selected,
        date,
        page,
      });
      if (request === generation.current) setData(result);
    } catch (reason) {
      if (request === generation.current) {
        setData(null);
        setError(
          reason instanceof Error
            ? reason.message
            : 'دریافت پکیج‌های روز انجام نشد.',
        );
      }
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [branchId, date, page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(timer);
      invalidate();
    };
  }, [load, invalidate]);
  useEffect(
    () => () => {
      previewGeneration.current++;
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  function closePreview() {
    previewGeneration.current++;
    setOpeningId(null);
    setPreview(null);
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = '';
  }
  async function openPreview(item: WorkbenchDailyPackageV1) {
    if (openingId) return;
    const request = ++previewGeneration.current;
    setOpeningId(item.id);
    setError('');
    try {
      const blob = await workbenchPersonalApi.dailyPackageFile(item.id);
      if (request !== previewGeneration.current) return;
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = URL.createObjectURL(blob);
      setPreview({ item, url: previewUrl.current });
    } catch (reason) {
      if (request === previewGeneration.current)
        setError(
          reason instanceof Error ? reason.message : 'دریافت پکیج انجام نشد.',
        );
    } finally {
      if (request === previewGeneration.current) setOpeningId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-4 border-sky-200 bg-gradient-to-l from-sky-50 to-violet-50 p-5 dark:border-sky-900 dark:from-sky-950/30 dark:to-violet-950/30">
        <div className="flex items-center gap-3">
          <PackageOpen className="size-6 text-primary" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold">پکیج‌های روز</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              خروجی‌های ارسال‌شده از پک جنریتور برای شعبه شما
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          به‌روزرسانی
        </Button>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <WorkbenchSelect
          label="شعبه پکیج"
          value={branchId}
          onValueChange={(value) => {
            closePreview();
            setBranchId(value);
            setPage(1);
            setData(null);
          }}
          options={branches.map((branch) => ({
            value: branch.id,
            label: branch.name,
          }))}
        />
        <label>
          <span className="sr-only">روز ارسال پکیج</span>
          <DatePicker
            value={date}
            onChange={(value) => {
              if (value) {
                setDate(value);
                setPage(1);
                setData(null);
              }
            }}
            placeholder="روز ارسال پکیج"
          />
        </label>
      </div>
      {error && (
        <Alert tone="error" title="عملیات پکیج انجام نشد" description={error} />
      )}
      {loading ? (
        <Skeleton className="h-48" />
      ) : error && !data ? null : !data?.data.length ? (
        <Card className="p-5">
          <EmptyState
            icon={PackageOpen}
            title="پکیجی برای این روز ثبت نشده است"
            description="در پک جنریتور، دکمه ارسال به پکیج‌های روز را بزنید."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.data.map((item) => (
              <Card key={item.id} className="flex min-w-0 flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <PackageOpen
                    className="size-8 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <Badge>
                    {item.scanStatus === 'CLEAN'
                      ? 'آماده مشاهده'
                      : ['PENDING_SCAN', 'AWAITING_ANTIVIRUS_ADAPTER'].includes(
                            item.scanStatus,
                          )
                        ? 'در انتظار بررسی فایل'
                        : 'فایل مسدود شده'}
                  </Badge>
                </div>
                <h3 className="break-words font-bold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {item.authorName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {workbenchDate(item.createdAt)}
                </p>
                <Button
                  className="mt-auto"
                  variant="outline"
                  disabled={item.scanStatus !== 'CLEAN' || openingId !== null}
                  onClick={() => void openPreview(item)}
                >
                  <Eye className="size-4" aria-hidden="true" />
                  مشاهده پکیج
                </Button>
              </Card>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
            >
              قبلی
            </Button>
            <span className="text-sm text-muted-foreground">
              {page.toLocaleString('fa-IR')} /{' '}
              {data.meta.totalPages.toLocaleString('fa-IR')}
            </span>
            <Button
              variant="outline"
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              بعدی
            </Button>
          </div>
        </>
      )}
      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) closePreview();
        }}
      >
        <DialogContent dir="rtl" className="max-w-5xl">
          <DialogTitle>{preview?.item.title ?? 'مشاهده پکیج'}</DialogTitle>
          <DialogDescription>خروجی نهایی پکیج</DialogDescription>
          {preview && (
            <>
              <iframe
                src={preview.url}
                title={preview.item.title}
                className="h-[65vh] w-full rounded-lg border border-border"
              />
              <a
                href={preview.url}
                download={`${preview.item.title.replace(/[\\/:*?"<>|]/g, '-')}.pdf`}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-primary-foreground"
              >
                <Download className="size-4" aria-hidden="true" />
                دریافت پکیج
              </a>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
