import type { MarketingMoney } from './marketing.decimal';
import type {
  AttributionTouchpoint,
  Campaign,
  CampaignChannel,
  CampaignStatus,
  CampaignTimelineEvent,
  CouponDefinition,
  SegmentDefinition,
  SuppressionFact,
} from './marketing.domain';
import type { MarketingPermission } from './marketing.permissions';
import type { NormalizedMarketingListQuery } from './marketing.validation';

export interface MarketingActor {
  actorReference: string;
  branchReferences: readonly string[];
  permissions: readonly MarketingPermission[];
}

export interface MarketingCommandContext {
  actor: MarketingActor;
  expectedVersion: number;
  idempotencyKey: string;
  requestFingerprint: string;
  occurredAt: string;
  reason: string;
  traceId: string;
}

export interface MarketingPage<T> {
  items: readonly T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface MarketingKpiDefinition {
  key: string;
  title: string;
  definition: string;
  numerator: string;
  denominator: string | null;
  status: 'AWAITING_ANALYTICS_CONTRACT';
  value: null;
}

export interface MarketingDashboardProjection {
  kpis: readonly MarketingKpiDefinition[];
  generatedAt: string;
  sourceStatus: 'AWAITING_ANALYTICS_CONTRACT';
}

export interface MarketingCampaignQueryPort {
  dashboard(actor: MarketingActor): Promise<MarketingDashboardProjection>;
  listCampaigns(
    query: NormalizedMarketingListQuery,
    actor: MarketingActor,
  ): Promise<MarketingPage<Campaign>>;
  getCampaign(
    campaignReference: string,
    actor: MarketingActor,
  ): Promise<Campaign | null>;
  timeline(
    campaignReference: string,
    actor: MarketingActor,
  ): Promise<readonly CampaignTimelineEvent[]>;
  listSegments(
    query: NormalizedMarketingListQuery,
    actor: MarketingActor,
  ): Promise<MarketingPage<SegmentDefinition>>;
  listCoupons(
    query: NormalizedMarketingListQuery,
    actor: MarketingActor,
  ): Promise<MarketingPage<CouponDefinition>>;
  listAttribution(
    query: NormalizedMarketingListQuery,
    actor: MarketingActor,
  ): Promise<MarketingPage<AttributionTouchpoint>>;
}

export interface MarketingCampaignCommandPort {
  createCampaign(
    campaign: Campaign,
    context: MarketingCommandContext,
  ): Promise<Campaign>;
  updateCampaign(
    campaign: Campaign,
    context: MarketingCommandContext,
  ): Promise<Campaign>;
  transitionCampaign(
    campaignReference: string,
    targetStatus: CampaignStatus,
    context: MarketingCommandContext,
  ): Promise<{ campaign: Campaign; event: CampaignTimelineEvent }>;
  saveSegment(
    definition: SegmentDefinition,
    context: MarketingCommandContext,
  ): Promise<SegmentDefinition>;
  saveCoupon(
    definition: CouponDefinition,
    context: MarketingCommandContext,
  ): Promise<CouponDefinition>;
  recordSpend(
    campaignReference: string,
    spend: MarketingMoney,
    financeRequestReference: string | null,
    context: MarketingCommandContext,
  ): Promise<{ campaignReference: string; spendVersion: number }>;
  requestDispatchIntent(
    intent: MarketingDispatchIntent,
    context: MarketingCommandContext,
  ): Promise<{
    status: 'AWAITING_INTEGRATION_ADAPTER';
    intentReference: string;
  }>;
}

export interface CustomerAudienceReadPort {
  countSegment(
    definition: SegmentDefinition,
    actor: MarketingActor,
  ): Promise<{
    totalCount: number;
    consentedCount: number;
    suppressedCount: number;
    contractVersion: string;
    containsRawPii: false;
  }>;
  checkConsent(input: {
    anonymousCustomerReference: string;
    channel: CampaignChannel;
    at: string;
  }): Promise<{ granted: boolean; contractVersion: string }>;
  listSuppressions(input: {
    anonymousCustomerReference: string;
    channel: CampaignChannel;
    at: string;
  }): Promise<readonly SuppressionFact[]>;
}

export interface MasterDataMarketingReferencePort {
  listCampaignTypes(): Promise<readonly MarketingReference[]>;
  listSalesChannels(): Promise<readonly MarketingReference[]>;
  listAcquaintanceMethods(): Promise<readonly MarketingReference[]>;
  validateCurrency(currencyCode: string): Promise<boolean>;
}

export interface CustomerAffairsHandoffPort {
  handoffAttributedLead(input: {
    campaignReference: string;
    publicLeadReference: string;
    touchpointReference: string;
    occurredAt: string;
  }): Promise<void>;
}

export interface SalesOfferIntentPort {
  publishOfferIntent(input: {
    offerReference: string;
    campaignReference: string;
    couponReference: string | null;
    constraintsVersion: number;
    validUntil: string;
  }): Promise<{ status: 'PROPOSED'; salesIntentReference: string }>;
}

export interface FinanceMarketingCostPort {
  requestCostReference(input: {
    campaignReference: string;
    amount: MarketingMoney;
    vendorReference: string;
    occurredAt: string;
  }): Promise<{ financeRequestReference: string; postingStatus: 'NOT_POSTED' }>;
}

export interface MarketingAnalyticsReadPort {
  queryApprovedCampaignFacts(input: {
    campaignReference: string | null;
    startsAt: string;
    endsAt: string;
    grain: 'CAMPAIGN';
  }): Promise<MarketingDashboardProjection>;
}

export interface MarketingReference {
  id: string;
  code: string;
  title: string;
  active: boolean;
  version: number;
}

export interface MarketingDispatchIntent {
  campaignReference: string;
  segmentReference: string;
  channel: CampaignChannel;
  templateIntentReference: string;
  consentCheckedAt: string;
  suppressionCheckedAt: string;
  frequencyCapVersion: number;
  requestedAt: string;
}
