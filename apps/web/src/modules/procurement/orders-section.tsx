'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import type { ProcurementRequestV1 } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { Alert, Card, Skeleton } from '@/components/ui/surfaces';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { MasterDataDateRangeFilter } from '@/modules/master-data/components/master-data-date-range-filter';
import { procurementApi, type Bootstrap } from './api';
import { OperationForm } from './operation-form';
import { ProcurementSelect } from './procurement-select';
import { RecordCard, recordData } from './record-details';
import { formatProcurementDate } from './presentation';
import { ProcurementSupplierLogo } from './supplier-logo';

type Row = Record<string, unknown>;
const labels: Record<string, string> = {
  PENDING_APPROVAL: 'در انتظار تأیید',
  APPROVED: 'تأییدشده',
  ISSUED: 'صادرشده',
  CLOSED: 'بسته‌شده',
  CANCELLED: 'لغوشده',
};
const actions = [
  ['AMEND_ORDER', 'ویرایش سفارش', Pencil, 'procurement.order.amend'],
  ['CANCEL_ORDER', 'حذف سفارش', Trash2, 'procurement.order.cancel'],
  [
    'DISCREPANCY',
    'ثبت مغایرت',
    TriangleAlert,
    'procurement.discrepancy.manage',
  ],
  ['RETURN', 'ثبت مرجوعی', RotateCcw, 'procurement.return.manage'],
] as const;

export function PurchaseOrdersSection({ bootstrap }: { bootstrap: Bootstrap }) {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ action: string; row?: Row } | null>(
    null,
  );
  const canCreate = [
    'procurement.order.manage',
    'procurement.quote.manage',
    'procurement.quote.select',
  ].every((permission) =>
    bootstrap.permissions.some((value) => value === permission),
  );
  const query = useQuery({
    queryKey: ['procurement', 'orders-table', search, status, from, to, page],
    queryFn: () =>
      procurementApi.orders(
        new URLSearchParams({
          page: String(page),
          search,
          status,
          createdFrom: from,
          createdTo: to,
        }),
      ),
    retry: false,
  });
  function changed() {
    void client.invalidateQueries({ queryKey: ['procurement'] });
    setModal(null);
  }
  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">سفارش‌های خرید</h1>
        <Button
          disabled={!canCreate}
          onClick={() => setModal({ action: 'ORDER_FORM' })}
        >
          <Plus className="h-4 w-4" />
          سفارش جدید
        </Button>
      </div>
      <Card className="grid items-end gap-3 p-4 md:grid-cols-[2fr_1fr_2fr]">
        <FormField id="orders-search" label="عنوان یا شماره سفارش">
          <Input
            id="orders-search"
            value={search}
            maxLength={100}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </FormField>
        <FormField id="orders-status" label="وضعیت سفارش">
          <ProcurementSelect
            id="orders-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">همه سفارش‌های فعال</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </ProcurementSelect>
        </FormField>
        <MasterDataDateRangeFilter
          idPrefix="proc-section-5"
          fromDate={from}
          toDate={to}
          onFromDateChange={(value) => {
            const day = value.slice(0, 10);
            setFrom(day);
            if (to && day > to) setTo('');
            setPage(1);
          }}
          onToDateChange={(value) => {
            const day = value.slice(0, 10);
            setTo(day);
            if (from && day < from) setFrom('');
            setPage(1);
          }}
          onReset={() => {
            setFrom('');
            setTo('');
            setPage(1);
          }}
        />
      </Card>
      {query.isPending ? (
        <Skeleton className="h-48" />
      ) : query.isError ? (
        <Alert
          tone="error"
          title="سفارش‌ها دریافت نشد"
          description={query.error.message}
        >
          <Button onClick={() => void query.refetch()}>تلاش دوباره</Button>
        </Alert>
      ) : (
        <Card className="overflow-x-auto">
          <table
            aria-label="سفارش‌های خرید ثبت‌شده"
            className="w-full text-right text-sm"
          >
            <thead className="bg-blue-50 dark:bg-blue-950/30">
              <tr>
                {[
                  'عنوان درخواست',
                  'تأمین‌کننده',
                  'مبلغ / ارز',
                  'موعد تحویل',
                  'وضعیت',
                  'عملیات',
                ].map((title) => (
                  <th className="p-3" key={title}>
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((row) => {
                const data = recordData(row);
                const supplier =
                  typeof data.supplier === 'object' && data.supplier
                    ? (data.supplier as Row)
                    : {};
                return (
                  <tr
                    key={String(row.id)}
                    className="border-t border-border hover:bg-blue-50/40 dark:hover:bg-blue-950/10"
                  >
                    <td className="min-w-52 whitespace-normal break-words p-3">
                      <button
                        className="text-right font-medium text-primary"
                        onClick={() => setModal({ action: 'VIEW', row })}
                      >
                        {String(row.requestTitle)}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <ProcurementSupplierLogo id={String(row.supplierId)} />
                        {String(supplier.name ?? supplier.label ?? '—')}
                      </div>
                    </td>
                    <td className="p-3" dir="ltr">
                      {String(row.totalAmount)} {String(row.currencyCode)}
                    </td>
                    <td className="p-3">
                      {row.expectedAt
                        ? formatProcurementDate(String(row.expectedAt))
                        : '—'}
                    </td>
                    <td className="p-3">
                      {labels[String(row.status)] ?? String(row.status)}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="مشاهده سفارش"
                          title="مشاهده سفارش"
                          onClick={() => setModal({ action: 'VIEW', row })}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {actions.map(([action, label, Icon, permission]) => (
                          <Button
                            key={action}
                            variant="outline"
                            size="icon"
                            aria-label={label}
                            title={label}
                            className={
                              action === 'CANCEL_ORDER'
                                ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
                                : undefined
                            }
                            disabled={
                              !bootstrap.permissions.some(
                                (value) => value === permission,
                              ) || row.status === 'CANCELLED'
                            }
                            onClick={() => setModal({ action, row })}
                          >
                            <Icon aria-hidden="true" className="h-4 w-4" />
                          </Button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!query.data.items.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-muted-foreground"
                  >
                    سفارشی یافت نشد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-border p-3">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              قبلی
            </Button>
            <span>صفحه {page}</span>
            <Button
              variant="outline"
              disabled={!query.data.hasMore}
              onClick={() => setPage(page + 1)}
            >
              بعدی
            </Button>
          </div>
        </Card>
      )}
      <Dialog
        open={Boolean(modal)}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogTitle>
            {modal?.action === 'ORDER_FORM'
              ? 'سفارش جدید'
              : modal?.action === 'VIEW'
                ? 'مشاهده سفارش'
                : actions.find(([action]) => action === modal?.action)?.[1]}
          </DialogTitle>
          {modal &&
            (modal.action === 'VIEW' ? (
              <>
                <RecordCard record={modal.row!} />
                {modal.row?.status === 'APPROVED' &&
                  bootstrap.permissions.includes('procurement.order.issue') && (
                    <OrderOperation
                      bootstrap={bootstrap}
                      action="ISSUE_ORDER"
                      row={modal.row}
                      onChanged={changed}
                    />
                  )}
              </>
            ) : (
              <OrderOperation
                key={`${modal.action}-${String(modal.row?.id ?? 'new')}`}
                bootstrap={bootstrap}
                action={modal.action}
                {...(modal.row ? { row: modal.row } : {})}
                onChanged={changed}
              />
            ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderOperation({
  bootstrap,
  action,
  row,
  onChanged,
}: {
  bootstrap: Bootstrap;
  action: string;
  row?: Row;
  onChanged: () => void;
}) {
  const [requestId, setRequestId] = useState(String(row?.requestId ?? ''));
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const requests = useQuery({
    queryKey: ['procurement', 'order-requests', page, search],
    queryFn: () =>
      procurementApi.list(
        new URLSearchParams({ page: String(page), search, section: 'orders' }),
      ),
    enabled: !row,
    retry: false,
  });
  const detail = useQuery({
    queryKey: ['procurement', 'order-form-request', requestId],
    queryFn: () => procurementApi.get(requestId),
    enabled: Boolean(requestId),
    retry: false,
  });
  const approved =
    requests.data?.items.filter((request) =>
      ['APPROVED', 'SOURCING'].includes(request.status),
    ) ?? [];
  return (
    <div className="space-y-3">
      {!row && (
        <>
          <FormField id="new-order-request" label="درخواست خرید">
            <Input
              aria-label="جست‌وجوی درخواست خرید"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <ProcurementSelect
              id="new-order-request"
              value={requestId}
              onChange={(event) => setRequestId(event.target.value)}
            >
              <option value="">انتخاب درخواست تأییدشده</option>
              {detail.data &&
                !approved.some((item) => item.id === requestId) && (
                  <option value={requestId}>{detail.data.draft.title}</option>
                )}
              {approved.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.draft.title}
                </option>
              ))}
            </ProcurementSelect>
          </FormField>
          <div className="flex justify-between">
            <Button
              variant="ghost"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              قبلی
            </Button>
            <Button
              variant="ghost"
              disabled={!requests.data?.hasMore}
              onClick={() => setPage(page + 1)}
            >
              بعدی
            </Button>
          </div>
          {requests.isError && (
            <Alert
              tone="error"
              title="درخواست‌ها دریافت نشد"
              description={requests.error.message}
            />
          )}
        </>
      )}
      {action === 'CANCEL_ORDER' && (
        <p className="text-sm">
          سفارش لغو و از فهرست فعال حذف می‌شود؛ سوابق آن حفظ می‌شوند.
        </p>
      )}
      {detail.isError && (
        <Alert
          tone="error"
          title="پرونده دریافت نشد"
          description={detail.error.message}
        />
      )}
      {requestId && detail.isPending && <Skeleton className="h-24" />}
      {detail.data && (
        <OperationForm
          key={requestId}
          request={detail.data as ProcurementRequestV1}
          bootstrap={bootstrap}
          kind={
            action === 'RETURN'
              ? 'returns'
              : action === 'DISCREPANCY'
                ? 'discrepancies'
                : 'orders'
          }
          initialAction={action}
          {...(row ? { initialRecord: row } : {})}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
