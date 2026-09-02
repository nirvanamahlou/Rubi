import {
  compareMarketingDecimals,
  createMarketingMoney,
  type MarketingMoney,
} from './marketing.decimal';
import { MarketingDomainError } from './marketing.errors';
import {
  assertMarketingPermission,
  type MarketingAction,
} from './marketing.permissions';

export type CampaignStatus =
  | 'DRAFT'
  | 'READY_FOR_APPROVAL'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ARCHIVED';

export type CampaignChannel =
  | 'SMS'
  | 'EMAIL'
  | 'WHATSAPP'
  | 'WEBSITE'
  | 'INSTAGRAM'
  | 'TELEGRAM'
  | 'PUSH_NOTIFICATION'
  | 'PHONE_CALL'
  | 'PARTNER_AGENCY'
  | 'REFERRAL'
  | 'OFFLINE';

export type ExecutionCompany = 'NIAYESH_SEIR_SAHAR' | 'JAHAN_BASTAN';

export interface Campaign {
  id: string;
  internalCode: string;
  name: string;
  campaignTypeReference: string;
  objective: string;
  channels: readonly CampaignChannel[];
  segmentReference: string;
  executionCompany: ExecutionCompany;
  ownerReference: string;
  startsAt: string;
  endsAt: string;
  budget: MarketingMoney;
  spend: MarketingMoney;
  status: CampaignStatus;
  version: number;
  updatedAt: string;
}

export interface CampaignTimelineEvent {
  id: string;
  campaignReference: string;
  action: string;
  fromStatus: CampaignStatus;
  toStatus: CampaignStatus;
  actorReference: string;
  reason: string;
  version: number;
  occurredAt: string;
}

const campaignTransitions: Readonly<
  Record<CampaignStatus, readonly CampaignStatus[]>
> = {
  DRAFT: ['READY_FOR_APPROVAL', 'CANCELLED'],
  READY_FOR_APPROVAL: ['DRAFT', 'APPROVED', 'CANCELLED'],
  APPROVED: ['DRAFT', 'SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['RUNNING', 'PAUSED', 'CANCELLED'],
  RUNNING: ['PAUSED', 'COMPLETED', 'CANCELLED'],
  PAUSED: ['RUNNING', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['ARCHIVED'],
  CANCELLED: ['ARCHIVED'],
  ARCHIVED: [],
};

const transitionActions: Readonly<Record<CampaignStatus, MarketingAction>> = {
  DRAFT: 'campaign.update',
  READY_FOR_APPROVAL: 'campaign.update',
  APPROVED: 'campaign.approve',
  SCHEDULED: 'campaign.schedule',
  RUNNING: 'campaign.execute',
  PAUSED: 'campaign.pause',
  COMPLETED: 'campaign.execute',
  CANCELLED: 'campaign.cancel',
  ARCHIVED: 'campaign.update',
};

const UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function isUtcTimestamp(value: string): boolean {
  if (!UTC_TIMESTAMP_PATTERN.test(value)) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const normalized = value.includes('.') ? value : value.replace('Z', '.000Z');
  return new Date(timestamp).toISOString() === normalized;
}

export function assertExpectedMarketingVersion(
  actualVersion: number,
  expectedVersion: number,
): void {
  if (
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1 ||
    actualVersion !== expectedVersion
  ) {
    throw new MarketingDomainError(
      'MARKETING_CONFLICT',
      'Campaign version does not match expectedVersion.',
      { actualVersion, expectedVersion },
    );
  }
}

export function validateCampaign(campaign: Campaign): void {
  if (!/^MKT-[A-Z0-9-]{3,24}$/.test(campaign.internalCode)) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Campaign internal code is invalid.',
      { field: 'internalCode' },
    );
  }
  if (campaign.name.trim().length < 3 || campaign.name.trim().length > 120) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Campaign name must contain 3-120 characters.',
      { field: 'name' },
    );
  }
  if (
    campaign.channels.length === 0 ||
    new Set(campaign.channels).size !== campaign.channels.length
  ) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Campaign must have at least one unique channel.',
      { field: 'channels' },
    );
  }
  validateUtcDateRange(campaign.startsAt, campaign.endsAt);
  createMarketingMoney(campaign.budget.amount, campaign.budget.currencyCode);
  createMarketingMoney(campaign.spend.amount, campaign.spend.currencyCode);
  if (campaign.budget.currencyCode !== campaign.spend.currencyCode) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Campaign budget and spend must use the same currency.',
      { field: 'currencyCode' },
    );
  }
  if (
    compareMarketingDecimals(campaign.spend.amount, campaign.budget.amount) > 0
  ) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Campaign spend cannot exceed approved budget without a new budget version.',
      { field: 'spend' },
    );
  }
  for (const requiredReference of [
    campaign.campaignTypeReference,
    campaign.segmentReference,
    campaign.ownerReference,
  ]) {
    if (!requiredReference.trim()) {
      throw new MarketingDomainError(
        'MARKETING_VALIDATION_ERROR',
        'Campaign references must not be empty.',
      );
    }
  }
}

export function validateUtcDateRange(startsAt: string, endsAt: string): void {
  if (
    !isUtcTimestamp(startsAt) ||
    !isUtcTimestamp(endsAt) ||
    Date.parse(startsAt) >= Date.parse(endsAt)
  ) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Campaign date range must contain increasing UTC timestamps.',
      { fields: ['startsAt', 'endsAt'] },
    );
  }
}

export function canTransitionCampaign(
  current: CampaignStatus,
  target: CampaignStatus,
): boolean {
  return campaignTransitions[current].includes(target);
}

export function transitionCampaign(
  campaign: Campaign,
  target: CampaignStatus,
  context: {
    expectedVersion: number;
    actorReference: string;
    actorPermissions: readonly string[];
    reason: string;
    occurredAt: string;
  },
): { campaign: Campaign; event: CampaignTimelineEvent } {
  assertExpectedMarketingVersion(campaign.version, context.expectedVersion);
  assertMarketingPermission(
    context.actorPermissions,
    transitionActions[target],
  );
  if (!canTransitionCampaign(campaign.status, target)) {
    throw new MarketingDomainError(
      'MARKETING_INVALID_TRANSITION',
      `Campaign cannot transition from ${campaign.status} to ${target}.`,
      { current: campaign.status, target },
    );
  }
  if (!isUtcTimestamp(context.occurredAt)) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Campaign timeline events require a UTC timestamp.',
      { field: 'occurredAt' },
    );
  }
  if (
    context.actorReference.trim().length < 3 ||
    context.reason.trim().length < 3
  ) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Campaign transitions require an actor and reason.',
    );
  }
  const nextVersion = campaign.version + 1;
  return {
    campaign: {
      ...campaign,
      status: target,
      updatedAt: context.occurredAt,
      version: nextVersion,
    },
    event: {
      id: `event-${campaign.id}-${nextVersion}`,
      campaignReference: campaign.id,
      action: `campaign.${target.toLowerCase()}`,
      fromStatus: campaign.status,
      toStatus: target,
      actorReference: context.actorReference,
      reason: context.reason.trim(),
      version: nextVersion,
      occurredAt: context.occurredAt,
    },
  };
}

export type SegmentField =
  | 'CUSTOMER_TYPE'
  | 'COUNTRY_REFERENCE'
  | 'CITY_REFERENCE'
  | 'ACQUAINTANCE_METHOD_REFERENCE'
  | 'SALES_CHANNEL_REFERENCE'
  | 'TAG_REFERENCE'
  | 'CUSTOMER_STATUS'
  | 'LAST_PURCHASE_AT'
  | 'TRIP_COUNT'
  | 'PREVIOUS_DESTINATION_REFERENCE'
  | 'PURCHASED_SERVICE_TYPE'
  | 'PURCHASE_AMOUNT'
  | 'BIRTH_DATE_RANGE'
  | 'MARKETING_CONSENT_STATUS'
  | 'ACTIVITY_STATUS';

export type SegmentOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'IN'
  | 'NOT_IN'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'BETWEEN'
  | 'IS_SET';

export interface SegmentCriterion {
  field: SegmentField;
  operator: SegmentOperator;
  value: string | number | boolean | readonly string[] | null;
}

export interface SegmentDefinition {
  id: string;
  name: string;
  match: 'ALL' | 'ANY';
  criteria: readonly SegmentCriterion[];
  customerContractVersion: string;
  storesRawPii: false;
  version: number;
}

const segmentFields = new Set<SegmentField>([
  'CUSTOMER_TYPE',
  'COUNTRY_REFERENCE',
  'CITY_REFERENCE',
  'ACQUAINTANCE_METHOD_REFERENCE',
  'SALES_CHANNEL_REFERENCE',
  'TAG_REFERENCE',
  'CUSTOMER_STATUS',
  'LAST_PURCHASE_AT',
  'TRIP_COUNT',
  'PREVIOUS_DESTINATION_REFERENCE',
  'PURCHASED_SERVICE_TYPE',
  'PURCHASE_AMOUNT',
  'BIRTH_DATE_RANGE',
  'MARKETING_CONSENT_STATUS',
  'ACTIVITY_STATUS',
]);

export function validateSegmentDefinition(definition: SegmentDefinition): void {
  if (definition.name.trim().length < 3 || definition.criteria.length === 0) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Segment requires a name and at least one criterion.',
      { field: 'criteria' },
    );
  }
  if (definition.criteria.length > 25 || definition.storesRawPii !== false) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Segment definitions cannot store raw PII or more than 25 criteria.',
      { field: 'criteria' },
    );
  }
  for (const criterion of definition.criteria) {
    if (!segmentFields.has(criterion.field)) {
      throw new MarketingDomainError(
        'MARKETING_VALIDATION_ERROR',
        'Segment contains an unsupported or sensitive field.',
        { field: 'criteria.field' },
      );
    }
    if (
      (criterion.operator === 'IN' ||
        criterion.operator === 'NOT_IN' ||
        criterion.operator === 'BETWEEN') &&
      (!Array.isArray(criterion.value) || criterion.value.length === 0)
    ) {
      throw new MarketingDomainError(
        'MARKETING_VALIDATION_ERROR',
        'Selected segment operator requires a non-empty array value.',
        { field: 'criteria.value' },
      );
    }
    if (typeof criterion.value === 'string' && criterion.value.length > 120) {
      throw new MarketingDomainError(
        'MARKETING_VALIDATION_ERROR',
        'Segment criterion value is too long.',
        { field: 'criteria.value' },
      );
    }
  }
}

export type SuppressionKind =
  | 'UNSUBSCRIBED'
  | 'BLACKLIST'
  | 'DNC'
  | 'HARD_BOUNCE'
  | 'SPAM_COMPLAINT'
  | 'CHANNEL_SUPPRESSION'
  | 'GLOBAL_SUPPRESSION';

export interface SuppressionFact {
  kind: SuppressionKind;
  channel: CampaignChannel | null;
  reasonCode: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
}

export interface ConsentFact {
  status: 'GRANTED' | 'REVOKED' | 'UNKNOWN';
  channel: CampaignChannel;
  effectiveFrom: string;
  effectiveUntil: string | null;
  contractVersion: string;
}

export interface FrequencyCap {
  maximumMessages: number;
  windowHours: number;
}

export interface AudienceEligibilityInput {
  channel: CampaignChannel;
  consent: ConsentFact | null;
  suppressions: readonly SuppressionFact[];
  recentTouchpointTimes: readonly string[];
  frequencyCap: FrequencyCap;
  now: string;
}

export interface AudienceEligibility {
  eligible: boolean;
  reasonCodes: readonly (
    | 'CONSENT_REQUIRED'
    | 'CONSENT_EXPIRED'
    | 'SUPPRESSED'
    | 'FREQUENCY_CAP_REACHED'
  )[];
}

function isEffectiveAt(
  from: string,
  until: string | null,
  now: string,
): boolean {
  return (
    isUtcTimestamp(from) &&
    (!until || isUtcTimestamp(until)) &&
    Date.parse(from) <= Date.parse(now) &&
    (!until || Date.parse(until) > Date.parse(now))
  );
}

export function evaluateAudienceEligibility(
  input: AudienceEligibilityInput,
): AudienceEligibility {
  if (!isUtcTimestamp(input.now)) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Audience evaluation requires a UTC timestamp.',
      { field: 'now' },
    );
  }
  if (
    !Number.isInteger(input.frequencyCap.maximumMessages) ||
    input.frequencyCap.maximumMessages < 1 ||
    !Number.isInteger(input.frequencyCap.windowHours) ||
    input.frequencyCap.windowHours < 1 ||
    input.frequencyCap.windowHours > 8760
  ) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Frequency cap must contain positive integer limits.',
      { field: 'frequencyCap' },
    );
  }

  const reasons: AudienceEligibility['reasonCodes'][number][] = [];
  if (
    !input.consent ||
    input.consent.channel !== input.channel ||
    input.consent.status !== 'GRANTED'
  ) {
    reasons.push('CONSENT_REQUIRED');
  } else if (
    !isEffectiveAt(
      input.consent.effectiveFrom,
      input.consent.effectiveUntil,
      input.now,
    )
  ) {
    reasons.push('CONSENT_EXPIRED');
  }

  const suppressed = input.suppressions.some(
    (suppression) =>
      (!suppression.channel || suppression.channel === input.channel) &&
      isEffectiveAt(
        suppression.effectiveFrom,
        suppression.effectiveUntil,
        input.now,
      ),
  );
  if (suppressed) reasons.push('SUPPRESSED');

  const windowStart =
    Date.parse(input.now) - input.frequencyCap.windowHours * 60 * 60 * 1000;
  const recentCount = input.recentTouchpointTimes.filter((timestamp) => {
    if (!isUtcTimestamp(timestamp)) {
      throw new MarketingDomainError(
        'MARKETING_VALIDATION_ERROR',
        'Touchpoint timestamps must use UTC.',
        { field: 'recentTouchpointTimes' },
      );
    }
    const value = Date.parse(timestamp);
    return value >= windowStart && value <= Date.parse(input.now);
  }).length;
  if (recentCount >= input.frequencyCap.maximumMessages) {
    reasons.push('FREQUENCY_CAP_REACHED');
  }
  return { eligible: reasons.length === 0, reasonCodes: reasons };
}

export interface CouponDefinition {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: string;
  currencyCode: string | null;
  minimumPurchase: MarketingMoney | null;
  maximumDiscount: MarketingMoney | null;
  validFrom: string;
  validUntil: string;
  capacity: number;
  usageCount: number;
  customerLimit: number;
  serviceTypeReferences: readonly string[];
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED';
  version: number;
}

export function validateCoupon(coupon: CouponDefinition): void {
  if (!/^[A-Z0-9][A-Z0-9_-]{4,31}$/.test(coupon.code)) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Coupon code must contain 5-32 safe uppercase characters.',
      { field: 'code' },
    );
  }
  validateUtcDateRange(coupon.validFrom, coupon.validUntil);
  createMarketingMoney(coupon.discountValue, coupon.currencyCode ?? 'IRR');
  if (
    coupon.discountType === 'PERCENTAGE' &&
    (coupon.currencyCode !== null ||
      compareMarketingDecimals(coupon.discountValue, '100') > 0)
  ) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Percentage coupon must be at most 100 and cannot define a currency.',
      { field: 'discountValue' },
    );
  }
  if (coupon.discountType === 'FIXED_AMOUNT' && !coupon.currencyCode) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Fixed coupon requires a currency code.',
      { field: 'currencyCode' },
    );
  }
  for (const money of [coupon.minimumPurchase, coupon.maximumDiscount]) {
    if (money) createMarketingMoney(money.amount, money.currencyCode);
  }
  if (
    !Number.isInteger(coupon.capacity) ||
    coupon.capacity < 1 ||
    !Number.isInteger(coupon.usageCount) ||
    coupon.usageCount < 0 ||
    coupon.usageCount > coupon.capacity ||
    !Number.isInteger(coupon.customerLimit) ||
    coupon.customerLimit < 1
  ) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Coupon capacity, usage and customer limits are invalid.',
      { field: 'capacity' },
    );
  }
  if (coupon.serviceTypeReferences.length === 0) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Coupon requires at least one service restriction.',
      { field: 'serviceTypeReferences' },
    );
  }
}

export type AttributionModel =
  'FIRST_TOUCH' | 'LAST_TOUCH' | 'LINEAR' | 'MANUAL_REVIEWED';

export interface AttributionTouchpoint {
  id: string;
  campaignReference: string;
  source: string;
  medium: string;
  utmCampaign: string;
  utmSource: string;
  utmMedium: string;
  utmContent: string | null;
  utmTerm: string | null;
  occurredAt: string;
  anonymousReference: string;
  customerReference: string | null;
  leadReference: string | null;
  salesContractReference: string | null;
  model: AttributionModel;
  financialStatus: 'PROPOSED';
}

const UTM_PATTERN = /^[\p{L}\p{N}._~-]{1,100}$/u;

export function validateAttributionTouchpoint(
  touchpoint: AttributionTouchpoint,
): void {
  if (!isUtcTimestamp(touchpoint.occurredAt)) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Attribution touchpoint time must use UTC.',
      { field: 'occurredAt' },
    );
  }
  for (const value of [
    touchpoint.source,
    touchpoint.medium,
    touchpoint.utmCampaign,
    touchpoint.utmSource,
    touchpoint.utmMedium,
  ]) {
    if (!UTM_PATTERN.test(value)) {
      throw new MarketingDomainError(
        'MARKETING_VALIDATION_ERROR',
        'UTM fields must contain URL-safe characters.',
        { field: 'utm' },
      );
    }
  }
  if (touchpoint.financialStatus !== 'PROPOSED') {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Financial attribution remains PROPOSED until the business decision is approved.',
      { field: 'financialStatus' },
    );
  }
}

const rawPiiKeyPattern =
  /(phone|mobile|email|passport|national.?id|contact.?value|cipher|card|cvv)/i;
const rawEmailPattern = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;
const longDigitPattern = /\b\d{8,}\b/;

export function assertAuditMetadataSafe(
  metadata: Readonly<Record<string, unknown>>,
): void {
  for (const [key, value] of Object.entries(metadata)) {
    if (rawPiiKeyPattern.test(key)) {
      throw new MarketingDomainError(
        'MARKETING_VALIDATION_ERROR',
        'Audit metadata cannot contain raw PII fields.',
        { field: key },
      );
    }
    if (
      typeof value === 'string' &&
      (rawEmailPattern.test(value) || longDigitPattern.test(value))
    ) {
      throw new MarketingDomainError(
        'MARKETING_VALIDATION_ERROR',
        'Audit metadata cannot contain raw PII values.',
        { field: key },
      );
    }
  }
}

export function sanitizeMarketingText(value: string): {
  htmlSafe: string;
  formulaSafe: string;
} {
  const htmlSafe = value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
  const formulaSafe = /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
  return { htmlSafe, formulaSafe };
}

export function validateDispatchIntent(input: {
  idempotencyKey: string;
  requestFingerprint: string;
  campaignReference: string;
  segmentReference: string;
  channel: CampaignChannel;
  consentCheckedAt: string;
  suppressionCheckedAt: string;
}): void {
  if (!/^[A-Za-z0-9:_-]{12,128}$/.test(input.idempotencyKey)) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Dispatch intent requires a stable idempotency key.',
      { field: 'idempotencyKey' },
    );
  }
  if (!/^[a-f0-9]{64}$/.test(input.requestFingerprint)) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Dispatch intent fingerprint must be a SHA-256 hex digest.',
      { field: 'requestFingerprint' },
    );
  }
  if (
    !isUtcTimestamp(input.consentCheckedAt) ||
    !isUtcTimestamp(input.suppressionCheckedAt)
  ) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Dispatch safety checks must use UTC timestamps.',
      { field: 'consentCheckedAt' },
    );
  }
}
