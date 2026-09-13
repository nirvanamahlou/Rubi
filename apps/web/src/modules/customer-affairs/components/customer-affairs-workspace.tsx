'use client';

import type { CustomerSummary } from '@rubi/contracts';
import type {
  CustomerAffairsDashboard,
  CustomerAffairsLeadInput,
  CustomerAffairsLeadView,
  CustomerAffairsTicketInput,
  CustomerAffairsTicketView,
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

type Tab = 'leads' | 'tickets';
type LoadState = 'loading' | 'ready' | 'empty' | 'error' | 'forbidden';
type Detail = (CustomerAffairsLeadView | CustomerAffairsTicketView) & {
  timeline?: Array<{
    id?: string;
    type: string;
    summary: string;
    occurredAt?: string;
    customerVisible?: boolean;
  }>;
  referrals?: Array<Record<string, unknown>>;
  correctiveActions?: Array<Record<string, unknown>>;
  handoffs?: Array<Record<string, unknown>>;
};

const isoLocal = () =>
  new Date(Date.now() + 60 * 60_000).toISOString().slice(0, 16);
const stageLabel: Record<string, string> = {
  NEW: 'جدید',
  CONTACTED: 'تماس گرفته شد',
  QUALIFYING: 'در حال ارزیابی',
  NURTURE: 'پیگیری بلندمدت',
  QUALIFIED: 'واجد شرایط',
  HANDOFF_PROPOSED: 'منتظر فروش',
  HANDED_OFF: 'تحویل فروش',
  LOST: 'از دست‌رفته',
};
const statusLabel: Record<string, string> = {
  NEW: 'جدید',
  TRIAGED: 'تریاژ',
  IN_PROGRESS: 'در حال رسیدگی',
  WAITING_CUSTOMER: 'منتظر مشتری',
  WAITING_EXTERNAL: 'منتظر واحد دیگر',
  RESOLVED: 'حل‌شده',
  CLOSED: 'بسته',
  REOPENED: 'بازشده',
  CANCELLED: 'لغوشده',
};
const priorityLabel: Record<string, string> = {
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

function LeadForm({
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
      sourceReference: `manual-${crypto.randomUUID()}`,
      inboundChannel: String(
        data.get('channel'),
      ) as CustomerAffairsLeadInput['inboundChannel'],
      contactOccurredAt: new Date().toISOString(),
      travelNeed: String(data.get('travelNeed')),
      destinationReference: String(data.get('destination')) || null,
      datePrecision: 'UNKNOWN',
      passengerCount: passengers,
      passengerComposition: { adults: passengers, children: 0, infants: 0 },
      requestedServices: [],
      budget: { unknownReason: 'در تماس اولیه اعلام نشد' },
      specialPreferences: null,
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
    <Card className="p-5">
      <h2 className="text-lg font-black">ثبت درخواست یا سرنخ</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        اطلاعات نامعلوم را خالی بگذارید؛ درخواست با مالک صف و اقدام بعدی پایدار
        می‌شود.
      </p>
      <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={submit}>
        <FormField label="عنوان">
          <Input name="title" required minLength={3} />
        </FormField>
        <FormField label="کانال">
          <select
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
          </select>
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
              defaultValue={1}
              required
            />
          </FormField>
        </div>
        <FormField label="اولویت">
          <select
            className="h-11 w-full rounded-xl border border-input bg-surface px-3"
            name="priority"
            defaultValue="NORMAL"
          >
            <option value="LOW">کم</option>
            <option value="NORMAL">عادی</option>
            <option value="HIGH">زیاد</option>
            <option value="URGENT">فوری</option>
          </select>
        </FormField>
        <FormField label="صف مسئول">
          <Input
            name="queueCode"
            defaultValue="customer-affairs-front-office"
            required
          />
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
            {busy ? 'در حال ثبت…' : 'ثبت پایدار'}
          </Button>
          <Button onClick={onCancel} type="button" variant="outline">
            انصراف
          </Button>
        </div>
      </form>
    </Card>
  );
}

function TicketForm({
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
    <Card className="p-5">
      <h2 className="text-lg font-black">ثبت تیکت پشتیبانی</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        تیکت بدون قرارداد هم قابل ثبت است؛ مالک پاسخ به مشتری تغییر نمی‌کند.
      </p>
      <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={submit}>
        <FormField label="موضوع">
          <Input name="subject" required minLength={3} />
        </FormField>
        <FormField label="کانال">
          <select
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
          </select>
        </FormField>
        <div className="lg:col-span-2">
          <CustomerPicker onSelect={setCustomer} selected={customer} />
        </div>
        <FormField label="شرح">
          <Textarea name="description" required minLength={3} />
        </FormField>
        <div className="grid gap-4">
          <FormField label="دسته">
            <Input name="category" defaultValue="QUESTION" required />
          </FormField>
          <FormField label="اولویت">
            <select
              className="h-11 w-full rounded-xl border border-input bg-surface px-3"
              name="priority"
              defaultValue="NORMAL"
            >
              <option value="LOW">کم</option>
              <option value="NORMAL">عادی</option>
              <option value="HIGH">زیاد</option>
              <option value="URGENT">فوری</option>
              <option value="CRITICAL">بحرانی</option>
            </select>
          </FormField>
        </div>
        <FormField label="اثر">
          <select
            className="h-11 w-full rounded-xl border border-input bg-surface px-3"
            name="impact"
            defaultValue="NORMAL"
          >
            <option value="LOW">کم</option>
            <option value="NORMAL">عادی</option>
            <option value="HIGH">زیاد</option>
          </select>
        </FormField>
        <FormField label="فوریت">
          <select
            className="h-11 w-full rounded-xl border border-input bg-surface px-3"
            name="urgency"
            defaultValue="NORMAL"
          >
            <option value="LOW">کم</option>
            <option value="NORMAL">عادی</option>
            <option value="HIGH">زیاد</option>
          </select>
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
            {busy ? 'در حال ثبت…' : 'ثبت پایدار'}
          </Button>
          <Button onClick={onCancel} type="button" variant="outline">
            انصراف
          </Button>
        </div>
      </form>
    </Card>
  );
}

function DetailPanel({
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
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [referralOpen, setReferralOpen] = useState(false);
  const [surveyUrl, setSurveyUrl] = useState('');
  const stage = 'stage' in detail ? detail.stage : detail.status;
  async function run(operation: () => Promise<unknown>, success: string) {
    setBusy(true);
    setNotice('');
    try {
      await operation();
      setNotice(success);
      await onReload();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'عملیات انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  async function timeline(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    await run(
      () =>
        tab === 'leads'
          ? customerAffairsApi.addLeadTimeline(detail.id, {
              type: 'NOTE',
              summary: message,
              customerVisible: false,
            })
          : customerAffairsApi.addTicketTimeline(detail.id, {
              type: 'NOTE',
              summary: message,
              customerVisible: false,
            }),
      'یادداشت داخلی ثبت شد.',
    );
    setMessage('');
  }
  async function refer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(
      () =>
        customerAffairsApi.refer(detail.id, {
          destinationModule: String(data.get('destinationModule')),
          destinationUnit: String(data.get('destinationUnit')),
          title: String(data.get('title')),
          description: String(data.get('description')),
          dueAt: new Date(String(data.get('dueAt'))).toISOString(),
        }),
      'ارجاع در کارتابل مقصد ثبت شد.',
    );
    setReferralOpen(false);
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
      <Card className="p-5">
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
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">اقدام بعدی</dt>
            <dd className="font-semibold">{detail.nextAction}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">موعد</dt>
            <dd>{new Date(detail.nextActionAt).toLocaleString('fa-IR')}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">نسخه</dt>
            <dd>{detail.version.toLocaleString('fa-IR')}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">مشتری</dt>
            <dd>{detail.customerId ? 'متصل' : 'نامشخص'}</dd>
          </div>
        </dl>
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
              onClick={() =>
                run(
                  () => customerAffairsApi.qualify(detail.id, detail.version),
                  'ارزیابی ثبت شد.',
                )
              }
              variant="outline"
            >
              <CheckCircle2 className="size-4" /> ارزیابی تکمیل
            </Button>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              disabled={busy || stage !== 'NEW'}
              onClick={() =>
                run(
                  () =>
                    customerAffairsApi.transitionTicket(
                      detail.id,
                      'TRIAGED',
                      detail.version,
                      'بررسی اولیه و تعیین مسیر رسیدگی',
                    ),
                  'تیکت تریاژ شد.',
                )
              }
              variant="outline"
            >
              تریاژ
            </Button>
            <Button
              disabled={
                busy ||
                ![
                  'TRIAGED',
                  'REOPENED',
                  'WAITING_CUSTOMER',
                  'WAITING_EXTERNAL',
                ].includes(stage)
              }
              onClick={() =>
                run(
                  () =>
                    customerAffairsApi.transitionTicket(
                      detail.id,
                      'IN_PROGRESS',
                      detail.version,
                      'رسیدگی توسط کارشناس آغاز شد',
                    ),
                  'رسیدگی آغاز شد.',
                )
              }
              variant="outline"
            >
              شروع رسیدگی
            </Button>
            <Button
              disabled={busy || stage !== 'IN_PROGRESS'}
              onClick={() =>
                run(
                  () =>
                    customerAffairsApi.transitionTicket(
                      detail.id,
                      'WAITING_CUSTOMER',
                      detail.version,
                      'در انتظار پاسخ مشتری',
                    ),
                  'وضعیت انتظار مشتری ثبت شد.',
                )
              }
              variant="outline"
            >
              انتظار مشتری
            </Button>
            <Button
              disabled={busy || stage !== 'IN_PROGRESS'}
              onClick={() =>
                run(
                  () =>
                    customerAffairsApi.transitionTicket(
                      detail.id,
                      'WAITING_EXTERNAL',
                      detail.version,
                      'در انتظار اقدام واحد ارجاع‌شده',
                    ),
                  'وضعیت انتظار واحد ثبت شد.',
                )
              }
              variant="outline"
            >
              انتظار واحد
            </Button>
            <Button
              disabled={
                busy ||
                ![
                  'IN_PROGRESS',
                  'WAITING_CUSTOMER',
                  'WAITING_EXTERNAL',
                  'REOPENED',
                ].includes(stage)
              }
              onClick={() =>
                run(
                  () =>
                    customerAffairsApi.action(detail.id, 'resolve', {
                      expectedVersion: detail.version,
                      reason: 'رسیدگی تکمیل شد',
                      resolutionOutcome: 'درخواست مشتری انجام شد',
                    }),
                  'تیکت حل شد.',
                )
              }
            >
              حل تیکت
            </Button>
            <Button
              disabled={busy || stage !== 'RESOLVED'}
              onClick={() =>
                run(
                  () =>
                    customerAffairsApi.action(detail.id, 'close', {
                      expectedVersion: detail.version,
                      reason: 'تأیید پایان رسیدگی',
                      resolutionOutcome: 'رسیدگی تکمیل شد',
                      closeReason: 'پایان فرایند پاسخ‌گویی',
                    }),
                  'تیکت بسته شد.',
                )
              }
              variant="outline"
            >
              بستن
            </Button>
            <Button
              disabled={
                busy || !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(stage)
              }
              onClick={() =>
                run(
                  () =>
                    customerAffairsApi.action(detail.id, 'reopen', {
                      expectedVersion: detail.version,
                      reason: 'مشتری حل نشدن موضوع را اعلام کرد',
                    }),
                  'تیکت بازگشایی شد.',
                )
              }
              variant="outline"
            >
              بازگشایی
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    customerAffairsApi.action(detail.id, 'escalate', {
                      expectedVersion: detail.version,
                      reason: 'نیازمند رسیدگی سطح بالاتر',
                    }),
                  'تصعید ثبت شد.',
                )
              }
              variant="outline"
            >
              <AlertTriangle className="size-4" /> تصعید
            </Button>
            <Button
              disabled={busy}
              onClick={() => setReferralOpen((value) => !value)}
              variant="outline"
            >
              ارجاع داخلی
            </Button>
            <Button
              disabled={busy || !['RESOLVED', 'CLOSED'].includes(stage)}
              onClick={createSurveyInvitation}
              variant="outline"
            >
              دعوت رضایت‌سنجی
            </Button>
          </div>
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
            tone={notice.includes('نشد') ? 'error' : 'info'}
          />
        ) : null}
        {tab === 'tickets' && referralOpen ? (
          <form
            className="mt-5 grid gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2"
            onSubmit={refer}
          >
            <FormField label="ماژول مقصد">
              <Input
                name="destinationModule"
                required
                placeholder="reservations"
              />
            </FormField>
            <FormField label="واحد مقصد">
              <Input name="destinationUnit" required placeholder="operations" />
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
              ثبت ارجاع پایدار
            </Button>
          </form>
        ) : null}
      </Card>
      <Card className="p-5">
        <h3 className="font-black">Timeline</h3>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={timeline}
        >
          <Input
            aria-label="یادداشت داخلی"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="یادداشت داخلی (برای مشتری ارسال نمی‌شود)"
          />
          <Button disabled={busy || !message.trim()} type="submit">
            ثبت یادداشت
          </Button>
        </form>
        <ol className="mt-5 space-y-3">
          {detail.timeline?.length ? (
            detail.timeline.map((item, index) => (
              <li
                className="border-s-2 border-primary/25 ps-4"
                key={item.id ?? `${item.type}-${index}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{item.type}</Badge>
                  {item.customerVisible ? (
                    <span className="text-xs text-emerald-700">
                      قابل مشاهده برای مشتری
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">داخلی</span>
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
            setDetail(null);
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
      ) : detail ? (
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
