import type {
  CustomerAffairsListQuery,
  CustomerAffairsPreviewState,
} from '../api/contracts';

export type LeadStage =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFYING'
  | 'NURTURE'
  | 'QUALIFIED'
  | 'HANDOFF_PROPOSED';
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TicketStatus =
  | 'NEW'
  | 'TRIAGED'
  | 'IN_PROGRESS'
  | 'WAITING_CUSTOMER'
  | 'WAITING_EXTERNAL'
  | 'RESOLVED';
export type SLAState = 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'PAUSED' | 'MET';

export interface PreviewLead {
  id: string;
  title: string;
  source: string;
  channel: string;
  travelNeed: string;
  destination: string;
  approximateDate: string;
  passengerCount: number;
  budgetLabel: string;
  priority: Priority;
  assignee: string;
  stage: LeadStage;
  qualification: string;
  nextActionAt: string;
  ageDays: number;
  overdue: boolean;
  updatedAt: string;
}

export interface PreviewTicket {
  id: string;
  subject: string;
  category: string;
  priority: Priority;
  status: TicketStatus;
  assignee: string;
  customerReference: string;
  salesReference: string;
  firstResponseLabel: string;
  resolutionDueLabel: string;
  slaState: SLAState;
  escalated: boolean;
  internalNote: string;
  customerReply: string;
  satisfaction: string;
  closeReason: string;
  overdue: boolean;
  updatedAt: string;
}

export interface ActivityPreview {
  id: string;
  type: 'تماس' | 'پیام' | 'جلسه' | 'یادداشت' | 'تغییر وضعیت';
  title: string;
  at: string;
  actor: string;
  internal: boolean;
}

export interface CustomerAffairsDraft {
  title: string;
  details: string;
  priority: Priority;
  assignee: string;
  nextActionAt: string;
}

export const previewStates: readonly [CustomerAffairsPreviewState, string][] = [
  ['preview', 'Preview'],
  ['loading', 'Loading'],
  ['empty', 'Empty'],
  ['error', 'Error'],
  ['forbidden', 'Forbidden'],
];

export const leadStageLabels: Readonly<Record<LeadStage, string>> = {
  NEW: 'جدید',
  CONTACTED: 'تماس اولیه',
  QUALIFYING: 'در حال ارزیابی',
  NURTURE: 'پیگیری بلندمدت',
  QUALIFIED: 'واجد شرایط',
  HANDOFF_PROPOSED: 'پیشنهاد تحویل به فروش',
};

export const ticketStatusLabels: Readonly<Record<TicketStatus, string>> = {
  NEW: 'جدید',
  TRIAGED: 'دسته‌بندی‌شده',
  IN_PROGRESS: 'در حال رسیدگی',
  WAITING_CUSTOMER: 'منتظر مشتری',
  WAITING_EXTERNAL: 'منتظر واحد بیرونی',
  RESOLVED: 'حل‌شده',
};

export const previewLeads: readonly PreviewLead[] = [
  {
    id: 'preview-lead-001',
    title: 'درخواست نمایشی سفر خانوادگی',
    source: 'معرفی ساختگی',
    channel: 'تماس تلفنی نمایشی',
    travelNeed: 'برنامه سفر تفریحی نمونه',
    destination: 'مقصد نمونه A',
    approximateDate: 'نیمه دوم شهریور ۱۴۰۵',
    passengerCount: 3,
    budgetLabel: '۲۵۰٬۰۰۰٬۰۰۰ IRR (Preview)',
    priority: 'HIGH',
    assignee: 'کارشناس نمونه ۰۱',
    stage: 'QUALIFYING',
    qualification: '۶۵٪ · نیازمند بررسی',
    nextActionAt: 'امروز، ۱۴:۳۰',
    ageDays: 4,
    overdue: true,
    updatedAt: '2026-08-24T08:30:00.000Z',
  },
  {
    id: 'preview-lead-002',
    title: 'درخواست نمایشی سفر سازمانی',
    source: 'وب‌سایت آزمایشی',
    channel: 'فرم آنلاین نمایشی',
    travelNeed: 'سفر کاری گروهی نمونه',
    destination: 'مقصد نمونه B',
    approximateDate: 'مهر ۱۴۰۵',
    passengerCount: 8,
    budgetLabel: 'بودجه هنوز تعیین نشده',
    priority: 'NORMAL',
    assignee: 'کارشناس نمونه ۰۲',
    stage: 'CONTACTED',
    qualification: '۴۵٪ · در انتظار بودجه',
    nextActionAt: 'فردا، ۱۰:۰۰',
    ageDays: 2,
    overdue: false,
    updatedAt: '2026-08-24T07:30:00.000Z',
  },
  {
    id: 'preview-lead-003',
    title: 'فرصت نمایشی آماده تحویل',
    source: 'کمپین ساختگی',
    channel: 'پیام نمایشی',
    travelNeed: 'خدمت ترکیبی سفر نمونه',
    destination: 'مقصد نمونه C',
    approximateDate: 'آبان ۱۴۰۵',
    passengerCount: 2,
    budgetLabel: '۱٬۲۰۰ USD (Preview)',
    priority: 'URGENT',
    assignee: 'کارشناس نمونه ۰۱',
    stage: 'QUALIFIED',
    qualification: '۸۵٪ · واجد شرایط',
    nextActionAt: 'امروز، ۱۲:۰۰',
    ageDays: 6,
    overdue: true,
    updatedAt: '2026-08-24T09:00:00.000Z',
  },
  {
    id: 'preview-lead-004',
    title: 'پیگیری بلندمدت نمایشی',
    source: 'مراجعه نمایشی',
    channel: 'جلسه نمونه',
    travelNeed: 'بررسی گزینه‌های آینده',
    destination: 'نامشخص',
    approximateDate: 'زمستان ۱۴۰۵',
    passengerCount: 1,
    budgetLabel: 'بودجه هنوز تعیین نشده',
    priority: 'LOW',
    assignee: 'کارشناس نمونه ۰۳',
    stage: 'NURTURE',
    qualification: '۳۰٪ · پیگیری آینده',
    nextActionAt: 'هفته آینده',
    ageDays: 12,
    overdue: false,
    updatedAt: '2026-08-22T09:00:00.000Z',
  },
  {
    id: 'preview-lead-005',
    title: 'درخواست جدید نمایشی',
    source: 'معرفی ساختگی',
    channel: 'تماس تلفنی نمایشی',
    travelNeed: 'استعلام اولیه نمونه',
    destination: 'مقصد نمونه D',
    approximateDate: 'نامشخص',
    passengerCount: 4,
    budgetLabel: 'بودجه هنوز تعیین نشده',
    priority: 'NORMAL',
    assignee: 'تخصیص‌نیافته',
    stage: 'NEW',
    qualification: 'شروع نشده',
    nextActionAt: 'امروز، ۱۶:۰۰',
    ageDays: 0,
    overdue: false,
    updatedAt: '2026-08-24T10:00:00.000Z',
  },
];

export const previewTickets: readonly PreviewTicket[] = [
  {
    id: 'preview-ticket-001',
    subject: 'پیگیری نمایشی واچر هتل',
    category: 'مشکل هتل یا واچر',
    priority: 'URGENT',
    status: 'IN_PROGRESS',
    assignee: 'کارشناس پشتیبانی نمونه ۰۱',
    customerReference: 'preview-customer-ref-001',
    salesReference: 'preview-sales-ref-001',
    firstResponseLabel: 'پاسخ در ۱۸ دقیقه',
    resolutionDueLabel: '۴۵ دقیقه تا موعد حل',
    slaState: 'AT_RISK',
    escalated: true,
    internalNote: 'یادداشت داخلی ساختگی؛ قابل ارسال نیست.',
    customerReply: 'پاسخ پیشنهادی نمایشی؛ ارسال نشده است.',
    satisfaction: 'ثبت نشده',
    closeReason: '—',
    overdue: false,
    updatedAt: '2026-08-24T09:35:00.000Z',
  },
  {
    id: 'preview-ticket-002',
    subject: 'درخواست نمایشی استرداد',
    category: 'استرداد',
    priority: 'HIGH',
    status: 'WAITING_EXTERNAL',
    assignee: 'کارشناس پشتیبانی نمونه ۰۲',
    customerReference: 'preview-customer-ref-002',
    salesReference: 'preview-sales-ref-002',
    firstResponseLabel: 'پاسخ اولیه ثبت شده',
    resolutionDueLabel: '۲ ساعت از موعد گذشته',
    slaState: 'BREACHED',
    escalated: true,
    internalNote: 'منتظر پاسخ واحد مرجع؛ داده واقعی وجود ندارد.',
    customerReply: 'پاسخ پیشنهادی هنوز آماده نیست.',
    satisfaction: 'ثبت نشده',
    closeReason: '—',
    overdue: true,
    updatedAt: '2026-08-24T08:20:00.000Z',
  },
  {
    id: 'preview-ticket-003',
    subject: 'اصلاح نمایشی مشخصات خدمت',
    category: 'اصلاح مشخصات',
    priority: 'NORMAL',
    status: 'TRIAGED',
    assignee: 'کارشناس پشتیبانی نمونه ۰۱',
    customerReference: 'preview-customer-ref-003',
    salesReference: 'preview-sales-ref-003',
    firstResponseLabel: '۱ ساعت تا پاسخ',
    resolutionDueLabel: '۸ ساعت تا موعد حل',
    slaState: 'ON_TRACK',
    escalated: false,
    internalNote: 'یادداشت نمونه',
    customerReply: 'پاسخ نمایشی',
    satisfaction: 'ثبت نشده',
    closeReason: '—',
    overdue: false,
    updatedAt: '2026-08-24T07:15:00.000Z',
  },
  {
    id: 'preview-ticket-004',
    subject: 'مشکل نمایشی بیمه',
    category: 'بیمه',
    priority: 'LOW',
    status: 'RESOLVED',
    assignee: 'کارشناس پشتیبانی نمونه ۰۳',
    customerReference: 'preview-customer-ref-004',
    salesReference: 'preview-sales-ref-004',
    firstResponseLabel: 'در SLA',
    resolutionDueLabel: 'حل‌شده در SLA',
    slaState: 'MET',
    escalated: false,
    internalNote: 'حل نمایشی ثبت شد.',
    customerReply: 'پاسخ نمایشی آماده ارسال است.',
    satisfaction: '۴ از ۵ (Preview)',
    closeReason: 'حل درخواست نمونه',
    overdue: false,
    updatedAt: '2026-08-23T15:00:00.000Z',
  },
];

export const previewTimeline: readonly ActivityPreview[] = [
  {
    id: 'preview-activity-001',
    type: 'تماس',
    title: 'تماس اولیه نمایشی ثبت شد',
    at: 'امروز، ۰۹:۱۵',
    actor: 'کارشناس نمونه ۰۱',
    internal: false,
  },
  {
    id: 'preview-activity-002',
    type: 'یادداشت',
    title: 'نیاز سفر و بودجه اولیه به‌صورت synthetic بررسی شد',
    at: 'امروز، ۰۹:۳۵',
    actor: 'کارشناس نمونه ۰۱',
    internal: true,
  },
  {
    id: 'preview-activity-003',
    type: 'تغییر وضعیت',
    title: 'مرحله از تماس اولیه به ارزیابی تغییر کرد',
    at: 'امروز، ۱۰:۰۰',
    actor: 'سامانه Preview',
    internal: true,
  },
];

const priorityRank: Readonly<Record<Priority, number>> = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  URGENT: 4,
};

export function filterPreviewRecords<
  T extends {
    title?: string;
    subject?: string;
    stage?: string;
    status?: string;
    nextActionAt?: string;
    priority: Priority;
    overdue: boolean;
    updatedAt: string;
  },
>(records: readonly T[], query: CustomerAffairsListQuery): readonly T[] {
  const needle = query.search.toLocaleLowerCase('fa-IR');
  const filtered = records.filter((record) => {
    const label =
      `${record.title ?? ''} ${record.subject ?? ''}`.toLocaleLowerCase(
        'fa-IR',
      );
    const status = record.stage ?? record.status;
    return (
      (!needle || label.includes(needle)) &&
      (query.status === 'ALL' || status === query.status) &&
      (query.priority === 'ALL' || record.priority === query.priority) &&
      (!query.overdueOnly || record.overdue)
    );
  });
  return [...filtered].sort((left, right) => {
    const direction = query.sortDirection === 'asc' ? 1 : -1;
    if (query.sortBy === 'priority')
      return (
        (priorityRank[left.priority] - priorityRank[right.priority]) * direction
      );
    if (query.sortBy === 'nextActionAt')
      return (
        (left.nextActionAt ?? left.updatedAt).localeCompare(
          right.nextActionAt ?? right.updatedAt,
        ) * direction
      );
    return left.updatedAt.localeCompare(right.updatedAt) * direction;
  });
}

export function paginatePreview<T>(
  records: readonly T[],
  page: number,
  pageSize: number,
): readonly T[] {
  const start = (page - 1) * pageSize;
  return records.slice(start, start + pageSize);
}

export function validateCustomerAffairsDraft(draft: CustomerAffairsDraft) {
  const errors: Partial<Record<keyof CustomerAffairsDraft, string>> = {};
  if (draft.title.trim().length < 3)
    errors.title = 'عنوان باید حداقل سه نویسه باشد.';
  if (draft.details.trim().length < 5)
    errors.details = 'شرح باید حداقل پنج نویسه باشد.';
  if (!draft.assignee.trim()) errors.assignee = 'مسئول پیگیری الزامی است.';
  return { valid: Object.keys(errors).length === 0, errors };
}
