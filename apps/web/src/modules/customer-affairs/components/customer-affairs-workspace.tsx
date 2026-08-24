'use client';

import type { CustomerSummary } from '@rubi/contracts';

import {
  AlertTriangle,
  ArrowUpLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  FilePenLine,
  Headphones,
  KanbanSquare,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TicketCheck,
  UserSearch,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

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
  DialogDescription,
  DialogTitle,
  Drawer,
  DrawerClose,
  DrawerContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/overlays';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  PaginationShell,
  Skeleton,
} from '@/components/ui/surfaces';
import { CustomerPicker } from './customer-picker';
import {
  CUSTOMER_AFFAIRS_PREVIEW_NOTICE,
  CUSTOMER_AFFAIRS_UI_VERSION,
  normalizeCustomerAffairsQuery,
  type CustomerAffairsListQuery,
  type CustomerAffairsPreviewState,
} from '../api/contracts';
import {
  buildSalesHandoffPreview,
  filterPreviewRecords,
  leadStageLabels,
  paginatePreview,
  previewLeads,
  previewStates,
  previewTickets,
  previewTimeline,
  ticketStatusLabels,
  validateCustomerAffairsDraft,
  type CustomerAffairsDraft,
  type LeadStage,
  type PreviewLead,
  type PreviewTicket,
  type Priority,
  type SLAState,
} from '../model/customer-affairs';

type FormMode = 'create' | 'view' | 'edit';
type FormKind = 'lead' | 'ticket';
type WorkspaceTab = 'presales' | 'support';

const emptyDraft: CustomerAffairsDraft = {
  title: '',
  details: '',
  priority: 'NORMAL',
  assignee: '',
  nextActionAt: '',
};
const previewDraft: CustomerAffairsDraft = {
  title: 'درخواست کاملاً نمایشی',
  details: 'این شرح synthetic است و هیچ اطلاعات واقعی مشتری ندارد.',
  priority: 'HIGH',
  assignee: 'کارشناس نمونه ۰۱',
  nextActionAt: '2026-08-25T08:00',
};
const priorityLabels: Readonly<Record<Priority, string>> = {
  LOW: 'کم',
  NORMAL: 'عادی',
  HIGH: 'زیاد',
  URGENT: 'فوری',
};
const slaLabels: Readonly<Record<SLAState, string>> = {
  ON_TRACK: 'در محدوده SLA',
  AT_RISK: 'نزدیک نقض SLA',
  BREACHED: 'SLA نقض شده',
  PAUSED: 'SLA متوقف',
  MET: 'SLA رعایت شده',
};

function SummaryCard({
  icon: Icon,
  label,
  tone = 'primary',
  value,
}: {
  icon: LucideIcon;
  label: string;
  tone?: 'primary' | 'warning' | 'danger';
  value: string;
}) {
  return (
    <Card className="flex items-center justify-between p-4">
      <div>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
      </div>
      <span
        className={
          tone === 'danger'
            ? 'grid size-11 place-items-center rounded-2xl bg-destructive/10 text-destructive'
            : tone === 'warning'
              ? 'grid size-11 place-items-center rounded-2xl bg-amber-500/10 text-amber-700'
              : 'grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary'
        }
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>
    </Card>
  );
}

function PreviewStateSwitcher({
  onChange,
  state,
}: {
  onChange: (state: CustomerAffairsPreviewState) => void;
  state: CustomerAffairsPreviewState;
}) {
  return (
    <div aria-label="انتخاب وضعیت نمایشی" className="flex flex-wrap gap-2">
      {previewStates.map(([value, label]) => (
        <Button
          aria-pressed={state === value}
          key={value}
          onClick={() => onChange(value)}
          size="sm"
          type="button"
          variant={state === value ? 'primary' : 'outline'}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

function StatePanel({
  onRetry,
  state,
}: {
  onRetry: () => void;
  state: Exclude<CustomerAffairsPreviewState, 'preview'>;
}) {
  if (state === 'loading')
    return (
      <div
        aria-label="در حال بارگذاری Preview"
        className="grid gap-4 md:grid-cols-2"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-36 w-full" key={index} />
        ))}
      </div>
    );
  if (state === 'empty')
    return (
      <EmptyState
        description="در این حالت نمایشی هیچ Lead یا Ticket مطابق فیلتر وجود ندارد."
        title="نتیجه‌ای پیدا نشد"
      />
    );
  if (state === 'forbidden')
    return (
      <EmptyState
        description="دسترسی به Customer Affairs به‌صورت deny-by-default طراحی شده و Permission مناسب لازم است."
        icon={ShieldAlert}
        title="دسترسی مجاز نیست"
      />
    );
  return (
    <ErrorState
      action={
        <Button onClick={onRetry} type="button" variant="outline">
          <RefreshCw aria-hidden="true" className="size-4" />
          تلاش دوباره
        </Button>
      }
      description="این خطا فقط برای پوشش UI State نمایش داده شده و درخواست شبکه‌ای ارسال نشده است."
      title="خطای نمایشی دریافت اطلاعات"
    />
  );
}

function PreviewForm({
  kind,
  mode,
  onClose,
}: {
  kind: FormKind;
  mode: FormMode;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<CustomerAffairsDraft>(
    mode === 'create' ? emptyDraft : previewDraft,
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof CustomerAffairsDraft, string>>
  >({});
  const [validated, setValidated] = useState(false);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerSummary | null>(null);
  const readonly = mode === 'view';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateCustomerAffairsDraft(draft);
    setErrors(result.errors);
    setValidated(result.valid);
  }

  const entityLabel = kind === 'lead' ? 'Lead' : 'Ticket';
  return (
    <Drawer onOpenChange={(open) => !open && onClose()} open>
      <DrawerContent className="w-[min(94vw,42rem)] p-6">
        <DialogTitle>
          {mode === 'create'
            ? `ایجاد نمایشی ${entityLabel}`
            : mode === 'edit'
              ? `ویرایش نمایشی ${entityLabel}`
              : `مشاهده نمایشی ${entityLabel}`}
        </DialogTitle>
        <DialogDescription>
          این فرم فقط Contract و validation فاز A را نمایش می‌دهد؛ Persistence،
          ارسال پیام و تبدیل واقعی فعال نیست.
        </DialogDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>{CUSTOMER_AFFAIRS_UI_VERSION}</Badge>
          <Badge className="bg-amber-500/10 text-amber-700">
            Preview synthetic
          </Badge>
        </div>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <CustomerPicker
            disabled={readonly}
            onSelect={setSelectedCustomer}
            selected={selectedCustomer}
          />
          <FormField
            {...(errors.title ? { error: errors.title } : {})}
            id="customer-affairs-title"
            label={kind === 'lead' ? 'عنوان درخواست مشتری' : 'موضوع Ticket'}
            required
          >
            <Input
              aria-invalid={Boolean(errors.title)}
              disabled={readonly}
              id="customer-affairs-title"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              readOnly={readonly}
              value={draft.title}
            />
          </FormField>
          {kind === 'lead' ? (
            <div className="grid gap-4 rounded-2xl border border-border bg-muted/20 p-4 sm:grid-cols-2">
              <FormField label="منبع آشنایی">
                <Select defaultValue="REFERRAL" disabled={readonly}>
                  <SelectTrigger aria-label="منبع آشنایی">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REFERRAL">معرفی ساختگی</SelectItem>
                    <SelectItem value="WEBSITE">وب‌سایت نمایشی</SelectItem>
                    <SelectItem value="CAMPAIGN">کمپین نمایشی</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="کانال ورودی">
                <Select defaultValue="PHONE" disabled={readonly}>
                  <SelectTrigger aria-label="کانال ورودی">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PHONE">تماس تلفنی</SelectItem>
                    <SelectItem value="MESSAGE">پیام</SelectItem>
                    <SelectItem value="MEETING">جلسه</SelectItem>
                    <SelectItem value="WEB_FORM">فرم آنلاین</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="lead-destination" label="مقصد پیشنهادی">
                <Input
                  defaultValue={mode === 'create' ? '' : 'مقصد نمونه A'}
                  disabled={readonly}
                  id="lead-destination"
                  placeholder="Reference نمایشی مقصد"
                  readOnly={readonly}
                />
              </FormField>
              <FormField id="lead-approximate-date" label="تاریخ تقریبی سفر">
                <Input
                  defaultValue={mode === 'create' ? '' : '2026-09-10'}
                  disabled={readonly}
                  id="lead-approximate-date"
                  readOnly={readonly}
                  type="date"
                />
              </FormField>
              <FormField id="lead-passengers" label="تعداد مسافر">
                <Input
                  defaultValue={mode === 'create' ? '1' : '3'}
                  disabled={readonly}
                  id="lead-passengers"
                  min={1}
                  readOnly={readonly}
                  type="number"
                />
              </FormField>
              <FormField id="lead-budget" label="بودجه اولیه">
                <div className="grid grid-cols-[1fr_5rem] gap-2">
                  <Input
                    defaultValue={mode === 'create' ? '' : '250000000'}
                    disabled={readonly}
                    id="lead-budget"
                    inputMode="decimal"
                    placeholder="Decimal"
                    readOnly={readonly}
                  />
                  <Input
                    aria-label="کد ارز بودجه"
                    defaultValue="IRR"
                    disabled={readonly}
                    dir="ltr"
                    maxLength={3}
                    readOnly={readonly}
                  />
                </div>
              </FormField>
            </div>
          ) : (
            <div className="grid gap-4 rounded-2xl border border-border bg-muted/20 p-4 sm:grid-cols-2">
              <FormField label="دسته‌بندی Ticket">
                <Select defaultValue="HOTEL_VOUCHER" disabled={readonly}>
                  <SelectTrigger aria-label="دسته‌بندی Ticket">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="QUESTION">سؤال</SelectItem>
                    <SelectItem value="COMPLAINT">شکایت</SelectItem>
                    <SelectItem value="PROFILE_CORRECTION">
                      اصلاح مشخصات
                    </SelectItem>
                    <SelectItem value="CANCELLATION">کنسلی</SelectItem>
                    <SelectItem value="REFUND">استرداد</SelectItem>
                    <SelectItem value="TICKET_ISSUE">مشکل بلیت</SelectItem>
                    <SelectItem value="HOTEL_VOUCHER">هتل یا واچر</SelectItem>
                    <SelectItem value="INSURANCE">بیمه</SelectItem>
                    <SelectItem value="ADDITIONAL_SERVICE">
                      خدمات تکمیلی
                    </SelectItem>
                    <SelectItem value="SERVICE_ISSUE">مشکل خدمات</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="وضعیت Ticket">
                <Select defaultValue="NEW" disabled={readonly}>
                  <SelectTrigger aria-label="وضعیت Ticket">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">جدید</SelectItem>
                    <SelectItem value="TRIAGED">دسته‌بندی‌شده</SelectItem>
                    <SelectItem value="IN_PROGRESS">در حال رسیدگی</SelectItem>
                    <SelectItem value="WAITING_CUSTOMER">
                      منتظر مشتری
                    </SelectItem>
                    <SelectItem value="WAITING_EXTERNAL">
                      منتظر واحد بیرونی
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                description="فقط proposal؛ Customer داخلی import نمی‌شود."
                id="ticket-customer-reference"
                label="Customer Reference"
              >
                <Input
                  defaultValue={
                    mode === 'create' ? '' : 'preview-customer-ref-001'
                  }
                  disabled={readonly}
                  dir="ltr"
                  id="ticket-customer-reference"
                  placeholder="preview-customer-ref-*"
                  readOnly={readonly}
                />
              </FormField>
              <FormField
                description="قرارداد/رزرو/خدمت فقط reference پیشنهادی است."
                id="ticket-sales-reference"
                label="Sales/Reservation Reference"
              >
                <Input
                  defaultValue={
                    mode === 'create' ? '' : 'preview-sales-ref-001'
                  }
                  disabled={readonly}
                  dir="ltr"
                  id="ticket-sales-reference"
                  placeholder="preview-sales-ref-*"
                  readOnly={readonly}
                />
              </FormField>
              <Alert
                description="Contract، Reservation، Ticket، Voucher و Insurance فقط به‌صورت reference پیشنهادی و بدون Mutation نگهداری می‌شوند."
                title="ارتباط آینده با فروش و رزرواسیون"
              />
              <FormField id="ticket-response-due" label="موعد اولین پاسخ">
                <Input
                  defaultValue={mode === 'create' ? '' : '2026-08-25T09:00'}
                  disabled={readonly}
                  id="ticket-response-due"
                  readOnly={readonly}
                  type="datetime-local"
                />
              </FormField>
              <FormField id="ticket-resolution-due" label="موعد حل SLA">
                <Input
                  defaultValue={mode === 'create' ? '' : '2026-08-25T16:00'}
                  disabled={readonly}
                  id="ticket-resolution-due"
                  readOnly={readonly}
                  type="datetime-local"
                />
              </FormField>
              <FormField id="ticket-tracking-number" label="شماره پیگیری">
                <Input
                  defaultValue={
                    mode === 'create'
                      ? 'پس از ثبت واقعی صادر می‌شود'
                      : 'PREVIEW-CA-1405-0001'
                  }
                  disabled
                  id="ticket-tracking-number"
                  readOnly
                />
              </FormField>
              <FormField id="ticket-satisfaction" label="امتیاز رضایت مشتری">
                <Select defaultValue="NOT_RECORDED" disabled={readonly}>
                  <SelectTrigger aria-label="امتیاز رضایت مشتری">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOT_RECORDED">ثبت نشده</SelectItem>
                    <SelectItem value="1">۱ از ۵</SelectItem>
                    <SelectItem value="2">۲ از ۵</SelectItem>
                    <SelectItem value="3">۳ از ۵</SelectItem>
                    <SelectItem value="4">۴ از ۵</SelectItem>
                    <SelectItem value="5">۵ از ۵</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="ticket-resolution-outcome" label="نتیجه نهایی">
                <Textarea
                  defaultValue={
                    mode === 'create' ? '' : 'نتیجه synthetic برای Preview'
                  }
                  disabled={readonly}
                  id="ticket-resolution-outcome"
                  readOnly={readonly}
                />
              </FormField>
              <FormField id="ticket-close-reason" label="علت بسته‌شدن">
                <Input
                  defaultValue={
                    mode === 'create' ? '' : 'حل کامل درخواست نمایشی'
                  }
                  disabled={readonly}
                  id="ticket-close-reason"
                  readOnly={readonly}
                />
              </FormField>
              <Alert
                description="فقط برای Ticket حل‌شده یا بسته، با Permission مستقل، علت مستند، کنترل نسخه و سقف دفعات مجاز است؛ در Preview هیچ Mutation اجرا نمی‌شود."
                title="بازگشایی کنترل‌شده Ticket"
                tone="warning"
              />
            </div>
          )}
          <FormField
            {...(errors.details ? { error: errors.details } : {})}
            description="از ثبت نام، شماره تماس، مدرک یا هر PII واقعی خودداری شود."
            id="customer-affairs-details"
            label={
              kind === 'lead'
                ? 'نیاز سفر و Qualification'
                : 'شرح و پاسخ پیشنهادی'
            }
            required
          >
            <Textarea
              aria-invalid={Boolean(errors.details)}
              disabled={readonly}
              id="customer-affairs-details"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  details: event.target.value,
                }))
              }
              readOnly={readonly}
              value={draft.details}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="اولویت">
              <Select
                disabled={readonly}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    priority: value as Priority,
                  }))
                }
                value={draft.priority}
              >
                <SelectTrigger aria-label="اولویت">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              {...(errors.assignee ? { error: errors.assignee } : {})}
              id="customer-affairs-assignee"
              label="مسئول پیگیری"
              required
            >
              <Input
                disabled={readonly}
                id="customer-affairs-assignee"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    assignee: event.target.value,
                  }))
                }
                readOnly={readonly}
                value={draft.assignee}
              />
            </FormField>
          </div>
          <FormField id="customer-affairs-next-action" label="تاریخ اقدام بعدی">
            <Input
              disabled={readonly}
              id="customer-affairs-next-action"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  nextActionAt: event.target.value,
                }))
              }
              readOnly={readonly}
              type="datetime-local"
              value={draft.nextActionAt}
            />
          </FormField>
          {validated ? (
            <Alert
              description="Validation موفق بود؛ Submit عمداً هیچ داده‌ای ذخیره یا ارسال نکرد."
              title="فرم برای اتصال آینده آماده است"
            />
          ) : null}
          <div className="flex justify-end gap-2">
            <DrawerClose asChild>
              <Button type="button" variant="ghost">
                بستن
              </Button>
            </DrawerClose>
            {!readonly ? <Button type="submit">بررسی بدون ذخیره</Button> : null}
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

function Timeline() {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold">Timeline فعالیت‌ها</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            تماس، پیام، جلسه و یادداشت
          </p>
        </div>
        <MessageSquareText aria-hidden="true" className="size-5 text-primary" />
      </div>
      <ol className="mt-5 space-y-4 border-s border-border ps-5">
        {previewTimeline.map((activity) => (
          <li className="relative" key={activity.id}>
            <span className="absolute -start-[1.55rem] top-1.5 size-2 rounded-full bg-primary" />
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{activity.type}</Badge>
              {activity.internal ? (
                <Badge className="bg-slate-500/10 text-slate-700">داخلی</Badge>
              ) : null}
            </div>
            <p className="mt-2 text-sm font-semibold">{activity.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {activity.at} · {activity.actor}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Filters({
  onChange,
  query,
  statusOptions,
}: {
  onChange: (query: CustomerAffairsListQuery) => void;
  query: CustomerAffairsListQuery;
  statusOptions: readonly [string, string][];
}) {
  return (
    <FilterBar className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <FormField id="customer-affairs-search" label="جست‌وجو">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute end-3 top-3.5 size-4 text-muted-foreground"
          />
          <Input
            className="pe-10"
            id="customer-affairs-search"
            onChange={(event) =>
              onChange({ ...query, search: event.target.value, page: 1 })
            }
            placeholder="عنوان Lead یا Ticket"
            value={query.search}
          />
        </div>
      </FormField>
      <FormField label="وضعیت">
        <Select
          onValueChange={(value) =>
            onChange({ ...query, status: value, page: 1 })
          }
          value={query.status}
        >
          <SelectTrigger aria-label="فیلتر وضعیت">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            {statusOptions.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="اولویت">
        <Select
          onValueChange={(value) =>
            onChange({ ...query, priority: value, page: 1 })
          }
          value={query.priority}
        >
          <SelectTrigger aria-label="فیلتر اولویت">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه اولویت‌ها</SelectItem>
            {Object.entries(priorityLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="مرتب‌سازی">
        <Select
          onValueChange={(value) =>
            onChange({
              ...query,
              sortBy: value as CustomerAffairsListQuery['sortBy'],
            })
          }
          value={query.sortBy}
        >
          <SelectTrigger aria-label="مرتب‌سازی">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updatedAt">آخرین تغییر</SelectItem>
            <SelectItem value="nextActionAt">اقدام بعدی</SelectItem>
            <SelectItem value="priority">اولویت</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <Button
        aria-pressed={query.overdueOnly}
        className="mb-0.5"
        onClick={() =>
          onChange({ ...query, overdueOnly: !query.overdueOnly, page: 1 })
        }
        type="button"
        variant={query.overdueOnly ? 'primary' : 'outline'}
      >
        <AlertTriangle aria-hidden="true" className="size-4" />
        فقط عقب‌افتاده
      </Button>
    </FilterBar>
  );
}

function LeadCard({
  lead,
  onOpen,
}: {
  lead: PreviewLead;
  onOpen: (mode: FormMode) => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge>{leadStageLabels[lead.stage]}</Badge>
            <Badge
              className={
                lead.overdue ? 'bg-destructive/10 text-destructive' : ''
              }
            >
              {lead.overdue
                ? 'پیگیری عقب‌افتاده'
                : priorityLabels[lead.priority]}
            </Badge>
          </div>
          <h3 className="mt-3 font-bold">{lead.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {lead.source} · {lead.channel}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {lead.ageDays.toLocaleString('fa-IR')} روز
        </span>
      </div>
      <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">نیاز/مقصد</dt>
          <dd className="mt-1 font-medium">
            {lead.travelNeed} · {lead.destination}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">مسافر/بودجه</dt>
          <dd className="mt-1 font-medium">
            {lead.passengerCount.toLocaleString('fa-IR')} نفر ·{' '}
            {lead.budgetLabel}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Qualification</dt>
          <dd className="mt-1 font-medium">{lead.qualification}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">اقدام بعدی</dt>
          <dd className="mt-1 font-medium">{lead.nextActionAt}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">{lead.assignee}</span>
        <div className="flex gap-2">
          <Button
            onClick={() => onOpen('view')}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Eye aria-hidden="true" className="size-4" />
            مشاهده
          </Button>
          <Button
            onClick={() => onOpen('edit')}
            size="sm"
            type="button"
            variant="outline"
          >
            <FilePenLine aria-hidden="true" className="size-4" />
            ویرایش
          </Button>
        </div>
      </div>
    </Card>
  );
}

function LeadWorkspace({
  onOpen,
  state,
}: {
  onOpen: (mode: FormMode) => void;
  state: CustomerAffairsPreviewState;
}) {
  const [query, setQuery] = useState(() =>
    normalizeCustomerAffairsQuery({ pageSize: 2 }),
  );
  const [showHandoff, setShowHandoff] = useState(false);
  const handoffPreview = buildSalesHandoffPreview(
    previewLeads.find((lead) => lead.stage === 'QUALIFIED') ?? previewLeads[0]!,
  );
  const results = useMemo(
    () => filterPreviewRecords(previewLeads, query),
    [query],
  );
  const page = paginatePreview(results, query.page, query.pageSize);
  const stages = Object.entries(leadStageLabels) as [LeadStage, string][];
  if (state !== 'preview')
    return <StatePanel onRetry={() => undefined} state={state} />;
  return (
    <div className="space-y-5">
      <section aria-labelledby="lead-pipeline-title">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-bold" id="lead-pipeline-title">
              Pipeline پیش از فروش
            </h2>
            <p className="text-xs text-muted-foreground">
              جابجایی کارت‌ها در Phase A فعال نیست.
            </p>
          </div>
          <Badge>
            <KanbanSquare aria-hidden="true" className="me-1 size-3" />
            Preview
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {stages.map(([stage, label]) => {
            const stageLeads = previewLeads.filter(
              (lead) => lead.stage === stage,
            );
            return (
              <Card className="min-w-0 bg-muted/20 p-3" key={stage}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold">{label}</h3>
                  <Badge>{stageLeads.length.toLocaleString('fa-IR')}</Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {stageLeads.length ? (
                    stageLeads.map((lead) => (
                      <div
                        className="rounded-xl border border-border bg-surface p-3"
                        key={lead.id}
                      >
                        <p className="text-xs font-semibold">{lead.title}</p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {lead.nextActionAt}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="py-5 text-center text-xs text-muted-foreground">
                      بدون Lead
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>
      <Filters onChange={setQuery} query={query} statusOptions={stages} />
      {page.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {page.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <EmptyState
          description="Lead مطابق فیلتر پیدا نشد."
          title="فهرست Lead خالی است"
        />
      )}
      <div className="flex items-center justify-between gap-3">
        <Button
          disabled={query.page === 1}
          onClick={() => setQuery({ ...query, page: query.page - 1 })}
          size="sm"
          type="button"
          variant="outline"
        >
          صفحه قبل
        </Button>
        <PaginationShell
          currentPage={query.page}
          totalLabel={`${results.length.toLocaleString('fa-IR')} Lead نمایشی`}
        />
        <Button
          disabled={query.page * query.pageSize >= results.length}
          onClick={() => setQuery({ ...query, page: query.page + 1 })}
          size="sm"
          type="button"
          variant="outline"
        >
          صفحه بعد
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <Timeline />
        <Card className="p-5">
          <h3 className="font-bold">پیشنهاد تحویل به فروش</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            فقط CustomerReference و SalesRequestReference پیشنهادی ساخته می‌شود؛
            Customer، قرارداد یا رزرو خودکار ایجاد نمی‌شود.
          </p>
          <Button
            aria-expanded={showHandoff}
            className="mt-5"
            onClick={() => setShowHandoff((current) => !current)}
            type="button"
            variant="outline"
          >
            <ArrowUpLeft aria-hidden="true" className="size-4" />
            ساخت Handoff Contract پیشنهادی
          </Button>
          {showHandoff ? (
            <dl className="mt-4 grid gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt>Contract</dt>
                <dd dir="ltr">{handoffPreview.contractVersion}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Event</dt>
                <dd dir="ltr">{handoffPreview.eventType}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Lead</dt>
                <dd dir="ltr">{handoffPreview.leadId}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Passenger count</dt>
                <dd>{handoffPreview.passengerCount.toLocaleString('fa-IR')}</dd>
              </div>
              <div className="flex justify-between gap-3 font-bold text-amber-700">
                <dt>وضعیت</dt>
                <dd>ذخیره‌نشده · Mutation اجرا نشد</dd>
              </div>
            </dl>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

function TicketCard({
  onOpen,
  ticket,
}: {
  onOpen: (mode: FormMode) => void;
  ticket: PreviewTicket;
}) {
  const slaTone =
    ticket.slaState === 'BREACHED'
      ? 'bg-destructive/10 text-destructive'
      : ticket.slaState === 'AT_RISK'
        ? 'bg-amber-500/10 text-amber-700'
        : 'bg-emerald-500/10 text-emerald-700';
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge>{ticketStatusLabels[ticket.status]}</Badge>
            <Badge>{ticket.category}</Badge>
            <Badge className={slaTone}>{slaLabels[ticket.slaState]}</Badge>
          </div>
          <p className="mt-3 font-mono text-xs text-primary" dir="ltr">
            {ticket.trackingNumber}
          </p>
          <h3 className="mt-1 font-bold">{ticket.subject}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {ticket.customerReference} · {ticket.salesReference}
          </p>
        </div>
        {ticket.escalated ? (
          <Badge className="bg-destructive/10 text-destructive">
            Escalated
          </Badge>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Alert description={ticket.firstResponseLabel} title="اولین پاسخ" />
        <Alert
          description={ticket.resolutionDueLabel}
          title="موعد حل"
          tone={
            ticket.slaState === 'BREACHED'
              ? 'error'
              : ticket.slaState === 'AT_RISK'
                ? 'warning'
                : 'info'
          }
        />
      </div>
      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
        <div className="rounded-xl bg-muted/40 p-3">
          <p className="font-bold">یادداشت داخلی</p>
          <p className="mt-1 leading-6 text-muted-foreground">
            {ticket.internalNote}
          </p>
        </div>
        <div className="rounded-xl bg-primary/5 p-3">
          <p className="font-bold">پاسخ قابل ارسال</p>
          <p className="mt-1 leading-6 text-muted-foreground">
            {ticket.customerReply}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">
          {ticket.assignee} · رضایت: {ticket.satisfaction}
        </span>
        <div className="flex gap-2">
          <Button
            onClick={() => onOpen('view')}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Eye aria-hidden="true" className="size-4" />
            مشاهده
          </Button>
          <Button
            onClick={() => onOpen('edit')}
            size="sm"
            type="button"
            variant="outline"
          >
            <FilePenLine aria-hidden="true" className="size-4" />
            ویرایش
          </Button>
        </div>
      </div>
    </Card>
  );
}

function TicketWorkspace({
  onOpen,
  state,
}: {
  onOpen: (mode: FormMode) => void;
  state: CustomerAffairsPreviewState;
}) {
  const [query, setQuery] = useState(() =>
    normalizeCustomerAffairsQuery({ pageSize: 2 }),
  );
  const results = useMemo(
    () => filterPreviewRecords(previewTickets, query),
    [query],
  );
  const page = paginatePreview(results, query.page, query.pageSize);
  const statuses = Object.entries(ticketStatusLabels);
  if (state !== 'preview')
    return <StatePanel onRetry={() => undefined} state={state} />;
  return (
    <div className="space-y-5">
      <Filters onChange={setQuery} query={query} statusOptions={statuses} />
      {page.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {page.map((ticket) => (
            <TicketCard key={ticket.id} onOpen={onOpen} ticket={ticket} />
          ))}
        </div>
      ) : (
        <EmptyState
          description="Ticket مطابق فیلتر پیدا نشد."
          title="فهرست Ticket خالی است"
        />
      )}
      <div className="flex items-center justify-between gap-3">
        <Button
          disabled={query.page === 1}
          onClick={() => setQuery({ ...query, page: query.page - 1 })}
          size="sm"
          type="button"
          variant="outline"
        >
          صفحه قبل
        </Button>
        <PaginationShell
          currentPage={query.page}
          totalLabel={`${results.length.toLocaleString('fa-IR')} Ticket نمایشی`}
        />
        <Button
          disabled={query.page * query.pageSize >= results.length}
          onClick={() => setQuery({ ...query, page: query.page + 1 })}
          size="sm"
          type="button"
          variant="outline"
        >
          صفحه بعد
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard
          icon={Clock3}
          label="میانگین پاسخ اولیه Preview"
          value="۲۸ دقیقه"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="نقض SLA"
          tone="danger"
          value="۱"
        />
        <SummaryCard icon={CheckCircle2} label="رضایت ثبت‌شده" value="۴ از ۵" />
      </div>
      <Timeline />
    </div>
  );
}

export function CustomerAffairsWorkspace() {
  const [state, setState] = useState<CustomerAffairsPreviewState>('preview');
  const [tab, setTab] = useState<WorkspaceTab>('presales');
  const [form, setForm] = useState<{ kind: FormKind; mode: FormMode } | null>(
    null,
  );
  const overdueCount =
    previewLeads.filter((lead) => lead.overdue).length +
    previewTickets.filter((ticket) => ticket.overdue).length;
  const openTickets = previewTickets.filter(
    (ticket) => ticket.status !== 'RESOLVED',
  ).length;
  const newLeads = previewLeads.filter((lead) => lead.stage === 'NEW').length;
  const todayFollowUps = previewLeads.filter((lead) =>
    lead.nextActionAt.includes('امروز'),
  ).length;
  const slaAtRisk = previewTickets.filter(
    (ticket) => ticket.slaState === 'AT_RISK',
  ).length;
  return (
    <main className="space-y-6" dir="rtl">
      <PageHeader
        actions={
          <>
            <Button
              onClick={() =>
                setForm({
                  kind: tab === 'presales' ? 'lead' : 'ticket',
                  mode: 'create',
                })
              }
            >
              <Plus aria-hidden="true" className="size-4" />
              {tab === 'presales' ? 'Lead نمایشی جدید' : 'Ticket نمایشی جدید'}
            </Button>
          </>
        }
        description="Workspace یکپارچه Lead، Follow-up و پشتیبانی پس از فروش؛ تمام داده‌ها و عملیات این صفحه Preview هستند."
        eyebrow="CUSTOMER-AFFAIRS-001 · Phase A"
        title="امور مشتریان، سرنخ‌ها و پشتیبانی"
      />
      <Alert
        description={CUSTOMER_AFFAIRS_PREVIEW_NOTICE}
        title="محیط طراحی بدون Persistence"
        tone="warning"
      >
        <div className="mt-3">
          <PreviewStateSwitcher onChange={setState} state={state} />
        </div>
      </Alert>
      <section
        aria-label="خلاصه Customer Affairs"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard
          icon={Users}
          label="Leadهای جدید"
          value={newLeads.toLocaleString('fa-IR')}
        />
        <SummaryCard
          icon={Sparkles}
          label="پیگیری‌های امروز"
          value={todayFollowUps.toLocaleString('fa-IR')}
        />
        <SummaryCard
          icon={Headphones}
          label="Ticketهای باز"
          value={openTickets.toLocaleString('fa-IR')}
        />
        <SummaryCard
          icon={CalendarClock}
          label="SLAهای نزدیک نقض"
          tone="danger"
          value={slaAtRisk.toLocaleString('fa-IR')}
        />
      </section>
      {overdueCount ? (
        <Alert
          description="موارد عقب‌افتاده باید در آینده Task/Notification بسازند؛ در این فاز فقط هشدار UI نمایش داده می‌شود."
          title="هشدار پیگیری و SLA"
          tone="error"
        />
      ) : null}
      <Tabs
        onValueChange={(value) => setTab(value as WorkspaceTab)}
        value={tab}
      >
        <TabsList className="grid w-full grid-cols-2 sm:w-auto">
          <TabsTrigger value="presales">
            <UserSearch aria-hidden="true" className="me-2 size-4" />
            قبل از فروش
          </TabsTrigger>
          <TabsTrigger value="support">
            <TicketCheck aria-hidden="true" className="me-2 size-4" />
            بعد از فروش
          </TabsTrigger>
        </TabsList>
        <TabsContent className="mt-5" value="presales">
          <LeadWorkspace
            onOpen={(mode) => setForm({ kind: 'lead', mode })}
            state={state}
          />
        </TabsContent>
        <TabsContent className="mt-5" value="support">
          <TicketWorkspace
            onOpen={(mode) => setForm({ kind: 'ticket', mode })}
            state={state}
          />
        </TabsContent>
      </Tabs>
      {form ? (
        <PreviewForm
          kind={form.kind}
          mode={form.mode}
          onClose={() => setForm(null)}
        />
      ) : null}
    </main>
  );
}
