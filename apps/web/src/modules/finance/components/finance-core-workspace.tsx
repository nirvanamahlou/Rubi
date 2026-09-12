'use client';

import {
  Building2,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  CircleCheck,
  CircleDollarSign,
  FileClock,
  FileSpreadsheet,
  Landmark,
  Search,
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
  validateFinanceActionDraft,
  validateFinanceDecision,
  type AccountTreeItem,
  type FinanceActionDraft,
  type FinanceInboxPreviewRequest,
  type FinanceSpace,
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

const blankDraft: FinanceActionDraft = {
  accountReference: '',
  partyReference: '',
  actualAmount: '',
  currencyCode: 'IRR',
  occurredAt: '2026-09-12T10:00:00.000Z',
  trackingReference: '',
  feeAmount: '0',
  note: '',
  evidenceReviewed: false,
  idempotencyKey: 'finance:request:preview-001',
  expectedVersion: '1',
};

const accountingCards: readonly [string, string, LucideIcon][] = [
  ['سال و دوره مالی', 'باز / درحال‌بستن / بسته', CalendarRange],
  ['اسناد حسابداری', 'Draft تا Posted و Reversed', FileClock],
  ['دفاتر و گردش', 'روزنامه، کل، معین و تفصیلی', FileSpreadsheet],
  ['کنترل Posting', 'توازن و Maker/Checker', CircleCheck],
];

function money(amount: string, currency: string) {
  return `${amount.replace(/\B(?=(\d{3})+(?!\d))/g, '٬')} ${currency}`;
}

function SpaceCard({
  active,
  description,
  icon: Icon,
  onClick,
  title,
}: {
  active: boolean;
  description: string;
  icon: typeof Landmark;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className={`rounded-3xl border p-5 text-start transition ${active ? 'border-primary bg-primary text-primary-foreground shadow-lg' : 'border-border bg-surface hover:border-primary/50'}`}
      onClick={onClick}
      type="button"
    >
      <span
        className={`grid size-12 place-items-center rounded-2xl ${active ? 'bg-white/15' : 'bg-primary/10 text-primary'}`}
      >
        <Icon className="size-6" />
      </span>
      <h2 className="mt-4 text-xl font-black">{title}</h2>
      <p
        className={`mt-2 text-sm leading-7 ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
      >
        {description}
      </p>
    </button>
  );
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
  request: FinanceInboxPreviewRequest | null;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FinanceActionDraft>(blankDraft);
  const [errors, setErrors] = useState<readonly string[]>([]);
  const [validated, setValidated] = useState(false);
  if (!request) return null;
  const isReceipt = request.kind === 'RECEIPT_VERIFICATION';
  const update = (key: keyof FinanceActionDraft, value: string | boolean) =>
    setDraft((current) => ({ ...current, [key]: value }));
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
          {request.requestNumber} · {request.contractReference} · عملیات فقط
          اعتبارسنجی می‌شود و چیزی ذخیره نخواهد شد.
        </DialogDescription>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const next = validateFinanceActionDraft(request.kind, draft);
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
                  <SelectItem value="preview-bank-account-001">
                    حساب بانکی نمونه •••• ۱۲۳۴
                  </SelectItem>
                  <SelectItem value="preview-cash-account-001">
                    صندوق نمونه مرکزی
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="طرف‌حساب">
              <Input
                onChange={(e) => update('partyReference', e.target.value)}
                placeholder="Public Reference"
                value={draft.partyReference}
              />
            </FormField>
            <FormField label="مبلغ واقعی" required>
              <Input
                dir="ltr"
                inputMode="decimal"
                onChange={(e) => update('actualAmount', e.target.value)}
                value={draft.actualAmount}
              />
            </FormField>
            <FormField label="ارز" required>
              <Select
                onValueChange={(v) => update('currencyCode', v)}
                value={draft.currencyCode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['IRR', 'USD', 'EUR'].map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="تاریخ و ساعت واقعی UTC" required>
              <Input
                dir="ltr"
                onChange={(e) => update('occurredAt', e.target.value)}
                value={draft.occurredAt}
              />
            </FormField>
            <FormField label="شماره پیگیری">
              <Input
                dir="ltr"
                onChange={(e) => update('trackingReference', e.target.value)}
                value={draft.trackingReference}
              />
            </FormField>
            <FormField label="کارمزد">
              <Input
                dir="ltr"
                onChange={(e) => update('feeAmount', e.target.value)}
                value={draft.feeAmount}
              />
            </FormField>
            <FormField label="Version">
              <Input
                dir="ltr"
                onChange={(e) => update('expectedVersion', e.target.value)}
                value={draft.expectedVersion}
              />
            </FormField>
          </div>
          <FormField label="توضیح مالی" required>
            <Textarea
              onChange={(e) => update('note', e.target.value)}
              value={draft.note}
            />
          </FormField>
          <FormField label="Idempotency Key" required>
            <Input
              dir="ltr"
              onChange={(e) => update('idempotencyKey', e.target.value)}
              value={draft.idempotencyKey}
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
            <Button type="submit">بررسی اطلاعات</Button>
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
          `${item.requestNumber} ${item.contractReference} ${item.partySnapshot}`
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
                  <p className="font-bold">{request.partySnapshot}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {request.sourceModule} · {request.contractReference}
                  </p>
                </div>
                <div>
                  <p className="font-black" dir="ltr">
                    {money(request.amount, request.currencyCode)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    معادل ریالی: {money(request.rialEquivalent, 'IRR')}
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
      <ActionDialog onClose={() => setSelected(null)} request={selected} />
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

export function FinanceCoreWorkspace() {
  const [space, setSpace] = useState<FinanceSpace>('accounting');
  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow="Rubi Finance"
        title="مالی و خزانه‌داری"
        description="موتور مشترک حسابداری و کارتابل کنترل درخواست‌های مالی"
      />
      <div className="grid gap-4 md:grid-cols-2" aria-label="انتخاب فضای مالی">
        <SpaceCard
          active={space === 'accounting'}
          description="کدینگ، دوره مالی، اسناد، دفاتر و کنترل Posting"
          icon={Landmark}
          onClick={() => setSpace('accounting')}
          title="۱. حسابداری"
        />
        <SpaceCard
          active={space === 'inbox'}
          description="دریافت و بررسی درخواست‌های فروش، رزرواسیون، خرید و منابع انسانی"
          icon={CircleDollarSign}
          onClick={() => setSpace('inbox')}
          title="۲. مالی / کارتابل درخواست‌ها"
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Building2 className="size-4" /> شرکت نمونه · شعبه مرکزی{' '}
        <ChevronLeft className="size-3" /> <WalletCards className="size-4" />{' '}
        داده عملیاتی غیرفعال
      </div>
      {space === 'accounting' ? <AccountingSpace /> : <InboxSpace />}
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
    </main>
  );
}
