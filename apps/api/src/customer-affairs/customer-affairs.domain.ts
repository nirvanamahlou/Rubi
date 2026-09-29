import type {
  LeadDraft,
  LeadStage,
  QualificationResult,
  SLAState,
  SupportTicketDraft,
  TicketStatus,
} from './customer-affairs.contracts';

export interface DomainValidationResult {
  valid: boolean;
  errors: Readonly<Record<string, string>>;
}

const isoDate = (value: string | null): boolean =>
  value === null ||
  (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value)));

export function validateLeadDraft(draft: LeadDraft): DomainValidationResult {
  const errors: Record<string, string> = {};
  if (draft.title.trim().length < 3)
    errors.title = 'عنوان درخواست باید حداقل سه نویسه باشد.';
  if (!draft.sourceReference.trim())
    errors.sourceReference = 'منبع آشنایی الزامی است.';
  if (draft.travelNeed.trim().length < 3)
    errors.travelNeed = 'نیاز سفر باید به‌صورت خلاصه ثبت شود.';
  if (!Number.isInteger(draft.passengerCount) || draft.passengerCount < 1)
    errors.passengerCount = 'تعداد مسافر باید عدد صحیح مثبت باشد.';
  if (draft.passengerCount > 99)
    errors.passengerCount = 'در فاز A حداکثر ۹۹ مسافر قابل طراحی است.';
  if (!isoDate(draft.approximateTravelStart))
    errors.approximateTravelStart = 'زمان شروع باید ISO و UTC باشد.';
  if (!isoDate(draft.approximateTravelEnd))
    errors.approximateTravelEnd = 'زمان پایان باید ISO و UTC باشد.';
  if (
    draft.approximateTravelStart &&
    draft.approximateTravelEnd &&
    draft.approximateTravelStart > draft.approximateTravelEnd
  )
    errors.approximateTravelEnd = 'پایان بازه سفر نمی‌تواند قبل از شروع باشد.';
  if (!isoDate(draft.nextActionAt))
    errors.nextActionAt = 'اقدام بعدی باید ISO و UTC باشد.';
  if (draft.initialBudget) {
    if (!/^[A-Z]{3}$/.test(draft.initialBudget.currencyCode))
      errors.initialBudgetCurrency = 'بودجه باید کد ارز سه‌حرفی داشته باشد.';
    if (
      !/^\d+(?:\.\d{1,6})?$/.test(draft.initialBudget.amount) ||
      Number(draft.initialBudget.amount) <= 0
    )
      errors.initialBudgetAmount = 'بودجه باید Decimal مثبت باشد.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateSupportTicketDraft(
  draft: SupportTicketDraft,
): DomainValidationResult {
  const errors: Record<string, string> = {};
  if (draft.subject.trim().length < 3)
    errors.subject = 'موضوع Ticket باید حداقل سه نویسه باشد.';
  if (draft.internalNote.length > 2_000)
    errors.internalNote = 'یادداشت داخلی بیش از حد مجاز است.';
  if (draft.customerReplyDraft.length > 2_000)
    errors.customerReplyDraft = 'پاسخ پیشنهادی بیش از حد مجاز است.';
  if (draft.salesReference?.contractId && !draft.salesReference.salesRequestId)
    errors.salesReference = 'Contract reference بدون Sales Request مجاز نیست.';
  return { valid: Object.keys(errors).length === 0, errors };
}

const leadTransitions: Readonly<Record<LeadStage, readonly LeadStage[]>> = {
  NEW: ['CONTACTED', 'LOST'],
  CONTACTED: ['QUALIFYING', 'NURTURE', 'LOST'],
  QUALIFYING: ['QUALIFIED', 'NURTURE', 'LOST'],
  NURTURE: ['CONTACTED', 'LOST'],
  QUALIFIED: ['HANDOFF_PROPOSED', 'NURTURE', 'LOST'],
  HANDOFF_PROPOSED: ['HANDED_OFF', 'QUALIFIED'],
  HANDED_OFF: [],
  LOST: ['NURTURE'],
};

export function canTransitionLead(
  current: LeadStage,
  target: LeadStage,
): boolean {
  return leadTransitions[current].includes(target);
}

export interface QualificationSignals {
  travelNeedConfirmed: boolean;
  destinationKnown: boolean;
  timingKnown: boolean;
  budgetDiscussed: boolean;
  decisionMakerReachable: boolean;
  contactable: boolean;
  disqualifyingReason?: string;
}

export function evaluateQualification(
  signals: QualificationSignals,
  evaluatedAt: string,
): QualificationResult {
  if (signals.disqualifyingReason?.trim()) {
    return {
      state: 'DISQUALIFIED',
      score: 0,
      reasons: [signals.disqualifyingReason.trim()],
      evaluatedAt,
    };
  }
  const weights = [
    [signals.travelNeedConfirmed, 25, 'نیاز سفر تایید شده'],
    [signals.destinationKnown, 15, 'مقصد مشخص است'],
    [signals.timingKnown, 15, 'بازه سفر مشخص است'],
    [signals.budgetDiscussed, 15, 'بودجه بررسی شده'],
    [signals.decisionMakerReachable, 15, 'تصمیم‌گیرنده در دسترس است'],
    [signals.contactable, 15, 'مسیر تماس معتبر است'],
  ] as const;
  const score = weights.reduce(
    (total, [passed, weight]) => total + (passed ? weight : 0),
    0,
  );
  const reasons = weights
    .filter(([passed]) => passed)
    .map(([, , reason]) => reason);
  return {
    state: score >= 70 ? 'QUALIFIED' : 'NEEDS_REVIEW',
    score,
    reasons,
    evaluatedAt,
  };
}

export function isFollowUpOverdue(input: {
  nextActionAt: string | null;
  completed: boolean;
  now: string;
}): boolean {
  return Boolean(
    !input.completed &&
    input.nextActionAt &&
    Date.parse(input.nextActionAt) < Date.parse(input.now),
  );
}

export function leadAgeDays(createdAt: string, now: string): number {
  const elapsed = Date.parse(now) - Date.parse(createdAt);
  return Math.max(0, Math.floor(elapsed / 86_400_000));
}

const ticketTransitions: Readonly<
  Record<TicketStatus, readonly TicketStatus[]>
> = {
  NEW: ['TRIAGED', 'CANCELLED'],
  TRIAGED: ['IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_EXTERNAL', 'CANCELLED'],
  IN_PROGRESS: [
    'WAITING_CUSTOMER',
    'WAITING_EXTERNAL',
    'RESOLVED',
    'CANCELLED',
  ],
  WAITING_CUSTOMER: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  WAITING_EXTERNAL: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_EXTERNAL', 'RESOLVED'],
  CANCELLED: ['REOPENED'],
};

export function canTransitionTicket(
  current: TicketStatus,
  target: TicketStatus,
): boolean {
  return ticketTransitions[current].includes(target);
}

export function calculateSLAState(input: {
  now: string;
  firstResponseDueAt: string;
  resolutionDueAt: string;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  paused: boolean;
  firstResponseWindowMinutes: number;
  resolutionWindowMinutes: number;
  atRiskPercent: number;
}): SLAState {
  if (input.resolvedAt)
    return Date.parse(input.resolvedAt) <= Date.parse(input.resolutionDueAt)
      ? 'MET'
      : 'BREACHED';
  if (input.paused) return 'PAUSED';
  const now = Date.parse(input.now);
  const responseDue = Date.parse(input.firstResponseDueAt);
  const resolutionDue = Date.parse(input.resolutionDueAt);
  if ((!input.firstRespondedAt && now > responseDue) || now > resolutionDue)
    return 'BREACHED';
  const nextDeadline = input.firstRespondedAt ? resolutionDue : responseDue;
  const remaining = nextDeadline - now;
  const windowMinutes = input.firstRespondedAt
    ? input.resolutionWindowMinutes
    : input.firstResponseWindowMinutes;
  const remainingPercent = (remaining / (windowMinutes * 60_000)) * 100;
  return remainingPercent <= input.atRiskPercent ? 'AT_RISK' : 'ON_TRACK';
}
