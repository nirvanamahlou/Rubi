'use client';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  ProcurementPermission,
  ProcurementRequestV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { cleanSalesMoney } from '@/components/ui/money-input';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { Alert, Card } from '@/components/ui/surfaces';
import { procurementApi, commandAttempt, type Bootstrap } from './api';
import { selectClass } from './draft-form';
import { ProcurementDocumentPicker } from './document-picker';
import { ProcurementSelect } from './procurement-select';

type Operation = {
  action: string;
  label: string;
  permission: ProcurementPermission;
  groups: string[];
};
const operations: Operation[] = [
  {
    action: 'ADJUST_RECEIPT',
    label: 'ثبت اصلاح جبرانی رسید',
    permission: 'procurement.acceptance.manage',
    groups: ['receipts', 'adjustments'],
  },
  {
    action: 'AMEND_ORDER',
    label: 'اصلاح سفارش و ارسال برای تأیید مجدد',
    permission: 'procurement.order.amend',
    groups: ['orders'],
  },
  {
    action: 'QUOTE',
    label: 'ثبت پیشنهاد تأمین‌کننده',
    permission: 'procurement.quote.manage',
    groups: ['quotations'],
  },
  {
    action: 'SELECT_QUOTE',
    label: 'انتخاب پیشنهاد',
    permission: 'procurement.quote.select',
    groups: ['quotations'],
  },
  {
    action: 'ORDER',
    label: 'ایجاد سفارش برای تأیید نهایی',
    permission: 'procurement.order.manage',
    groups: ['orders'],
  },
  {
    action: 'ISSUE_ORDER',
    label: 'صدور سفارش تأییدشده',
    permission: 'procurement.order.issue',
    groups: ['orders'],
  },
  {
    action: 'CLOSE_REMAINDER',
    label: 'بستن مانده سفارش',
    permission: 'procurement.order.cancel',
    groups: ['orders'],
  },
  {
    action: 'CANCEL_ORDER',
    label: 'لغو سفارش',
    permission: 'procurement.order.cancel',
    groups: ['orders'],
  },
  {
    action: 'RECEIVE',
    label: 'ثبت رسید کالا',
    permission: 'procurement.receipt.manage',
    groups: ['receipts'],
  },
  {
    action: 'ACCEPT_SERVICE',
    label: 'پذیرش خدمت',
    permission: 'procurement.acceptance.manage',
    groups: ['acceptances'],
  },
  {
    action: 'DISCREPANCY',
    label: 'ثبت مغایرت',
    permission: 'procurement.discrepancy.manage',
    groups: ['discrepancies'],
  },
  {
    action: 'RESOLVE_DISCREPANCY',
    label: 'رسیدگی به مغایرت',
    permission: 'procurement.discrepancy.manage',
    groups: ['discrepancies'],
  },
  {
    action: 'RETURN',
    label: 'ثبت مرجوعی',
    permission: 'procurement.return.manage',
    groups: ['returns'],
  },
  {
    action: 'INVOICE',
    label: 'ثبت فاکتور تأمین‌کننده',
    permission: 'procurement.invoice.manage',
    groups: ['invoices'],
  },
  {
    action: 'MATCH_INVOICE',
    label: 'تطبیق فاکتور و تحویل',
    permission: 'procurement.invoice.manage',
    groups: ['invoices'],
  },
  {
    action: 'SUBMIT_FINANCE',
    label: 'ارجاع فاکتور به مالی',
    permission: 'procurement.invoice.submit_finance',
    groups: ['invoices', 'handoffs'],
  },
];
const primaryAction: Record<string, string> = {
  quotations: 'QUOTE',
  orders: 'ORDER',
  receipts: 'RECEIVE',
  adjustments: 'ADJUST_RECEIPT',
  acceptances: 'ACCEPT_SERVICE',
  discrepancies: 'DISCREPANCY',
  returns: 'RETURN',
  invoices: 'INVOICE',
  handoffs: 'SUBMIT_FINANCE',
};
type Row = Record<string, unknown>;
const flatten = (row: Row): Row => ({
  ...(typeof row.data === 'object' && row.data !== null ? row.data : {}),
  ...row,
});
type Line = {
  itemId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  tax: string;
  extraCost: string;
  acceptedQuantity: string;
  rejectedQuantity: string;
};
const makeLine = (itemId: string): Line => ({
  itemId,
  quantity: '',
  unitPrice: '',
  discount: '0',
  tax: '0',
  extraCost: '0',
  acceptedQuantity: '',
  rejectedQuantity: '0',
});
const recordLabel = (row: Row) =>
  [
    row.number ?? row.invoiceNumber ?? row.name ?? row.id,
    row.status,
    row.currencyCode,
    row.totalAmount,
  ]
    .filter(Boolean)
    .join(' · ');
export function OperationForm({
  request,
  bootstrap,
  kind,
  onChanged,
}: {
  request: ProcurementRequestV1;
  bootstrap: Bootstrap;
  kind: string;
  onChanged: (value: ProcurementRequestV1) => void;
}) {
  const available = operations.filter(
    (value) =>
      value.groups.includes(kind) &&
      bootstrap.permissions.includes(value.permission) &&
      (value.action !== 'ADJUST_RECEIPT' ||
        bootstrap.permissions.includes('procurement.receipt.manage')),
  );
  const [action, setAction] = useState(
    () =>
      available.find((value) => value.action === primaryAction[kind])?.action ??
      available[0]?.action ??
      '',
  );
  if (!available.length)
    return (
      <Card className="space-y-2 border-dashed p-5">
        <h3 className="font-bold text-[#113975]">ثبت و ویرایش این مرحله</h3>
        <p className="text-sm text-muted-foreground">
          برای ثبت یا اصلاح سوابق این مرحله، نقش «کارشناس تأمین و سفارش» لازم
          است. اطلاعات ثبت‌شده همچنان در همین پرونده قابل مشاهده‌اند.
        </p>
      </Card>
    );
  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-bold text-[#113975]">
        فرم{' '}
        {available.find((value) => value.action === action)?.label ??
          available[0]?.label}
      </h3>
      <p className="text-xs text-muted-foreground">
        شماره درخواست مرجع:{' '}
        <span className="font-semibold text-foreground">{request.number}</span>
        {kind === 'orders' || kind === 'receipts'
          ? ' · شماره سفارش یا رسید هنگام ثبت در سرور ساخته می‌شود.'
          : ''}
      </p>
      <p className="text-xs leading-5 text-muted-foreground">
        ویرایش سوابق عملیاتی به‌صورت نسخه یا اصلاح جبرانی ثبت می‌شود تا سابقهٔ
        پرونده حفظ شود.
      </p>
      {available.length > 1 && (
        <FormField id="proc-operation" label="نوع عملیات این بخش">
          <ProcurementSelect
            id="proc-operation"
            className={selectClass}
            value={action}
            onChange={(event) => setAction(event.target.value)}
          >
            {available.map((value) => (
              <option key={value.action} value={value.action}>
                {value.label}
              </option>
            ))}
          </ProcurementSelect>
        </FormField>
      )}
      {action && available.some((value) => value.action === action) && (
        <OperationFields
          key={action}
          action={action}
          request={request}
          bootstrap={bootstrap}
          onChanged={onChanged}
          label={available.find((value) => value.action === action)!.label}
        />
      )}
    </Card>
  );
}

function OperationFields({
  action,
  request,
  bootstrap,
  onChanged,
  label,
}: {
  action: string;
  request: ProcurementRequestV1;
  bootstrap: Bootstrap;
  onChanged: (value: ProcurementRequestV1) => void;
  label: string;
}) {
  const [fields, setFields] = useState<Record<string, string>>({
    currencyCode: request.draft.currencyCode ?? '',
    deliveryLocation: request.draft.deliveryLocation,
    kind: 'SHORTAGE',
    resolution: 'REPLACE',
    disposition: 'ACCEPTED',
    receivedDelta: '0',
    acceptedDelta: '0',
    rejectedDelta: '0',
  });
  const [customLocations, setCustomLocations] = useState<
    Record<string, boolean>
  >({});
  const [selectedOrder, setSelectedOrder] = useState<Row | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [singleSource, setSingleSource] = useState(false);
  const [documents, setDocuments] = useState(() => [
    ...request.draft.documents,
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const identity = useRef<ReturnType<typeof commandAttempt> | null>(null);
  const set = (key: string, value: string) =>
    setFields((previous) => ({ ...previous, [key]: value }));
  const date = (key: string, title: string) => (
    <FormField id={`operation-${key}`} label={title}>
      <DatePicker
        id={`operation-${key}`}
        value={fields[key]?.slice(0, 10) ?? ''}
        onChange={(value) => set(key, value ? `${value}T00:00:00.000Z` : '')}
      />
    </FormField>
  );
  const input = (key: string, title: string, multiline = false) => (
    <FormField id={`operation-${key}`} label={title}>
      {multiline ? (
        <Textarea
          id={`operation-${key}`}
          value={fields[key] ?? ''}
          onChange={(event) =>
            set(
              key,
              key === 'quantity' || key.endsWith('Delta')
                ? cleanSalesMoney(event.target.value)
                : event.target.value,
            )
          }
        />
      ) : (
        <Input
          id={`operation-${key}`}
          value={fields[key] ?? ''}
          onChange={(event) =>
            set(
              key,
              key === 'quantity' || key.endsWith('Delta')
                ? cleanSalesMoney(event.target.value)
                : event.target.value,
            )
          }
        />
      )}
    </FormField>
  );
  const location = (key: string, title: string) => {
    const existing = [
      ...new Set(
        [
          request.draft.deliveryLocation,
          ...bootstrap.branches.map((branch) => branch.label),
        ].filter(Boolean),
      ),
    ];
    const custom =
      customLocations[key] ||
      Boolean(fields[key] && !existing.includes(fields[key] ?? ''));
    return (
      <FormField id={`operation-${key}`} label={title}>
        <div className="space-y-2">
          <ProcurementSelect
            id={`operation-${key}`}
            value={custom ? '__other_location__' : (fields[key] ?? '')}
            onChange={(event) => {
              const other = event.target.value === '__other_location__';
              setCustomLocations((previous) => ({ ...previous, [key]: other }));
              set(key, other ? '' : event.target.value);
            }}
          >
            <option value="">انتخاب از محل‌های ثبت‌شده</option>
            {existing.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
            <option value="__other_location__">محل دیگر</option>
          </ProcurementSelect>
          {(custom || existing.length === 0) && (
            <Input
              aria-label={`محل دیگر برای ${title}`}
              value={fields[key] ?? ''}
              onChange={(event) => set(key, event.target.value)}
            />
          )}
        </div>
      </FormField>
    );
  };
  const choose = (key: string, title: string, resource: string) => (
    <RecordSelect
      requestId={request.id}
      resource={resource}
      label={title}
      value={fields[key] ?? ''}
      onChange={(row) => {
        set(key, String(row.id));
        if (key === 'orderId') {
          setSelectedOrder(row);
          setLines(
            action === 'AMEND_ORDER' && Array.isArray(row.lines)
              ? (row.lines as Row[]).map((line) => ({
                  ...makeLine(String(line.requestItemId)),
                  quantity: String(line.quantity),
                  unitPrice: String(line.unitPrice),
                  discount: String(line.discountAmount ?? '0'),
                  tax: String(line.taxAmount ?? '0'),
                  extraCost: String(line.extraCostAmount ?? '0'),
                }))
              : [],
          );
        }
      }}
    />
  );
  const hasOrder = [
    'AMEND_ORDER',
    'ISSUE_ORDER',
    'CLOSE_REMAINDER',
    'CANCEL_ORDER',
    'RECEIVE',
    'ACCEPT_SERVICE',
    'INVOICE',
    'DISCREPANCY',
  ].includes(action);
  const commercial = ['QUOTE', 'INVOICE', 'AMEND_ORDER'].includes(action);
  const lineOptions: Row[] =
    action === 'QUOTE'
      ? request.draft.items.map((item) => ({
          id: item.id,
          description: item.description,
          kind: item.kind,
        }))
      : Array.isArray(selectedOrder?.lines)
        ? (selectedOrder.lines as Row[]).map((row) => ({
            ...flatten(row),
            ...(action === 'AMEND_ORDER' ? { id: row.requestItemId } : {}),
          }))
        : [];
  const eligibleLines =
    action === 'RECEIVE'
      ? lineOptions.filter((row) => row.kind !== 'SERVICE')
      : action === 'ACCEPT_SERVICE'
        ? lineOptions.filter((row) => row.kind !== 'GOODS')
        : lineOptions;
  async function submit() {
    setBusy(true);
    setError('');
    setSuccess('');
    let body: Record<string, unknown> = { ...fields, action };
    if (action === 'SELECT_QUOTE') body = { ...body, singleSource };
    if (commercial)
      body = {
        ...body,
        ...(action !== 'AMEND_ORDER' ? { documents } : {}),
        lines: lines.map(
          ({ itemId, quantity, unitPrice, discount, tax, extraCost }) => ({
            itemId,
            quantity,
            unitPrice,
            discount,
            tax,
            extraCost,
          }),
        ),
      };
    if (action === 'RECEIVE')
      body = {
        ...body,
        documents,
        lines: lines.map(
          ({ itemId, quantity, acceptedQuantity, rejectedQuantity }) => ({
            itemId,
            quantity,
            acceptedQuantity,
            rejectedQuantity,
          }),
        ),
      };
    if (['ACCEPT_SERVICE', 'RETURN', 'ADJUST_RECEIPT'].includes(action))
      body = { ...body, documents };
    identity.current = commandAttempt(identity.current, request, body);
    try {
      onChanged(
        await procurementApi.command(
          identity.current.request,
          body,
          identity.current.key,
        ),
      );
      setSuccess('عملیات ثبت شد. سوابق پرونده به‌روز شده است.');
      identity.current = null;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'عملیات ثبت نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {error && (
        <Alert
          tone="error"
          title="عملیات ثبت نشد؛ ورودی‌ها حفظ شده‌اند"
          description={error}
        />
      )}
      {success && <Alert title={success} />}
      <fieldset disabled={busy} className="space-y-5">
        <legend className="sr-only">{label}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {hasOrder && choose('orderId', 'سفارش مرجع', 'orders')}
          {action === 'AMEND_ORDER' &&
            choose('supplierId', 'تأمین‌کننده جدید یا فعلی', 'suppliers')}
          {action === 'QUOTE' && (
            <>
              {choose('supplierId', 'تأمین‌کننده', 'suppliers')}
              {date('quotedAt', 'تاریخ پیشنهاد')}
              {date('validUntil', 'اعتبار پیشنهاد')}
              {date('deliveryAt', 'موعد تحویل')}
              {input('paymentTerms', 'شرایط پرداخت')}
              {input('warranty', 'ضمانت')}
              {input('qualityNote', 'ارزیابی کیفیت')}
            </>
          )}
          {action === 'SELECT_QUOTE' &&
            choose('quotationId', 'پیشنهاد منتخب', 'quotations')}
          {action === 'ORDER' && (
            <>
              {choose('selectionId', 'انتخاب ثبت‌شده', 'selections')}
              {date('expectedAt', 'موعد تحویل')}
              {location('deliveryLocation', 'محل تحویل')}
              {input('paymentTerms', 'شرایط پرداخت')}
            </>
          )}
          {action === 'RECEIVE' && (
            <>
              {date('receivedAt', 'تاریخ دریافت')}
              {location('location', 'محل دریافت')}
            </>
          )}
          {action === 'ACCEPT_SERVICE' && (
            <>
              <FormField id="operation-service-item" label="ردیف خدمت">
                <ProcurementSelect
                  id="operation-service-item"
                  className={selectClass}
                  value={fields.itemId ?? ''}
                  onChange={(event) => set('itemId', event.target.value)}
                >
                  <option value="">انتخاب خدمت سفارش</option>
                  {eligibleLines.map((row) => (
                    <option key={String(row.id)} value={String(row.id)}>
                      {String(row.description ?? row.id)}
                    </option>
                  ))}
                </ProcurementSelect>
              </FormField>
              {input('quantity', 'مقدار پذیرفته‌شده')}
              {date('acceptedAt', 'تاریخ پذیرش')}
              {input('evidence', 'شواهد و نتیجه بررسی خدمت', true)}
            </>
          )}
          {action === 'INVOICE' && (
            <>
              {input('number', 'شماره فاکتور تأمین‌کننده')}
              {date('issuedAt', 'تاریخ فاکتور')}
              {date('dueAt', 'تاریخ سررسید')}
            </>
          )}
          {commercial && (
            <FormField id="operation-currency" label="ارز">
              <ProcurementSelect
                id="operation-currency"
                className={selectClass}
                value={fields.currencyCode ?? ''}
                onChange={(event) => set('currencyCode', event.target.value)}
              >
                <option value="">انتخاب ارز</option>
                {bootstrap.currencies.map((currency) => (
                  <option key={currency.id} value={currency.code}>
                    {currency.name} ({currency.code})
                  </option>
                ))}
              </ProcurementSelect>
            </FormField>
          )}
          {['MATCH_INVOICE', 'SUBMIT_FINANCE'].includes(action) &&
            choose('invoiceId', 'فاکتور', 'invoices')}
          {action === 'DISCREPANCY' && (
            <>
              <FormField id="operation-discrepancy-kind" label="نوع مغایرت">
                <ProcurementSelect
                  id="operation-discrepancy-kind"
                  className={selectClass}
                  value={fields.kind}
                  onChange={(event) => set('kind', event.target.value)}
                >
                  {[
                    ['SHORTAGE', 'کسری'],
                    ['DAMAGE', 'خرابی'],
                    ['DELAY', 'تأخیر'],
                    ['SPECIFICATION', 'مشخصات اشتباه'],
                  ].map(([value, title]) => (
                    <option key={value} value={value}>
                      {title}
                    </option>
                  ))}
                </ProcurementSelect>
              </FormField>
              {input('description', 'شرح مغایرت', true)}
            </>
          )}
          {action === 'RESOLVE_DISCREPANCY' && (
            <>
              {choose('discrepancyId', 'مغایرت', 'discrepancies')}
              <FormField id="operation-resolution" label="نتیجه رسیدگی">
                <ProcurementSelect
                  id="operation-resolution"
                  className={selectClass}
                  value={fields.resolution}
                  onChange={(event) => set('resolution', event.target.value)}
                >
                  <option value="REPLACE">جایگزینی</option>
                  <option value="RETURN">مرجوعی</option>
                  <option value="REJECT">رد</option>
                </ProcurementSelect>
              </FormField>
            </>
          )}
          {action === 'RETURN' && (
            <>
              {choose(
                'receiptItemId',
                'ردیف رسید برای مرجوعی',
                'receipt-items',
              )}
              {input('quantity', 'مقدار مرجوعی')}
              {date('returnedAt', 'تاریخ مرجوعی')}
              <FormField
                id="operation-return-disposition"
                label="مبدأ مقدار مرجوعی"
              >
                <ProcurementSelect
                  id="operation-return-disposition"
                  className={selectClass}
                  value={fields.disposition}
                  onChange={(event) => set('disposition', event.target.value)}
                >
                  <option value="ACCEPTED">از مقدار پذیرفته‌شده</option>
                  <option value="REJECTED">از مقدار ردشده</option>
                </ProcurementSelect>
              </FormField>
            </>
          )}
          {action === 'ADJUST_RECEIPT' && (
            <>
              {choose('receiptItemId', 'ردیف رسید برای اصلاح', 'receipt-items')}
              {input('receivedDelta', 'تغییر مقدار دریافت (مثبت یا منفی)')}
              {input('acceptedDelta', 'تغییر مقدار پذیرفته‌شده')}
              {input('rejectedDelta', 'تغییر مقدار ردشده')}
              <Alert
                title="اصلاح با رکورد جبرانی"
                description="فقط اختلاف مقدار را وارد کنید؛ برای نمونه، کاهش یک واحد با ‎-1. رسید اصلی حفظ می‌شود و تغییر قیمت در این عملیات انجام نمی‌شود."
              />
            </>
          )}
        </div>
        {(commercial || action === 'RECEIVE') && (
          <div className="space-y-3">
            <h3 className="font-semibold">اقلام عملیات</h3>
            {!eligibleLines.length && (
              <p className="text-sm text-muted-foreground">
                ابتدا سفارش دارای اقلام را انتخاب کنید؛ در پیشنهاد، اقلام
                درخواست مبنا هستند.
              </p>
            )}
            {lines.map((line, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <FormField id={`op-line-${index}`} label="ردیف مرجع">
                  <ProcurementSelect
                    id={`op-line-${index}`}
                    className={selectClass}
                    value={line.itemId}
                    onChange={(event) =>
                      setLines((previous) =>
                        previous.map((value, at) =>
                          at === index
                            ? { ...value, itemId: event.target.value }
                            : value,
                        ),
                      )
                    }
                  >
                    <option value="">انتخاب ردیف</option>
                    {eligibleLines.map((row) => (
                      <option key={String(row.id)} value={String(row.id)}>
                        {String(row.description ?? row.id)}
                      </option>
                    ))}
                  </ProcurementSelect>
                </FormField>
                {(commercial
                  ? [
                      ['quantity', 'مقدار'],
                      ['unitPrice', 'قیمت واحد'],
                      ['discount', 'تخفیف'],
                      ['tax', 'مالیات'],
                      ['extraCost', 'هزینه جانبی'],
                    ]
                  : [
                      ['quantity', 'مقدار دریافتی'],
                      ['acceptedQuantity', 'پذیرفته‌شده'],
                      ['rejectedQuantity', 'ردشده'],
                    ]
                ).map(([key, title]) => (
                  <FormField
                    key={key}
                    id={`op-line-${index}-${key}`}
                    label={title!}
                  >
                    <Input
                      id={`op-line-${index}-${key}`}
                      dir="ltr"
                      inputMode="decimal"
                      value={line[key as keyof Line]}
                      onChange={(event) =>
                        setLines((previous) =>
                          previous.map((value, at) =>
                            at === index
                              ? {
                                  ...value,
                                  [key!]: cleanSalesMoney(event.target.value),
                                }
                              : value,
                          ),
                        )
                      }
                    />
                  </FormField>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setLines((previous) =>
                      previous.filter((_, at) => at !== index),
                    )
                  }
                >
                  حذف ردیف
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={!eligibleLines.length}
              onClick={() =>
                setLines((previous) => [
                  ...previous,
                  makeLine(String(eligibleLines[0]!.id)),
                ])
              }
            >
              افزودن ردیف
            </Button>
          </div>
        )}
        {action === 'SELECT_QUOTE' && (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={singleSource}
              onChange={(event) => setSingleSource(event.target.checked)}
            />
            خرید تک‌منبعی (نیازمند دلیل و مجوز)
          </label>
        )}
        {input('reason', 'دلیل و توضیحات عملیات', true)}
        {[
          'QUOTE',
          'INVOICE',
          'RECEIVE',
          'ACCEPT_SERVICE',
          'RETURN',
          'ADJUST_RECEIPT',
        ].includes(action) && (
          <ProcurementDocumentPicker
            branchId={request.draft.branchId}
            value={documents}
            onChange={setDocuments}
            available={bootstrap.documents === 'AVAILABLE'}
          />
        )}
        {action === 'SUBMIT_FINANCE' &&
          bootstrap.finance === 'NOT_CONNECTED' && (
            <Alert
              tone="warning"
              title="ارجاع مالی در دسترس نیست"
              description="قرارداد اتصال هنوز توسط مالی فعال نشده است؛ هیچ تعهد مالی ایجاد نمی‌شود."
            />
          )}
        <Button
          type="submit"
          loading={busy}
          disabled={
            !!success ||
            (action === 'SUBMIT_FINANCE' && bootstrap.finance !== 'CONNECTED')
          }
        >
          {label}
        </Button>
      </fieldset>
    </form>
  );
}

function RecordSelect({
  requestId,
  resource,
  label,
  value,
  onChange,
}: {
  requestId: string;
  resource: string;
  label: string;
  value: string;
  onChange: (row: Row) => void;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const query = useQuery({
    queryKey: [
      'procurement',
      'operation-options',
      requestId,
      resource,
      page,
      search,
    ],
    queryFn: async () =>
      resource === 'suppliers'
        ? procurementApi.suppliers(page, search)
        : procurementApi.records(
            requestId,
            resource === 'receipt-items' ? 'receipts' : resource,
            page,
          ),
    retry: false,
  });
  const rows: Row[] = (query.data?.items ?? []) as Row[];
  const options: Row[] =
    resource === 'receipt-items'
      ? rows.flatMap((row) =>
          Array.isArray(row.lines)
            ? (row.lines as Row[]).map((line) => ({
                ...line,
                number: `${String(row.number ?? row.id)} · ${String(line.description ?? line.id)}`,
              }))
            : [],
        )
      : rows;
  return (
    <div className="space-y-2">
      <FormField id={`operation-select-${resource}`} label={label}>
        <ProcurementSelect
          id={`operation-select-${resource}`}
          className={selectClass}
          value={value}
          disabled={query.isPending || query.isError}
          onChange={(event) => {
            const row = options.find(
              (item) => String(item.id) === event.target.value,
            );
            if (row) {
              setSelected(row);
              onChange(row);
            }
          }}
        >
          <option value="">
            {query.isPending ? 'در حال دریافت…' : 'انتخاب از سوابق واقعی'}
          </option>
          {selected && !options.some((row) => row.id === selected.id) && (
            <option value={String(selected.id)}>{recordLabel(selected)}</option>
          )}
          {options.map((row) => (
            <option key={String(row.id)} value={String(row.id)}>
              {recordLabel(row)}
            </option>
          ))}
        </ProcurementSelect>
      </FormField>
      {resource === 'suppliers' && (
        <Input
          aria-label="جست‌وجوی تأمین‌کننده برای عملیات"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      )}
      {query.isError && (
        <div role="alert" className="text-sm text-destructive">
          {query.error instanceof Error
            ? query.error.message
            : 'دریافت ناموفق بود'}
          <Button
            type="button"
            variant="ghost"
            onClick={() => void query.refetch()}
          >
            تلاش دوباره
          </Button>
        </div>
      )}
      {!query.isPending && !query.isError && !options.length && (
        <p className="text-xs text-muted-foreground">
          گزینه‌ای در این صفحه وجود ندارد.
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          صفحه قبل
        </Button>
        <span className="text-xs">{page.toLocaleString('fa-IR')}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!query.data?.hasMore}
          onClick={() => setPage(page + 1)}
        >
          صفحه بعد
        </Button>
      </div>
    </div>
  );
}
