'use client';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProcurementRequestV1 } from '@nora/contracts';
import { documentsApi } from '@/modules/documents/api/client';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-controls';
import { Alert, Badge, Card, Skeleton } from '@/components/ui/surfaces';
import {
  procurementApi,
  retryIdentity,
  type Bootstrap,
  type ProcurementExportJob,
} from './api';
import { selectClass } from './draft-form';
import { ProcurementSelect } from './procurement-select';
import { exportScanSnapshotText, formatProcurementDate } from './presentation';

const labels = {
  QUEUED: 'در صف تولید',
  RUNNING: 'در حال تولید',
  COMPLETED: 'تولیدشده',
  FAILED: 'ناموفق',
} as const;
export function ProcurementExportPanel({
  bootstrap,
  kind,
  query,
  request,
}: {
  bootstrap: Bootstrap;
  kind: ProcurementExportJob['kind'];
  query?: Record<string, string>;
  request?: ProcurementRequestV1;
}) {
  const [open, setOpen] = useState(false);
  if (!bootstrap.permissions.includes('procurement.export')) return null;
  return (
    <Card className="space-y-4 p-5">
      <Button
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? 'بستن خروجی‌ها' : 'خروجی Excel و PDF و سوابق تولید'}
      </Button>
      {open && (
        <ExportContent
          bootstrap={bootstrap}
          kind={kind}
          {...(query ? { query } : {})}
          {...(request ? { request } : {})}
        />
      )}
    </Card>
  );
}
function ExportContent({
  bootstrap,
  kind,
  query,
  request,
}: {
  bootstrap: Bootstrap;
  kind: ProcurementExportJob['kind'];
  query?: Record<string, string>;
  request?: ProcurementRequestV1;
}) {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const [branchId, setBranchId] = useState(
    request?.draft.branchId ??
      (bootstrap.branches.length === 1 ? bootstrap.branches[0]!.id : ''),
  );
  const [format, setFormat] = useState<'XLSX' | 'PDF'>('XLSX');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<ProcurementExportJob | null>(null);
  const identity = useRef<ReturnType<typeof retryIdentity> | null>(null);
  const options = useQuery({
    queryKey: ['procurement', 'export-document-options'],
    queryFn: documentsApi.options,
    retry: false,
  });
  const jobs = useQuery({
    queryKey: ['procurement', 'exports', page],
    queryFn: () => procurementApi.exports(page),
    retry: false,
    refetchInterval: (state) =>
      state.state.status !== 'error' &&
      state.state.data?.items.some((job) =>
        ['QUEUED', 'RUNNING'].includes(job.status),
      )
        ? 5000
        : false,
  });
  const orders = useQuery({
    queryKey: ['procurement', 'export-orders', request?.id, orderPage],
    queryFn: () => procurementApi.records(request!.id, 'orders', orderPage),
    enabled: kind === 'ORDER' && !!request,
    retry: false,
  });
  const mime =
    format === 'PDF'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const types =
    options.data?.data.documentTypes.filter(
      (type) =>
        type.domain === 'PROCUREMENT' &&
        type.allowedMimeTypes.includes(mime) &&
        !type.requiresExpiry,
    ) ?? [];
  async function submit() {
    setBusy(true);
    setError('');
    const body = {
      kind,
      format,
      branchId,
      documentTypeId,
      categoryId,
      ...(query
        ? {
            query: Object.fromEntries(
              Object.entries(query).filter(([, value]) => value !== ''),
            ),
          }
        : {}),
      ...(kind === 'ORDER' && request
        ? { requestId: request.id, orderId }
        : {}),
    };
    identity.current = retryIdentity(identity.current, body);
    try {
      const job = await procurementApi.createExport(body, identity.current.key);
      setCreated(job);
      void client.invalidateQueries({ queryKey: ['procurement', 'exports'] });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'درخواست خروجی ثبت نشد.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <Alert
        title="خروجی در آرشیو اسناد ثبت می‌شود"
        description="مجوزها و محدوده صفحه دوباره در سرور کنترل می‌شوند. PDF به صادرکننده فعال و تنظیمات تولید معتبر نیاز دارد. فایل پس از بررسی امنیتی از اسناد قابل دریافت است."
      />
      {options.isPending ? (
        <Skeleton className="h-32" />
      ) : options.isError ? (
        <Alert
          tone="error"
          title="تنظیمات اسناد دریافت نشد"
          description={
            options.error instanceof Error
              ? options.error.message
              : 'دریافت ناموفق بود'
          }
        >
          <Button variant="outline" onClick={() => void options.refetch()}>
            تلاش دوباره
          </Button>
        </Alert>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="space-y-4"
        >
          <fieldset
            disabled={busy}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <legend className="sr-only">درخواست خروجی</legend>
            <FormField id="proc-export-branch" label="شعبه خروجی">
              <ProcurementSelect
                id="proc-export-branch"
                className={selectClass}
                value={branchId}
                disabled={!!request}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setCreated(null);
                }}
              >
                <option value="">انتخاب شعبه</option>
                {bootstrap.branches.map((branch) => (
                  <option value={branch.id} key={branch.id}>
                    {branch.label}
                  </option>
                ))}
              </ProcurementSelect>
            </FormField>
            <FormField id="proc-export-format" label="قالب">
              <ProcurementSelect
                id="proc-export-format"
                className={selectClass}
                value={format}
                onChange={(event) => {
                  setFormat(event.target.value as 'XLSX' | 'PDF');
                  setDocumentTypeId('');
                  setCreated(null);
                }}
              >
                <option value="XLSX">Excel</option>
                <option value="PDF">PDF</option>
              </ProcurementSelect>
            </FormField>
            <FormField id="proc-export-type" label="نوع سند خرید">
              <ProcurementSelect
                id="proc-export-type"
                className={selectClass}
                value={documentTypeId}
                onChange={(event) => {
                  setDocumentTypeId(event.target.value);
                  setCreated(null);
                }}
              >
                <option value="">انتخاب نوع سند سازگار</option>
                {types.map((type) => (
                  <option value={type.id} key={type.id}>
                    {type.name}
                  </option>
                ))}
              </ProcurementSelect>
            </FormField>
            <FormField id="proc-export-category" label="دسته سند">
              <ProcurementSelect
                id="proc-export-category"
                className={selectClass}
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setCreated(null);
                }}
              >
                <option value="">انتخاب دسته</option>
                {options.data.data.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </ProcurementSelect>
            </FormField>
            {kind === 'ORDER' && (
              <div className="space-y-2">
                <FormField id="proc-export-order" label="سفارش">
                  <ProcurementSelect
                    id="proc-export-order"
                    className={selectClass}
                    value={orderId}
                    onChange={(event) => {
                      setOrderId(event.target.value);
                      setCreated(null);
                    }}
                  >
                    <option value="">انتخاب سفارش</option>
                    {orders.data?.items.map((row) => (
                      <option key={String(row.id)} value={String(row.id)}>
                        {String(row.number ?? row.id)} · نسخه{' '}
                        {String(row.version)}
                      </option>
                    ))}
                  </ProcurementSelect>
                </FormField>
                {orders.isError && (
                  <Alert
                    tone="error"
                    title="سفارش‌ها دریافت نشدند"
                    description={
                      orders.error instanceof Error
                        ? orders.error.message
                        : 'دریافت ناموفق بود'
                    }
                  />
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={orderPage <= 1}
                    onClick={() => setOrderPage(orderPage - 1)}
                  >
                    قبلی
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!orders.data?.hasMore}
                    onClick={() => setOrderPage(orderPage + 1)}
                  >
                    بعدی
                  </Button>
                </div>
              </div>
            )}
          </fieldset>
          {!types.length && (
            <Alert
              tone="warning"
              title="نوع سند سازگار موجود نیست"
              description="نوع سند خرید با قالب انتخاب‌شده باید در اطلاعات پایه اسناد تعریف شود."
            />
          )}
          {error && (
            <Alert
              tone="error"
              title="درخواست خروجی ثبت نشد؛ ورودی حفظ شد"
              description={error}
            />
          )}
          {created && (
            <Alert
              title="درخواست خروجی ثبت شد"
              description={`وضعیت اولیه: ${labels[created.status]}. وضعیت جاری در فهرست زیر نمایش داده می‌شود.`}
            />
          )}
          <Button
            type="submit"
            loading={busy}
            disabled={
              !branchId ||
              !documentTypeId ||
              !categoryId ||
              (kind === 'ORDER' && !orderId) ||
              !!created
            }
          >
            ثبت درخواست تولید خروجی
          </Button>
          {created && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                identity.current = null;
                setCreated(null);
              }}
            >
              آماده‌سازی درخواست خروجی تازه
            </Button>
          )}
        </form>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">خروجی‌های من</h3>
        <Button variant="ghost" onClick={() => void jobs.refetch()}>
          به‌روزرسانی وضعیت
        </Button>
      </div>
      {jobs.isPending ? (
        <Skeleton className="h-28" />
      ) : jobs.isError ? (
        <Alert
          tone="error"
          title="سوابق خروجی دریافت نشد"
          description={
            jobs.error instanceof Error
              ? jobs.error.message
              : 'دریافت ناموفق بود'
          }
        />
      ) : !jobs.data.items.length ? (
        <p className="text-sm text-muted-foreground">
          درخواست خروجی ثبت نشده است.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {jobs.data.items.map((job) => (
            <div
              key={job.id}
              className="space-y-3 rounded-xl border border-border p-4"
            >
              <div className="flex justify-between gap-3">
                <span className="text-sm">
                  {job.kind === 'ORDER'
                    ? 'سفارش'
                    : job.kind === 'REPORT'
                      ? 'گزارش'
                      : 'درخواست‌ها'}{' '}
                  · {job.format}
                </span>
                <Badge>{labels[job.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatProcurementDate(job.createdAt, true)}
              </p>
              {job.status === 'FAILED' && (
                <Alert
                  tone="error"
                  title="تولید فایل ناموفق بود"
                  description={job.errorCode ?? 'جزئیات خطا در دسترس نیست'}
                />
              )}
              {job.result && (
                <>
                  <p className="text-xs">
                    {exportScanSnapshotText(job.result.scanStatus)}
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={`/documents?document=${encodeURIComponent(job.result.documentId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      مشاهده در اسناد (زبانه جدید)
                    </a>
                  </Button>
                  <p className="break-all text-xs text-muted-foreground">
                    نسخه: {job.result.versionId}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <nav
        aria-label="صفحه‌بندی خروجی‌ها"
        className="flex items-center justify-between"
      >
        <Button
          variant="ghost"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          قبلی
        </Button>
        <span className="text-sm">صفحه {page.toLocaleString('fa-IR')}</span>
        <Button
          variant="ghost"
          disabled={!jobs.data?.hasMore}
          onClick={() => setPage(page + 1)}
        >
          بعدی
        </Button>
      </nav>
    </div>
  );
}
