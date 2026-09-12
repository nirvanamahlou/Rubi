'use client';

import {
  Building2,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  CircleCheck,
  FileClock,
  FileSpreadsheet,
  History,
  Plus,
  Search,
  Trash2,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui/form-controls';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  PageHeader,
} from '@/components/ui/surfaces';
import { FinanceWorkspace } from './finance-workspace';
import {
  accountTreePreview,
  financeInboxPreviewRequests,
  remainingAfterAmount,
  sumDecimalAmounts,
  validateFinanceActionDraft,
  validateFinanceDecision,
  type AccountTreeItem,
  type FinanceActionDraft,
  type FinanceInboxPreviewRequest,
  type InboxRequestStatus,
} from '../model/finance-core';

const requestStatusLabels: Record<InboxRequestStatus, string> = {
  NEW: 'جدید',
  UNDER_REVIEW: 'در انتظار بررسی',
  CORRECTION_REQUIRED: 'نیازمند اصلاح',
  READY_FOR_PAYMENT: 'آماده پرداخت',
  PAID: 'پرداخت‌شده',
  REJECTED: 'ردشده',
  REQUIRES_MANUAL_REVIEW: 'بررسی دستی',
};

function createDraft(request: FinanceInboxPreviewRequest): FinanceActionDraft {
  return {
    accountReference: '',
    partyReference: request.partyReference,
    actualAmount: request.kind === 'RECEIPT_VERIFICATION' ? request.amount : '',
    currencyCode: request.currencyCode,
    occurredAt: '2026-09-12T10:00:00.000Z',
    trackingReference: '',
    feeAmount: '0',
    note: '',
    evidenceReviewed: false,
    idempotencyKey: `finance:request:${request.id}`,
    expectedVersion: String(request.version),
    paymentParts:
      request.kind === 'PAYMENT_REQUEST'
        ? [
            {
              id: 'payment-part-1',
              amount: request.amount,
              trackingReference: '',
            },
          ]
        : [],
  };
}

const accountingCards: readonly [string, string, LucideIcon][] = [
  ['سال و دوره مالی', 'باز / درحال‌بستن / بسته', CalendarRange],
  ['اسناد حسابداری', 'Draft تا Posted و Reversed', FileClock],
  ['دفاتر و گردش', 'روزنامه، کل، معین و تفصیلی', FileSpreadsheet],
  ['کنترل Posting', 'توازن و Maker/Checker', CircleCheck],
];

function money(amount: string, currency: string) {
  return `${amount.replace(/\B(?=(\d{3})+(?!\d))/g, '٬')} ${currency}`;
}

function AccountTree({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const depth: Record<AccountTreeItem['level'], string> = {
    GROUP: 'ps-0',
    GENERAL: 'ps-5',
    SUBSIDIARY: 'ps-10',
    DETAIL: 'ps-14',
  };
  return (
    <div className="space-y-1" role="tree">
      {accountTreePreview.map((account) => (
        <button
          aria-selected={selectedId === account.id}
          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start ${depth[account.level]} ${selectedId === account.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
          key={account.id}
          onClick={() => onSelect(account.id)}
          role="treeitem"
          type="button"
        >
          {account.level !== 'DETAIL' ? (
            <ChevronDown className="size-4 shrink-0" />
          ) : (
            <span className="size-4" />
          )}
          <span className="min-w-12 font-mono text-xs">{account.code}</span>
          <span className="truncate text-sm font-semibold">
            {account.title}
          </span>
        </button>
      ))}
    </div>
  );
}

function AccountingSpace() {
  const [selectedId, setSelectedId] = useState(accountTreePreview[0]!.id);
  const selected = accountTreePreview.find((item) => item.id === selectedId)!;
  return (
    <section className="space-y-6" aria-label="فضای حسابداری">
      <Alert
        title="Phase A حسابداری؛ بدون Persistence"
        description="قواعد توازن، دوره باز، Maker/Checker، Version و Decimal در Domain اجرا و تست می‌شوند؛ ثبت قطعی تا آزادشدن قفل Migration فعال نیست."
        tone="warning"
      />
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black">درخت کدینگ حساب‌ها</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                گروه ← کل ← معین ← تفصیلی
              </p>
            </div>
            <Button disabled size="sm" variant="outline">
              تعریف حساب · پس از Migration
            </Button>
          </div>
          <div className="mt-4">
            <AccountTree onSelect={setSelectedId} selectedId={selectedId} />
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-black">جزئیات حساب</h3>
            <Badge>{selected.level}</Badge>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <FormField label="کد حساب">
              <Input dir="ltr" readOnly value={selected.code} />
            </FormField>
            <FormField label="عنوان">
              <Input readOnly value={selected.title} />
            </FormField>
            <FormField label="ماهیت">
              <Input
                readOnly
                value={selected.nature === 'DEBIT' ? 'بدهکار' : 'بستانکار'}
              />
            </FormField>
            <FormField label="ارز پیش‌فرض">
              <Input dir="ltr" readOnly value={selected.currencyCode} />
            </FormField>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Posting', selected.postingAllowed],
              ['فعال', selected.active],
              ['کنترلی', false],
              ['دائمی', true],
            ].map(([label, enabled]) => (
              <div className="rounded-xl bg-muted p-3" key={String(label)}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 font-bold">{enabled ? 'بله' : 'خیر'}</p>
              </div>
            ))}
          </div>
          <Alert
            className="mt-5"
            title="مانده محاسباتی"
            description={`${money(selected.balance, selected.currencyCode)}؛ فقط خطوط Posted منبع مانده خواهند بود.`}
          />
        </Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {accountingCards.map(([title, detail, Icon]) => (
          <Card className="p-4" key={String(title)}>
            <Icon className="size-5 text-primary" />
            <h3 className="mt-3 font-bold">{title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </Card>
        ))}
      </div>
      <details className="rounded-3xl border border-border bg-surface p-4">
        <summary className="cursor-pointer font-black">
          Workspace قبلی و ۳۰ قابلیت Finance
        </summary>
        <div className="mt-6">
          <FinanceWorkspace />
        </div>
      </details>
    </section>
  );
}

function ActionDialog({
  request,
  onClose,
}: {
  request: FinanceInboxPreviewRequest;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FinanceActionDraft>(() =>
    createDraft(request),
  );
  const [errors, setErrors] = useState<readonly string[]>([]);
  const [validated, setValidated] = useState(false);
  const isReceipt = request.kind === 'RECEIPT_VERIFICATION';
  const postingAccounts = accountTreePreview.filter(
    (account) =>
      account.active &&
      account.postingAllowed &&
      account.currencyCode === request.currencyCode,
  );
  const paymentTotal =
    sumDecimalAmounts(draft.paymentParts.map((part) => part.amount)) ?? '—';
  const settlementAmount = isReceipt ? draft.actualAmount : paymentTotal;
  const balanceAfter =
    settlementAmount === '—'
      ? null
      : remainingAfterAmount(request.outstandingAmount, settlementAmount);
  const update = (key: keyof FinanceActionDraft, value: string | boolean) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const updatePaymentPart = (
    id: string,
    key: 'amount' | 'trackingReference',
    value: string,
  ) =>
    setDraft((current) => ({
      ...current,
      paymentParts: current.paymentParts.map((part) =>
        part.id === id ? { ...part, [key]: value } : part,
      ),
    }));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-h-[92dvh] max-w-3xl overflow-y-auto"
        dir="rtl"
      >
        <DialogTitle>
          {isReceipt ? 'بررسی و تأیید دریافت' : 'ثبت کنترل‌های پرداخت'}
        </DialogTitle>
        <DialogDescription>
          {request.requestNumber} · عملیات مالی برای قرارداد انتخاب‌شده بررسی
          می‌شود؛ ثبت قطعی پس از فعال‌شدن Persistence انجام خواهد شد.
        </DialogDescription>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Card className="p-4 sm:col-span-2">
            <p className="text-xs text-muted-foreground">نام قرارداد</p>
            <p className="mt-1 font-black">{request.contractTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
              {request.contractReference}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">
              {isReceipt ? 'مشتری قرارداد' : 'کارگزار / تأمین‌کننده'}
            </p>
            <p className="mt-1 font-bold">{request.partySnapshot}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {request.partyRoleSnapshot}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">خدمت مرتبط</p>
            <p className="mt-1 font-bold">{request.serviceSnapshot}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">مبلغ قرارداد / تعهد</p>
            <p className="mt-1 font-black" dir="ltr">
              {money(request.contractAmount, request.currencyCode)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">
              پرداخت‌های تأییدشده قبلی
            </p>
            <p className="mt-1 font-black" dir="ltr">
              {money(request.previouslySettledAmount, request.currencyCode)}
            </p>
          </Card>
          <Card className="border-primary/30 bg-primary/5 p-4 sm:col-span-2">
            <p className="text-xs text-muted-foreground">مانده فعلی قرارداد</p>
            <p className="mt-1 text-xl font-black text-primary" dir="ltr">
              {money(request.outstandingAmount, request.currencyCode)}
            </p>
          </Card>
        </div>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const next = validateFinanceActionDraft(
              request.kind,
              draft,
              request.outstandingAmount,
            );
            setErrors(next);
            setValidated(next.length === 0);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={
                isReceipt
                  ? 'حساب بانکی یا صندوق مقصد'
                  : 'حساب بانکی یا صندوق مبدأ'
              }
              required
            >
              <Select
                onValueChange={(v) => update('accountReference', v)}
                value={draft.accountReference}
              >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب حساب" />
                </SelectTrigger>
                <SelectContent>
                  {postingAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} · {account.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                فقط حساب‌های فعال و قابل Posting با ارز {request.currencyCode}
              </p>
            </FormField>
            {isReceipt ? (
              <FormField label="مبلغ واقعی دریافت‌شده" required>
                <Input
                  dir="ltr"
                  inputMode="decimal"
                  onChange={(e) => update('actualAmount', e.target.value)}
                  value={draft.actualAmount}
                />
              </FormField>
            ) : (
              <FormField label="طرف‌حساب پرداخت">
                <Input readOnly value={request.partySnapshot} />
              </FormField>
            )}
            <FormField label="ارز قرارداد" required>
              <Input dir="ltr" readOnly value={draft.currencyCode} />
            </FormField>
            <FormField label="تاریخ و ساعت واقعی UTC" required>
              <Input
                dir="ltr"
                onChange={(e) => update('occurredAt', e.target.value)}
                value={draft.occurredAt}
              />
            </FormField>
            {isReceipt ? (
              <FormField label="شماره پیگیری دریافت">
                <Input
                  dir="ltr"
                  onChange={(e) => update('trackingReference', e.target.value)}
                  value={draft.trackingReference}
                />
              </FormField>
            ) : null}
            <FormField label="کارمزد">
              <Input
                dir="ltr"
                onChange={(e) => update('feeAmount', e.target.value)}
                value={draft.feeAmount}
              />
            </FormField>
          </div>
          {!isReceipt ? (
            <Card className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-black">پرداخت‌های این نوبت</h3>
                  <p className="text-xs text-muted-foreground">
                    پرداخت جزئی را ردیف‌به‌ردیف اضافه یا کم کنید.
                  </p>
                </div>
                <Button
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      paymentParts: [
                        ...current.paymentParts,
                        {
                          id: `payment-part-${Date.now()}`,
                          amount: '',
                          trackingReference: '',
                        },
                      ],
                    }))
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus className="size-4" /> افزودن پرداخت جزئی
                </Button>
              </div>
              {draft.paymentParts.map((part, index) => (
                <div
                  className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end"
                  key={part.id}
                >
                  <Badge>پرداخت {index + 1}</Badge>
                  <FormField label="مبلغ پرداخت">
                    <Input
                      dir="ltr"
                      inputMode="decimal"
                      onChange={(event) =>
                        updatePaymentPart(part.id, 'amount', event.target.value)
                      }
                      value={part.amount}
                    />
                  </FormField>
                  <FormField label="شماره پیگیری">
                    <Input
                      dir="ltr"
                      onChange={(event) =>
                        updatePaymentPart(
                          part.id,
                          'trackingReference',
                          event.target.value,
                        )
                      }
                      value={part.trackingReference}
                    />
                  </FormField>
                  <Button
                    aria-label={`حذف پرداخت ${index + 1}`}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        paymentParts: current.paymentParts.filter(
                          (item) => item.id !== part.id,
                        ),
                      }))
                    }
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </Card>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">مبلغ این عملیات</p>
              <p className="mt-1 font-black" dir="ltr">
                {settlementAmount === '—'
                  ? '—'
                  : money(settlementAmount, request.currencyCode)}
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">
                مانده پس از عملیات
              </p>
              <p className="mt-1 font-black" dir="ltr">
                {balanceAfter === null
                  ? 'مبلغ نامعتبر یا بیشتر از مانده'
                  : money(balanceAfter, request.currencyCode)}
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">
                {isReceipt ? 'حساب مقصد دریافت' : 'حساب مبدأ پرداخت'}
              </p>
              <p className="mt-1 font-bold">
                {draft.accountReference
                  ? postingAccounts.find(
                      (account) => account.id === draft.accountReference,
                    )?.title
                  : 'حساب انتخاب نشده'}
              </p>
            </Card>
          </div>
          {request.previousPayments.length ? (
            <details className="rounded-xl border border-border p-3">
              <summary className="flex cursor-pointer items-center gap-2 font-bold">
                <History className="size-4" /> سابقه پرداخت‌های قرارداد
              </summary>
              <div className="mt-3 space-y-2">
                {request.previousPayments.map((payment) => (
                  <div
                    className="flex flex-wrap justify-between gap-2 rounded-lg bg-muted p-2 text-sm"
                    key={payment.reference}
                  >
                    <span>{payment.reference}</span>
                    <span dir="ltr">
                      {money(payment.amount, request.currencyCode)}
                    </span>
                    <span dir="ltr">{payment.occurredAt}</span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
          <FormField label="توضیح مالی" required>
            <Textarea
              onChange={(e) => update('note', e.target.value)}
              value={draft.note}
            />
          </FormField>
          <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
            <input
              checked={draft.evidenceReviewed}
              onChange={(e) => update('evidenceReviewed', e.target.checked)}
              type="checkbox"
            />{' '}
            فایل رسید در Documents بررسی شده است.
          </label>
          {errors.length ? (
            <Alert
              tone="warning"
              title="اصلاح موارد الزامی"
              description={errors.join(' ')}
            />
          ) : null}
          {validated ? (
            <Alert
              title="Validation محلی موفق"
              description="این نتیجه ثبت مالی، تأیید دریافت یا پرداخت نیست. Persistence و Outbox تا آزادشدن Migration lock مسدود است."
            />
          ) : null}
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} type="button" variant="ghost">
              بستن
            </Button>
            <Button type="submit">
              {isReceipt
                ? 'بررسی و اتصال دریافت به حساب'
                : 'بررسی پرداخت‌های جزئی'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InboxSpace() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('ALL');
  const [selected, setSelected] = useState<FinanceInboxPreviewRequest | null>(
    null,
  );
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const rows = useMemo(
    () =>
      financeInboxPreviewRequests.filter(
        (item) =>
          (status === 'ALL' || item.status === status) &&
          `${item.requestNumber} ${item.contractReference} ${item.contractTitle} ${item.partySnapshot}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [search, status],
  );
  const cards = [
    ['درخواست‌های جدید', '1'],
    ['در انتظار بررسی', '0'],
    ['نیازمند اصلاح', '1'],
    ['آماده پرداخت', '1'],
    ['پرداخت‌شده', '0'],
    ['ردشده', '0'],
    ['دریافت‌های تأییدنشده', '1'],
    ['سررسید گذشته', '1'],
  ];
  return (
    <section className="space-y-5" aria-label="کارتابل درخواست‌های مالی">
      <Alert
        tone="warning"
        title="کارتابل Preview؛ هیچ درخواست عملیاتی ثبت نمی‌شود"
        description="داده‌ها synthetic هستند. نتیجه موفق بانکی، Receipt، Payment، Journal و Event تا Persistence واقعی نمایش داده یا ایجاد نمی‌شود."
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {cards.map(([label, value]) => (
          <Card className="p-3" key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-black text-primary">{value}</p>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_15rem_auto]">
          <div className="relative">
            <Search className="absolute end-3 top-3 size-4 text-muted-foreground" />
            <Input
              className="pe-10"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="شماره درخواست، قرارداد یا طرف‌حساب"
              value={search}
            />
          </div>
          <Select onValueChange={setStatus} value={status}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
              {Object.entries(requestStatusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline">فیلترهای بیشتر</Button>
        </div>
      </Card>
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((request) => (
            <Card className="p-4" key={request.id}>
              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.3fr_1fr_1fr_auto] lg:items-center">
                <div>
                  <Badge>
                    {request.kind === 'RECEIPT_VERIFICATION'
                      ? 'تأیید دریافت فروش'
                      : 'درخواست پرداخت'}
                  </Badge>
                  <p className="mt-2 font-mono text-xs">
                    {request.requestNumber}
                  </p>
                </div>
                <div>
                  <p className="font-bold">{request.contractTitle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {request.contractReference} · {request.partySnapshot}
                  </p>
                </div>
                <div>
                  <p className="font-black" dir="ltr">
                    {money(request.amount, request.currencyCode)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    مانده قرارداد:{' '}
                    {money(request.outstandingAmount, request.currencyCode)}
                  </p>
                </div>
                <div>
                  <Badge>{requestStatusLabels[request.status]}</Badge>
                  <p className="mt-2 text-xs text-muted-foreground" dir="ltr">
                    {request.dueAt}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setSelected(request)} size="sm">
                    {request.kind === 'RECEIPT_VERIFICATION'
                      ? 'بررسی دریافت'
                      : 'بررسی پرداخت'}
                  </Button>
                  <Button
                    onClick={() => {
                      setDecisionId(request.id);
                      setReason('');
                      setDecisionError(null);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    رد / اصلاح
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="درخواستی پیدا نشد"
          description="فیلترها را تغییر دهید."
        />
      )}
      {selected ? (
        <ActionDialog
          key={selected.id}
          onClose={() => setSelected(null)}
          request={selected}
        />
      ) : null}
      <Dialog
        open={decisionId !== null}
        onOpenChange={(open) => {
          if (!open) setDecisionId(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogTitle>رد یا درخواست اصلاح</DialogTitle>
          <DialogDescription>
            دلیل اجباری است و در نسخه عملیاتی به‌صورت پیام جدید و Audit ثبت
            می‌شود.
          </DialogDescription>
          <div className="mt-4">
            <Textarea
              onChange={(e) => setReason(e.target.value)}
              placeholder="دلیل کامل برای واحد مبدأ"
              value={reason}
            />
          </div>
          {decisionError ? (
            <p className="mt-2 text-sm text-destructive">{decisionError}</p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setDecisionId(null)} variant="ghost">
              انصراف
            </Button>
            <Button
              onClick={() => {
                const error = validateFinanceDecision(reason);
                setDecisionError(error);
                if (!error) setDecisionId(null);
              }}
              variant="outline"
            >
              بررسی دلیل
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function FinanceModuleFooter() {
  return (
    <>
      <Card className="p-4">
        <p className="text-sm font-bold">Stateهای استاندارد رابط مالی</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            'Loading',
            'Empty',
            'Error',
            'Unauthorized',
            'Forbidden',
            'Conflict',
            'Success · validation-only',
          ].map((state) => (
            <Badge key={state}>{state}</Badge>
          ))}
        </div>
      </Card>
      <Alert
        title="امنیت و مرز ماژول"
        description="مجوزها در Backend باید enforce شوند؛ Finance فقط Public Contract نسخه‌دار و Snapshot حداقلی مصرف می‌کند و شماره حساب/کارت/شبا را Mask نگه می‌دارد. CVV هرگز ذخیره نمی‌شود."
      />
    </>
  );
}

function FinanceContext() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Building2 className="size-4" /> شرکت نمونه · شعبه مرکزی{' '}
      <ChevronLeft className="size-3" /> <WalletCards className="size-4" /> داده
      عملیاتی غیرفعال
    </div>
  );
}

export function FinanceAccountingWorkspace() {
  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow="Rubi Finance"
        title="حسابداری"
        description="کدینگ حساب‌ها، دوره مالی، اسناد، دفاتر و کنترل‌های خزانه"
      />
      <FinanceContext />
      <AccountingSpace />
      <FinanceModuleFooter />
    </main>
  );
}

export function FinanceRequestInboxWorkspace() {
  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow="Rubi Finance"
        title="کارتابل درخواست‌ها"
        description="بررسی مستقل درخواست‌های دریافت و پرداخت فروش، رزرواسیون، خرید و منابع انسانی"
      />
      <FinanceContext />
      <InboxSpace />
      <FinanceModuleFooter />
    </main>
  );
}
