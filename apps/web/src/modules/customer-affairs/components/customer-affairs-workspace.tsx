'use client';

import { AffairsSelect } from './affairs-select';
import type { CustomerSummary } from '@rubi/contracts';
import type {
  CustomerAffairsDashboard,
  CustomerAffairsLeadInput,
  CustomerAffairsLeadView,
  CustomerAffairsTicketInput,
  CustomerAffairsTicketView,
  CustomerAffairsTimelineInput,
} from '@rubi/contracts';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Headphones,
  Plus,
  RefreshCw,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
} from '@/components/ui/surfaces';
import {
  customerAffairsApi,
  CustomerAffairsApiError,
} from '../api/customer-affairs-client';
import { CustomerPicker } from './customer-picker';
import { CustomerAffairsFormDialog } from './customer-affairs-form-dialog';
import { AssigneePicker } from './assignee-picker';
import { RecordOperations, ticketCategories } from './record-operations';
import { SalesHandoffResponse } from './sales-handoff-response';
import { LeadCustomerConversion } from './lead-customer-conversion';
import { TicketSms } from './ticket-sms';
import s from './customer-affairs-rubi.module.css';

type Tab = 'leads' | 'tickets';
type LoadState = 'loading' | 'ready' | 'empty' | 'error' | 'forbidden';
export type Detail = (CustomerAffairsLeadView | CustomerAffairsTicketView) & {
  timeline?: Array<{
    id?: string;
    type: string;
    summary: string;
    occurredAt?: string;
    customerVisible?: boolean;
    deliveryStatus?: string | null;
  }>;
  referrals?: Array<Record<string, unknown>>;
  correctiveActions?: Array<Record<string, unknown>>;
  handoffs?: Array<Record<string, unknown>>;
};

const localDateValue = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
const isoLocal = () => localDateValue(new Date(Date.now() + 60 * 60_000));
export const stageLabel: Record<string, string> = {
  NEW: 'جدید',
  CONTACTED: 'تماس گرفته شد',
  QUALIFYING: 'در حال ارزیابی',
  NURTURE: 'پیگیری بلندمدت',
  QUALIFIED: 'واجد شرایط',
  HANDOFF_PROPOSED: 'منتظر فروش',
  HANDED_OFF: 'تحویل فروش',
  LOST: 'از دست‌رفته',
};
export const statusLabel: Record<string, string> = {
  NEW: 'جدید',
  TRIAGED: 'بررسی اولیه',
  IN_PROGRESS: 'در حال رسیدگی',
  WAITING_CUSTOMER: 'منتظر مشتری',
  WAITING_EXTERNAL: 'منتظر واحد دیگر',
  RESOLVED: 'حل‌شده',
  CLOSED: 'بسته',
  REOPENED: 'بازشده',
  CANCELLED: 'لغوشده',
};
export const priorityLabel: Record<string, string> = {
  LOW: 'کم',
  NORMAL: 'عادی',
  HIGH: 'زیاد',
  URGENT: 'فوری',
  CRITICAL: 'بحرانی',
};

function Summary({
  label,
  value,
  tone = 'normal',
}: {
  label: string;
  value: number;
  tone?: 'normal' | 'warning' | 'danger';
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p
        className={
          tone === 'danger'
            ? 'mt-2 text-2xl font-black text-destructive'
            : tone === 'warning'
              ? 'mt-2 text-2xl font-black text-amber-700'
              : 'mt-2 text-2xl font-black text-foreground'
        }
      >
        {value.toLocaleString('fa-IR')}
      </p>
    </Card>
  );
}

export function LeadForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (row: CustomerAffairsLeadView) => void;
}) {
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const passengers = Number(data.get('passengerCount'));
    const input: CustomerAffairsLeadInput = {
      title: String(data.get('title')),
      sourceReference: String(data.get('sourceReference')),
      inboundChannel: String(
        data.get('channel'),
      ) as CustomerAffairsLeadInput['inboundChannel'],
      contactOccurredAt: new Date().toISOString(),
      travelNeed: String(data.get('travelNeed')),
      destinationReference: String(data.get('destination')) || null,
      datePrecision: data.get('travelStart') ? 'EXACT' : 'UNKNOWN',
      travelStart: data.get('travelStart')
        ? new Date(String(data.get('travelStart'))).toISOString()
        : null,
      travelEnd: data.get('travelEnd')
        ? new Date(String(data.get('travelEnd'))).toISOString()
        : null,
      originReference: String(data.get('origin')) || null,
      passengerCount: passengers,
      passengerComposition: { adults: passengers, children: 0, infants: 0 },
      requestedServices: data.getAll('services').map(String),
      budget: data.get('budgetAmount')
        ? {
            maximum: String(data.get('budgetAmount')),
            currencyCode: String(data.get('currency')),
            basis: 'TOTAL',
          }
        : { unknownReason: 'در تماس اولیه اعلام نشد' },
      specialPreferences: String(data.get('specialPreferences') || '') || null,
      assigneeUserId: String(data.get('assigneeUserId') || '') || null,
      customerId: customer?.id ?? null,
      priority: String(
        data.get('priority'),
      ) as CustomerAffairsLeadInput['priority'],
      queueCode: String(data.get('queueCode')),
      nextAction: String(data.get('nextAction')),
      nextActionAt: new Date(String(data.get('nextActionAt'))).toISOString(),
    };
    try {
      const response = await customerAffairsApi.createLead(input);
      onCreated(response.data);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'ثبت درخواست انجام نشد.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <CustomerAffairsFormDialog
      title="درخواست سفر جدید"
      description="نیاز مشتری را ثبت کنید و برای ادامهٔ پیگیری موعد تعیین کنید."
      busy={busy}
      onClose={onCancel}
    >
      <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={submit}>
        <FormField label="عنوان">
          <Input name="title" required minLength={3} />
        </FormField>
        <FormField label="منبع سرنخ / نام کمپین یا معرف">
          <Input
            name="sourceReference"
            required
            maxLength={160}
            placeholder="مثلاً تماس مستقیم، معرفی مشتری یا نام کمپین"
          />
        </FormField>
        <FormField label="توضیحات خاص">
          <Textarea name="specialPreferences" maxLength={1000} />
        </FormField>
        <FormField label="مسئول پیگیری">
          <AssigneePicker name="assigneeUserId" />
        </FormField>
        <FormField label="کانال">
          <AffairsSelect
            className="h-11 w-full rounded-xl border border-input bg-surface px-3"
            name="channel"
            defaultValue="PHONE"
          >
            <option value="PHONE">تلفن</option>
            <option value="WEBSITE">وب‌سایت</option>
            <option value="WALK_IN">حضوری</option>
            <option value="REFERRAL">معرفی</option>
            <option value="SOCIAL">شبکه اجتماعی</option>
            <option value="OTHER">سایر</option>
          </AffairsSelect>
        </FormField>
        <div className="lg:col-span-2">
          <CustomerPicker onSelect={setCustomer} selected={customer} />
        </div>
        <FormField label="نیاز سفر">
          <Textarea name="travelNeed" required minLength={3} />
        </FormField>
        <div className="grid gap-4">
          <FormField label="مقصد (اختیاری)">
            <Input name="destination" />
          </FormField>
          <FormField label="تعداد مسافر">
            <Input
              name="passengerCount"
              type="number"
              min={1}
              max={100}
              placeholder="تعداد اعلام‌شده توسط مشتری"
              required
            />
          </FormField>
        </div>
        <FormField label="اولویت">
          <AffairsSelect
            className="h-11 w-full rounded-xl border border-input bg-surface px-3"
            name="priority"
            defaultValue="NORMAL"
          >
            <option value="LOW">کم</option>
            <option value="NORMAL">عادی</option>
            <option value="HIGH">زیاد</option>
            <option value="URGENT">فوری</option>
          </AffairsSelect>
        </FormField>
        <FormField label="صف مسئول">
          <AffairsSelect
            className={s.select}
            name="queueCode"
            defaultValue="customer-affairs-front-office"
            required
          >
            <option value="customer-affairs-front-office">
              پذیرش امور مشتریان
            </option>
          </AffairsSelect>
        </FormField>
        <FormField label="مبدأ (اختیاری)">
          <Input name="origin" />
        </FormField>
        <FormField label="شروع سفر (اختیاری)">
          <DatePicker name="travelStart" />
        </FormField>
        <FormField label="پایان سفر (اختیاری)">
          <DatePicker name="travelEnd" />
        </FormField>
        <fieldset className="lg:col-span-2 rounded-xl border border-border p-4">
          <legend className="px-2 text-sm font-bold">خدمات موردنیاز</legend>
          <div className="flex flex-wrap gap-5">
            {[
              ['FLIGHT', 'پرواز'],
              ['HOTEL', 'هتل'],
              ['TOUR', 'تور'],
              ['INSURANCE', 'بیمه'],
              ['TRANSFER', 'ترانسفر'],
              ['VISA', 'ویزا'],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="services" value={value} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <FormField label="سقف بودجه کل سفر (اختیاری)">
          <Input name="budgetAmount" type="number" min="0.01" step="0.01" />
        </FormField>
        <FormField label="ارز بودجه">
          <AffairsSelect className={s.select} name="currency">
            <option value="IRR">ریال</option>
            <option value="USD">دلار آمریکا</option>
            <option value="EUR">یورو</option>
            <option value="AED">درهم امارات</option>
          </AffairsSelect>
        </FormField>
        <FormField label="اقدام بعدی">
          <Input
            name="nextAction"
            defaultValue="تماس و تکمیل نیاز سفر"
            required
          />
        </FormField>
        <FormField label="موعد اقدام">
          <DatePicker
            name="nextActionAt"
            includeTime
            defaultValue={isoLocal()}
            required
          />
        </FormField>
        {error ? (
          <Alert
            className="lg:col-span-2"
            title="ثبت ناموفق"
            description={error}
            tone="error"
          />
        ) : null}
        <div className="flex gap-2 lg:col-span-2">
          <Button disabled={busy} type="submit">
            {busy ? 'در حال ثبت…' : 'ثبت درخواست'}
          </Button>
          <Button
            disabled={busy}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            انصراف
          </Button>
        </div>
      </form>
    </CustomerAffairsFormDialog>
  );
}

export function TicketForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (row: CustomerAffairsTicketView) => void;
}) {
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const input: CustomerAffairsTicketInput = {
      subject: String(data.get('subject')),
      description: String(data.get('description')),
      channel: String(
        data.get('channel'),
      ) as CustomerAffairsTicketInput['channel'],
      contactOccurredAt: new Date().toISOString(),
      category: String(data.get('category')),
      impact: String(
        data.get('impact'),
      ) as CustomerAffairsTicketInput['impact'],
      urgency: String(
        data.get('urgency'),
      ) as CustomerAffairsTicketInput['urgency'],
      priority: String(
        data.get('priority'),
      ) as CustomerAffairsTicketInput['priority'],
      customerId: customer?.id ?? null,
      references: [],
      customerOwnerUserId:
        String(data.get('customerOwnerUserId') || '') || null,
      nextAction: String(data.get('nextAction')),
      nextActionAt: new Date(String(data.get('nextActionAt'))).toISOString(),
    };
    try {
      const response = await customerAffairsApi.createTicket(input);
      onCreated(response.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ثبت تیکت انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <CustomerAffairsFormDialog
      title="ثبت تیکت پشتیبانی"
      description="تیکت بدون قرارداد هم قابل ثبت است؛ مالک پاسخ به مشتری تغییر نمی‌کند."
      busy={busy}
      onClose={onCancel}
    >
      <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={submit}>
        <FormField label="موضوع">
          <Input name="subject" required minLength={3} />
        </FormField>
        <FormField label="مسئول پاسخ‌گویی (در صورت انتخاب‌نکردن، ثبت‌کننده)">
          <AssigneePicker name="customerOwnerUserId" />
        </FormField>
        <FormField label="کانال">
          <AffairsSelect
            className="h-11 w-full rounded-xl border border-input bg-surface px-3"
            name="channel"
            defaultValue="PHONE"
          >
            <option value="PHONE">تلفن</option>
            <option value="EMAIL">ایمیل</option>
            <option value="CHAT">گفتگو</option>
            <option value="WEBSITE">وب‌سایت</option>
            <option value="WALK_IN">حضوری</option>
            <option value="OTHER">سایر</option>
          </AffairsSelect>
        </FormField>
        <div className="lg:col-span-2">
          <CustomerPicker onSelect={setCustomer} selected={customer} />
        </div>
        <FormField label="شرح">
          <Textarea name="description" required minLength={3} />
        </FormField>
        <div className="grid gap-4">
          <FormField label="دسته">
            <AffairsSelect
              className={s.select}
              name="category"
              defaultValue="QUESTION"
              required
            >
              {ticketCategories.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </AffairsSelect>
          </FormField>
          <FormField label="اولویت">
            <AffairsSelect
              className="h-11 w-full rounded-xl border border-input bg-surface px-3"
              name="priority"
              defaultValue="NORMAL"
            >
              <option value="LOW">کم</option>
              <option value="NORMAL">عادی</option>
              <option value="HIGH">زیاد</option>
              <option value="URGENT">فوری</option>
              <option value="CRITICAL">بحرانی</option>
            </AffairsSelect>
          </FormField>
        </div>
        <FormField label="اثر">
          <AffairsSelect
            className="h-11 w-full rounded-xl border border-input bg-surface px-3"
            name="impact"
            defaultValue="NORMAL"
          >
            <option value="LOW">کم</option>
            <option value="NORMAL">عادی</option>
            <option value="HIGH">زیاد</option>
          </AffairsSelect>
        </FormField>
        <FormField label="فوریت">
          <AffairsSelect
            className="h-11 w-full rounded-xl border border-input bg-surface px-3"
            name="urgency"
            defaultValue="NORMAL"
          >
            <option value="LOW">کم</option>
            <option value="NORMAL">عادی</option>
            <option value="HIGH">زیاد</option>
          </AffairsSelect>
        </FormField>
        <FormField label="اقدام بعدی">
          <Input name="nextAction" defaultValue="بررسی و پاسخ اولیه" required />
        </FormField>
        <FormField label="موعد اقدام">
          <DatePicker
            name="nextActionAt"
            includeTime
            defaultValue={isoLocal()}
            required
          />
        </FormField>
        {error ? (
          <Alert
            className="lg:col-span-2"
            title="ثبت ناموفق"
            description={error}
            tone="error"
          />
        ) : null}
        <div className="flex gap-2 lg:col-span-2">
          <Button disabled={busy} type="submit">
            {busy ? 'در حال ثبت…' : 'ثبت تیکت'}
          </Button>
          <Button
            disabled={busy}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            انصراف
          </Button>
        </div>
      </form>
    </CustomerAffairsFormDialog>
  );
}

export function DetailPanel({
  detail,
  onBack,
  onReload,
  tab,
}: {
  detail: Detail;
  onBack: () => void;
  onReload: () => Promise<void>;
  tab: Tab;
}) {
  const [message, setMessage] = useState('');
  const [activityOpen, setActivityOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [referralOpen, setReferralOpen] = useState(false);
  const [surveyUrl, setSurveyUrl] = useState('');
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [activityType, setActivityType] =
    useState<CustomerAffairsTimelineInput['type']>('NOTE');
  const [pendingAction, setPendingAction] = useState<
    'resolve' | 'close' | 'reopen' | 'escalate' | null
  >(null);
  const [operationError, setOperationError] = useState(false);
  const stage = 'stage' in detail ? detail.stage : detail.status;
  async function run(operation: () => Promise<unknown>, success: string) {
    setBusy(true);
    setNotice('');
    setOperationError(false);
    try {
      await operation();
      setNotice(success);
      await onReload();
      return true;
    } catch (cause) {
      setOperationError(true);
      setNotice(cause instanceof Error ? cause.message : 'عملیات انجام نشد.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function timeline(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    const success = await run(
      () =>
        tab === 'leads'
          ? customerAffairsApi.addLeadTimeline(detail.id, {
              type: activityType,
              summary: message,
              customerVisible: false,
            })
          : customerAffairsApi.addTicketTimeline(detail.id, {
              type: activityType,
              summary: message,
              customerVisible: false,
            }),
      'ارتباط در سابقه پرونده ثبت شد.',
    );
    if (success) {
      setMessage('');
      setActivityOpen(false);
    }
  }
  async function refer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const success = await run(
      () =>
        customerAffairsApi.refer(detail.id, {
          destinationModule: String(data.get('destinationModule')),
          destinationUnit: String(data.get('destinationUnit')),
          assignedUserId: String(data.get('assignedUserId') || '') || null,
          title: String(data.get('title')),
          description: String(data.get('description')),
          dueAt: new Date(String(data.get('dueAt'))).toISOString(),
        }),
      'ارجاع در کارتابل مقصد ثبت شد.',
    );
    if (success) setReferralOpen(false);
  }
  async function createSurveyInvitation() {
    setBusy(true);
    setNotice('');
    try {
      const response = await customerAffairsApi.createSatisfactionInvitation(
        detail.id,
      );
      setSurveyUrl(
        `${window.location.origin}/feedback/customer-affairs/${response.data.token}`,
      );
      setNotice('پیوند امن رضایت‌سنجی تا هفت روز معتبر است.');
    } catch (cause) {
      setNotice(
        cause instanceof Error ? cause.message : 'ساخت دعوت‌نامه انجام نشد.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <Button onClick={onBack} variant="ghost">
        <ArrowLeft className="size-4" /> بازگشت به فهرست
      </Button>
      <Card className={s.detail}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {detail.trackingNumber}
            </p>
            <h2 className="mt-1 text-xl font-black">
              {'title' in detail ? detail.title : detail.subject}
            </h2>
          </div>
          <div className="flex gap-2">
            <Badge>{stageLabel[stage] ?? statusLabel[stage] ?? stage}</Badge>
            <Badge>{priorityLabel[detail.priority] ?? detail.priority}</Badge>
          </div>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7">
          {'travelNeed' in detail ? detail.travelNeed : detail.description}
        </p>
        <dl className={s.recordMeta}>
          <div>
            <dt className="text-muted-foreground">اقدام بعدی</dt>
            <dd className="font-semibold">{detail.nextAction}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">موعد</dt>
            <dd>{new Date(detail.nextActionAt).toLocaleString('fa-IR')}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">مشتری</dt>
            <dd>{detail.customerId ? 'متصل' : 'نامشخص'}</dd>
          </div>
        </dl>
        <Button
          variant="outline"
          onClick={() => setFollowupOpen((value) => !value)}
        >
          تنظیم پیگیری بعدی
        </Button>
        {followupOpen && (
          <CustomerAffairsFormDialog
            title="تنظیم پیگیری بعدی"
            busy={busy}
            onClose={() => setFollowupOpen(false)}
          >
            {operationError && notice && (
              <Alert
                title="عملیات انجام نشد"
                description={notice}
                tone="error"
              />
            )}
            <form
              className={s.workflowForm}
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const success = await run(
                  () =>
                    customerAffairsApi.updateFollowup(
                      detail,
                      String(data.get('nextAction')),
                      new Date(String(data.get('nextActionAt'))).toISOString(),
                    ),
                  'پیگیری بعدی ذخیره شد.',
                );
                if (success) setFollowupOpen(false);
              }}
            >
              <FormField label="اقدام بعدی">
                <Input
                  name="nextAction"
                  required
                  minLength={3}
                  defaultValue={detail.nextAction}
                />
              </FormField>
              <FormField label="موعد پیگیری">
                <DatePicker
                  name="nextActionAt"
                  includeTime
                  required
                  defaultValue={localDateValue(new Date(detail.nextActionAt))}
                />
              </FormField>
              <div className={s.actions}>
                <Button disabled={busy} type="submit">
                  ذخیره پیگیری
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFollowupOpen(false)}
                >
                  انصراف
                </Button>
              </div>
            </form>
          </CustomerAffairsFormDialog>
        )}
        {tab === 'leads' ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              disabled={busy || stage !== 'QUALIFIED'}
              onClick={() =>
                run(
                  () =>
                    customerAffairsApi.proposeHandoff(
                      detail.id,
                      detail.version,
                    ),
                  'بسته نسخه‌دار برای فروش ارسال شد.',
                )
              }
            >
              <Send className="size-4" /> ارسال به فروش
            </Button>
            <Button
              disabled={
                busy || !['NEW', 'CONTACTED', 'QUALIFYING'].includes(stage)
              }
              onClick={() => setAssessmentOpen((value) => !value)}
              variant="outline"
            >
              <CheckCircle2 className="size-4" /> ارزیابی آمادگی فروش
            </Button>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap gap-2">
            {(
              [
                { status: 'TRIAGED', label: 'بررسی اولیه', from: ['NEW'] },
                {
                  status: 'IN_PROGRESS',
                  label: 'شروع رسیدگی',
                  from: [
                    'TRIAGED',
                    'REOPENED',
                    'WAITING_CUSTOMER',
                    'WAITING_EXTERNAL',
                  ],
                },
                {
                  status: 'WAITING_CUSTOMER',
                  label: 'انتظار پاسخ مشتری',
                  from: ['IN_PROGRESS'],
                },
                {
                  status: 'WAITING_EXTERNAL',
                  label: 'انتظار واحد تخصصی',
                  from: ['IN_PROGRESS'],
                },
              ] as const
            )
              .filter((item) =>
                (item.from as readonly string[]).includes(stage),
              )
              .map((item) => (
                <Button
                  key={item.status}
                  disabled={busy}
                  variant="outline"
                  onClick={() =>
                    run(
                      () =>
                        customerAffairsApi.transitionTicket(
                          detail.id,
                          item.status,
                          detail.version,
                          item.label,
                        ),
                      'وضعیت رسیدگی به‌روز شد.',
                    )
                  }
                >
                  {item.label}
                </Button>
              ))}
            {[
              'IN_PROGRESS',
              'WAITING_CUSTOMER',
              'WAITING_EXTERNAL',
              'REOPENED',
            ].includes(stage) && (
              <Button
                disabled={busy}
                onClick={() => setPendingAction('resolve')}
              >
                ثبت نتیجه و حل تیکت
              </Button>
            )}
            {stage === 'RESOLVED' && (
              <Button disabled={busy} onClick={() => setPendingAction('close')}>
                بستن پرونده
              </Button>
            )}
            {['RESOLVED', 'CLOSED', 'CANCELLED'].includes(stage) && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setPendingAction('reopen')}
              >
                بازگشایی پرونده
              </Button>
            )}
            {!['RESOLVED', 'CLOSED', 'CANCELLED'].includes(stage) && (
              <>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setReferralOpen((value) => !value)}
                >
                  ارجاع داخلی
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setPendingAction('escalate')}
                >
                  <AlertTriangle className="size-4" />
                  ارجاع به سرپرست
                </Button>
              </>
            )}
            {['RESOLVED', 'CLOSED'].includes(stage) && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={createSurveyInvitation}
              >
                دعوت رضایت‌سنجی
              </Button>
            )}
          </div>
        )}
        {assessmentOpen && tab === 'leads' && (
          <CustomerAffairsFormDialog
            title="ارزیابی آمادگی فروش"
            busy={busy}
            onClose={() => setAssessmentOpen(false)}
          >
            {operationError && notice && (
              <Alert
                title="عملیات انجام نشد"
                description={notice}
                tone="error"
              />
            )}
            <form
              className={s.workflowForm}
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const success = await run(
                  () =>
                    customerAffairsApi.qualify(detail.id, detail.version, {
                      travelNeedConfirmed: data.has('travelNeedConfirmed'),
                      destinationKnown: data.has('destinationKnown'),
                      timingKnown: data.has('timingKnown'),
                      budgetDiscussed: data.has('budgetDiscussed'),
                      decisionMakerReachable: data.has(
                        'decisionMakerReachable',
                      ),
                      contactable: data.has('contactable'),
                      ...(String(data.get('conversionProbability') || '').trim()
                        ? {
                            conversionProbability: Number(
                              data.get('conversionProbability'),
                            ),
                          }
                        : {}),
                    }),
                  'نتیجه ارزیابی ثبت شد.',
                );
                if (success) setAssessmentOpen(false);
              }}
            >
              <h3>آمادگی تحویل به فروش</h3>
              <FormField
                id="lead-conversion-probability"
                label="احتمال تبدیل به فروش (درصد)"
                description="برآورد کارشناس از صفر تا صد؛ مستقل از امتیاز آمادگی فروش است."
              >
                <Input
                  id="lead-conversion-probability"
                  name="conversionProbability"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  defaultValue={
                    'stage' in detail &&
                    typeof detail.qualification?.conversionProbability ===
                      'number'
                      ? detail.qualification.conversionProbability
                      : ''
                  }
                />
              </FormField>
              <p className={s.muted}>
                فقط مواردی را تأیید کنید که در گفتگو با مشتری بررسی شده‌اند.
              </p>
              {[
                ['travelNeedConfirmed', 'نیاز سفر مشخص و تأیید شده است'],
                ['destinationKnown', 'مقصد یا گزینه‌های پذیرفتنی مشخص است'],
                ['timingKnown', 'زمان سفر یا انعطاف آن مشخص است'],
                ['budgetDiscussed', 'درباره بودجه گفتگو شده است'],
                ['decisionMakerReachable', 'با تصمیم‌گیرنده ارتباط داریم'],
                ['contactable', 'راه تماس مشتری معتبر است'],
              ].map(([key, label]) => (
                <label key={key}>
                  <input type="checkbox" name={key} />
                  {label}
                </label>
              ))}
              <div className={s.actions}>
                <Button disabled={busy} type="submit">
                  ثبت ارزیابی
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAssessmentOpen(false)}
                >
                  انصراف
                </Button>
              </div>
            </form>
          </CustomerAffairsFormDialog>
        )}
        {pendingAction && (
          <CustomerAffairsFormDialog
            title={
              {
                resolve: 'ثبت حل تیکت',
                close: 'بستن پرونده',
                reopen: 'بازگشایی پرونده',
                escalate: 'ارجاع به سرپرست',
              }[pendingAction]
            }
            busy={busy}
            onClose={() => setPendingAction(null)}
          >
            {operationError && notice && (
              <Alert
                title="عملیات انجام نشد"
                description={notice}
                tone="error"
              />
            )}
            <form
              className={s.workflowForm}
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const reason = String(data.get('reason'));
                const success = await run(
                  () =>
                    customerAffairsApi.action(detail.id, pendingAction, {
                      expectedVersion: detail.version,
                      reason,
                      resolutionOutcome: String(data.get('result') || ''),
                      ...(pendingAction === 'close'
                        ? { closeReason: reason }
                        : {}),
                    }),
                  'نتیجه رسیدگی ثبت شد.',
                );
                if (success) setPendingAction(null);
              }}
            >
              <h3>
                {
                  {
                    resolve: 'ثبت حل تیکت',
                    close: 'بستن پرونده',
                    reopen: 'بازگشایی پرونده',
                    escalate: 'ارجاع به سرپرست',
                  }[pendingAction]
                }
              </h3>
              <FormField label="دلیل اقدام">
                <Textarea
                  name="reason"
                  required
                  minLength={3}
                  maxLength={500}
                />
              </FormField>
              {(pendingAction === 'resolve' || pendingAction === 'close') && (
                <FormField label="نتیجه رسیدگی و نحوه اطلاع‌رسانی به مشتری">
                  <Textarea
                    name="result"
                    required
                    minLength={3}
                    maxLength={1000}
                    defaultValue={
                      'resolutionOutcome' in detail
                        ? detail.resolutionOutcome || ''
                        : ''
                    }
                  />
                </FormField>
              )}
              <div className={s.actions}>
                <Button disabled={busy} type="submit">
                  ثبت نتیجه
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPendingAction(null)}
                >
                  انصراف
                </Button>
              </div>
            </form>
          </CustomerAffairsFormDialog>
        )}
        {surveyUrl ? (
          <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-sm font-bold">پیوند مخصوص مشتری</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input aria-label="پیوند رضایت‌سنجی" readOnly value={surveyUrl} />
              <Button
                onClick={() => void navigator.clipboard.writeText(surveyUrl)}
                type="button"
                variant="outline"
              >
                کپی پیوند
              </Button>
            </div>
          </div>
        ) : null}
        {notice ? (
          <Alert
            className="mt-4"
            title="نتیجه عملیات"
            description={notice}
            tone={operationError ? 'error' : 'info'}
          />
        ) : null}
        {tab === 'tickets' && referralOpen ? (
          <CustomerAffairsFormDialog
            title="ارجاع داخلی"
            busy={busy}
            onClose={() => setReferralOpen(false)}
          >
            {operationError && notice && (
              <Alert
                title="عملیات انجام نشد"
                description={notice}
                tone="error"
              />
            )}
            <form
              className="mt-5 grid gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2"
              onSubmit={refer}
            >
              <FormField label="ماژول مقصد">
                <AffairsSelect
                  name="destinationModule"
                  required
                  className={s.select}
                >
                  <option value="reservations">رزرواسیون و عملیات سفر</option>
                  <option value="sales">فروش و قراردادها</option>
                  <option value="finance">مالی</option>
                  <option value="customers">مشتریان و مسافران</option>
                  <option value="documents">اسناد</option>
                </AffairsSelect>
              </FormField>
              <FormField label="واحد مقصد">
                <Input
                  name="destinationUnit"
                  required
                  placeholder="نام واحد مسئول رسیدگی"
                />
              </FormField>
              <FormField label="کارشناس گیرنده">
                <AssigneePicker
                  name="assignedUserId"
                  branchId={detail.branchId}
                />
              </FormField>
              <FormField label="عنوان کار">
                <Input name="title" required minLength={3} />
              </FormField>
              <FormField label="موعد">
                <DatePicker
                  name="dueAt"
                  includeTime
                  defaultValue={isoLocal()}
                  required
                />
              </FormField>
              <div className="sm:col-span-2">
                <FormField label="شرح اقدام">
                  <Textarea name="description" required minLength={3} />
                </FormField>
              </div>
              <Button className="sm:col-span-2" disabled={busy} type="submit">
                ثبت ارجاع
              </Button>
            </form>
          </CustomerAffairsFormDialog>
        ) : null}
      </Card>
      {detail.handoffs?.length || detail.referrals?.length ? (
        <Card className={s.detail}>
          <h3>{tab === 'leads' ? 'وضعیت تحویل به فروش' : 'ارجاع‌های مرتبط'}</h3>
          {(tab === 'leads' ? detail.handoffs : detail.referrals)?.map(
            (item, index) => (
              <div
                className="mt-3 rounded-xl border border-border p-4"
                key={String(item.id || index)}
              >
                <p className="font-semibold">
                  {String(item.title || 'تحویل به فروش')} ·{' '}
                  {(
                    {
                      WAITING_SALES: 'منتظر پذیرش فروش',
                      ACCEPTED: 'پذیرفته شده',
                      RETURNED: 'برگشت برای تکمیل',
                      REJECTED: 'رد شده',
                      OPEN: 'باز',
                      IN_PROGRESS: 'در حال رسیدگی',
                      DONE: 'انجام شده',
                    } as Record<string, string>
                  )[String(item.status)] || String(item.status || '')}
                </p>
                <p className={s.muted}>
                  {String(
                    item.responseReason ||
                      item.responseSummary ||
                      'هنوز پاسخی ثبت نشده است.',
                  )}
                </p>
                {tab === 'leads' &&
                  item.status === 'WAITING_SALES' &&
                  typeof item.id === 'string' && (
                    <SalesHandoffResponse
                      id={item.id}
                      customerId={detail.customerId ?? null}
                      branchId={detail.branchId}
                      onReload={onReload}
                    />
                  )}
              </div>
            ),
          )}
        </Card>
      ) : null}
      <RecordOperations detail={detail} onReload={onReload} />
      {'stage' in detail &&
        typeof detail.qualification?.conversionProbability === 'number' && (
          <p className="text-sm text-muted-foreground">
            احتمال تبدیل به فروش:{' '}
            {detail.qualification.conversionProbability.toLocaleString('fa-IR')}
            ٪ · برآورد کارشناس
          </p>
        )}
      {!('stage' in detail) && <TicketSms id={detail.id} onReload={onReload} />}
      {'stage' in detail &&
        !detail.customerId &&
        !['LOST', 'HANDED_OFF'].includes(detail.stage) && (
          <LeadCustomerConversion
            id={detail.id}
            version={detail.version}
            onReload={onReload}
          />
        )}
      <Card className={s.detail}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-black">سابقه ارتباط و رسیدگی</h3>
          <Button
            variant="outline"
            onClick={() => {
              setOperationError(false);
              setActivityOpen(true);
            }}
          >
            ثبت ارتباط جدید
          </Button>
        </div>
        {activityOpen && (
          <CustomerAffairsFormDialog
            title="ثبت ارتباط"
            description="تماس، جلسه یا پاسخ دریافتی را در سابقه داخلی پرونده ثبت کنید."
            busy={busy}
            onClose={() => setActivityOpen(false)}
          >
            {operationError && notice && (
              <Alert
                title="عملیات انجام نشد"
                description={notice}
                tone="error"
              />
            )}
            <form className="mt-4 grid gap-4" onSubmit={timeline}>
              <AffairsSelect
                className={s.select}
                style={{ maxWidth: 180 }}
                aria-label="نوع ارتباط"
                value={activityType}
                onChange={(event) =>
                  setActivityType(
                    event.target.value as CustomerAffairsTimelineInput['type'],
                  )
                }
              >
                <option value="NOTE">یادداشت داخلی</option>
                <option value="CALL">ثبت تماس</option>
                <option value="MEETING">ثبت جلسه</option>
                <option value="CUSTOMER_REPLY">پاسخ دریافتی مشتری</option>
              </AffairsSelect>
              <Textarea
                rows={5}
                aria-label="خلاصه ارتباط"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="خلاصه ارتباط و نتیجه آن (ثبت داخلی)"
              />
              <Button disabled={busy || !message.trim()} type="submit">
                ثبت ارتباط
              </Button>
            </form>
          </CustomerAffairsFormDialog>
        )}
        <ol className="mt-5 space-y-3">
          {detail.timeline?.length ? (
            detail.timeline.map((item, index) => (
              <li
                className="border-s-2 border-primary/25 ps-4"
                key={item.id ?? `${item.type}-${index}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>
                    {(
                      {
                        NOTE: 'یادداشت داخلی',
                        CALL: 'تماس',
                        MEETING: 'جلسه',
                        MESSAGE: 'پیام',
                        CUSTOMER_REPLY: 'پاسخ مشتری',
                        ASSIGNMENT: 'تعیین مسئول',
                        STATUS_CHANGE: 'تغییر وضعیت',
                        ESCALATION: 'ارجاع به سرپرست',
                        REFERRAL: 'ارجاع داخلی',
                      } as Record<string, string>
                    )[item.type] || item.type}
                  </Badge>
                  {item.customerVisible ? (
                    <span className="text-xs text-emerald-700">
                      قابل مشاهده برای مشتری
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">داخلی</span>
                  )}
                  {item.deliveryStatus && (
                    <Badge>
                      {(
                        {
                          PENDING: 'در انتظار تعیین نتیجه',
                          ACCEPTED: 'پذیرفته‌شده توسط سرویس',
                          DELIVERED: 'تحویل تأییدشده',
                          FAILED: 'ناموفق',
                          UNKNOWN: 'نتیجه نامشخص؛ نیازمند بررسی پنل',
                        } as Record<string, string>
                      )[item.deliveryStatus] ?? item.deliveryStatus}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm leading-6">{item.summary}</p>
                {item.occurredAt ? (
                  <time className="text-xs text-muted-foreground">
                    {new Date(item.occurredAt).toLocaleString('fa-IR')}
                  </time>
                ) : null}
              </li>
            ))
          ) : (
            <li className="text-sm text-muted-foreground">
              رویدادی ثبت نشده است.
            </li>
          )}
        </ol>
      </Card>
    </div>
  );
}

export function CustomerAffairsWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(
    params.get('tab') === 'tickets' ? 'tickets' : 'leads',
  );
  const [state, setState] = useState<LoadState>('loading');
  const [dashboard, setDashboard] = useState<CustomerAffairsDashboard | null>(
    null,
  );
  const [leads, setLeads] = useState<CustomerAffairsLeadView[]>([]);
  const [tickets, setTickets] = useState<CustomerAffairsTicketView[]>([]);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  function selectTab(value: Tab) {
    const query = new URLSearchParams(params.toString());
    query.set('tab', value);
    if (search) query.set('search', search);
    router.replace(`/customer-affairs?${query.toString()}`, { scroll: false });
    setTab(value);
    setDetail(null);
    setCreating(false);
  }
  function changeSearch(value: string) {
    const query = new URLSearchParams(params.toString());
    if (value) query.set('search', value);
    else query.delete('search');
    query.set('tab', tab);
    router.replace(`/customer-affairs?${query.toString()}`, { scroll: false });
    setSearch(value);
  }
  const load = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const [summary, list] = await Promise.all([
        customerAffairsApi.dashboard(),
        tab === 'leads'
          ? customerAffairsApi.leads(search)
          : customerAffairsApi.tickets(search),
      ]);
      setDashboard(summary.data);
      if (tab === 'leads')
        setLeads((list as { data: CustomerAffairsLeadView[] }).data);
      else setTickets((list as { data: CustomerAffairsTicketView[] }).data);
      setState(list.data.length ? 'ready' : 'empty');
    } catch (cause) {
      setState(
        cause instanceof CustomerAffairsApiError && cause.status === 403
          ? 'forbidden'
          : 'error',
      );
      setError(
        cause instanceof Error ? cause.message : 'دریافت اطلاعات انجام نشد.',
      );
    }
  }, [search, tab]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);
  const open = useCallback(
    async (id: string) => {
      setState('loading');
      try {
        const response =
          tab === 'leads'
            ? await customerAffairsApi.lead(id)
            : await customerAffairsApi.ticket(id);
        setDetail(response.data as Detail);
        setState('ready');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'جزئیات دریافت نشد.');
        setState('error');
      }
    },
    [tab],
  );
  const requestedId = params.get(tab === 'leads' ? 'lead' : 'ticket');
  const openingId = useRef('');
  useEffect(() => {
    if (!requestedId) {
      openingId.current = '';
      return;
    }
    if (detail || creating || openingId.current === requestedId) return;
    openingId.current = requestedId;
    const timer = window.setTimeout(() => void open(requestedId), 0);
    return () => window.clearTimeout(timer);
  }, [creating, detail, open, requestedId]);
  async function reloadDetail() {
    if (!detail) return;
    const response =
      tab === 'leads'
        ? await customerAffairsApi.lead(detail.id)
        : await customerAffairsApi.ticket(detail.id);
    setDetail(response.data as Detail);
  }
  const records = tab === 'leads' ? leads : tickets;
  return (
    <main className="min-w-0 space-y-5" dir="rtl">
      <PageHeader
        eyebrow="عملیاتی · داده پایدار"
        title="امور مشتریان و پشتیبانی"
        description="ثبت، مالکیت، SLA، Timeline، ارجاع و تحویل کنترل‌شده به فروش"
        actions={
          <Button onClick={() => void load()} variant="outline">
            <RefreshCw className="size-4" /> تازه‌سازی
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="سرنخ باز" value={dashboard?.leads.open ?? 0} />
        <Summary
          label="پیگیری عقب‌افتاده"
          value={dashboard?.leads.overdue ?? 0}
          tone="warning"
        />
        <Summary label="تیکت باز" value={dashboard?.tickets.open ?? 0} />
        <Summary
          label="نقض SLA"
          value={dashboard?.tickets.breached ?? 0}
          tone="danger"
        />
      </div>
      <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div aria-label="انتخاب فضای کاری" className="grid grid-cols-2 gap-2">
          <Button
            aria-pressed={tab === 'leads'}
            onClick={() => selectTab('leads')}
            variant={tab === 'leads' ? 'primary' : 'ghost'}
          >
            <Users className="size-4" /> پیش‌فروش
          </Button>
          <Button
            aria-pressed={tab === 'tickets'}
            onClick={() => selectTab('tickets')}
            variant={tab === 'tickets' ? 'primary' : 'ghost'}
          >
            <Headphones className="size-4" /> پشتیبانی
          </Button>
        </div>
        <Button
          onClick={() => {
            setCreating(true);
          }}
        >
          <Plus className="size-4" />{' '}
          {tab === 'leads' ? 'درخواست جدید' : 'تیکت جدید'}
        </Button>
      </Card>
      {creating ? (
        tab === 'leads' ? (
          <LeadForm
            onCancel={() => setCreating(false)}
            onCreated={(row) => {
              setCreating(false);
              setLeads((items) => [row, ...items]);
              void open(row.id);
            }}
          />
        ) : (
          <TicketForm
            onCancel={() => setCreating(false)}
            onCreated={(row) => {
              setCreating(false);
              setTickets((items) => [row, ...items]);
              void open(row.id);
            }}
          />
        )
      ) : null}
      {detail ? (
        <DetailPanel
          detail={detail}
          onBack={() => setDetail(null)}
          onReload={reloadDetail}
          tab={tab}
        />
      ) : (
        <>
          <Card className="p-3">
            <label className="relative block">
              <Search
                aria-hidden="true"
                className="absolute start-3 top-3.5 size-4 text-muted-foreground"
              />
              <span className="sr-only">جستجو</span>
              <Input
                className="ps-10"
                value={search}
                onChange={(event) => changeSearch(event.target.value)}
                placeholder="جستجو با شماره پیگیری یا عنوان"
              />
            </label>
          </Card>
          {state === 'loading' ? (
            <div className="space-y-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : state === 'forbidden' ? (
            <ErrorState
              title="دسترسی ندارید"
              description="مجوز مشاهده این بخش برای نقش فعلی صادر نشده است."
            />
          ) : state === 'error' ? (
            <ErrorState
              title="دریافت اطلاعات ناموفق بود"
              description={error}
              action={
                <Button onClick={() => void load()} variant="outline">
                  تلاش دوباره
                </Button>
              }
            />
          ) : state === 'empty' ? (
            <EmptyState
              title="رکوردی نیست"
              description="فیلتر فعلی نتیجه‌ای ندارد یا هنوز رکوردی ثبت نشده است."
              action={
                <Button onClick={() => setCreating(true)}>
                  ثبت اولین رکورد
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3">
              {records.map((record) => (
                <button
                  className="w-full rounded-2xl border border-border bg-surface p-4 text-start shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  key={record.id}
                  onClick={() => void open(record.id)}
                  type="button"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {record.trackingNumber}
                      </p>
                      <h2 className="mt-1 font-black">
                        {'title' in record ? record.title : record.subject}
                      </h2>
                    </div>
                    <div className="flex gap-2">
                      <Badge>
                        {'stage' in record
                          ? stageLabel[record.stage]
                          : statusLabel[record.status]}
                      </Badge>
                      <Badge>{priorityLabel[record.priority]}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3.5" />{' '}
                      {new Date(record.nextActionAt).toLocaleString('fa-IR')}
                    </span>
                    <span>{record.nextAction}</span>
                    <span className="ms-auto inline-flex items-center gap-1 text-primary">
                      باز کردن <ArrowLeft className="size-3.5" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
