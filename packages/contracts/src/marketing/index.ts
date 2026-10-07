export const MARKETING_PROCESS_CONTRACT_VERSION =
  'marketing.process.v1' as const;

export const MARKETING_PERMISSION_CODES = [
  'marketing.read',
  'marketing.process.read',
  'marketing.campaign.create',
  'marketing.campaign.update',
  'marketing.campaign.approve',
  'marketing.campaign.schedule',
  'marketing.campaign.execute',
  'marketing.campaign.pause',
  'marketing.campaign.cancel',
  'marketing.audience.read',
  'marketing.audience.manage',
  'marketing.offer.manage',
  'marketing.budget.read',
  'marketing.budget.manage',
  'marketing.cost.record',
  'marketing.attribution.read',
  'marketing.analytics.read',
  'marketing.audit.read',
  'marketing.sensitive_summary.read',
] as const;

export type MarketingPermissionCode =
  (typeof MARKETING_PERMISSION_CODES)[number];

export type MarketingProcessStageKey =
  | 'STRATEGY'
  | 'ACQUISITION'
  | 'SEGMENTATION'
  | 'CRM'
  | 'SALES'
  | 'TRAVEL_SERVICE'
  | 'LOYALTY'
  | 'ANALYTICS';

export type MarketingProcessStageStatus =
  'AVAILABLE' | 'PARTIAL' | 'INFRASTRUCTURE_PENDING';

export interface MarketingProcessActionV1 {
  label: string;
  href: string;
  available: boolean;
}

export interface MarketingProcessStageV1 {
  key: MarketingProcessStageKey;
  order: number;
  title: string;
  ownerModule: string;
  status: MarketingProcessStageStatus;
  description: string;
  trackedFields: readonly string[];
  missingCapabilities: readonly string[];
  action: MarketingProcessActionV1;
}

export interface MarketingProcessProjectionV1 {
  contractVersion: typeof MARKETING_PROCESS_CONTRACT_VERSION;
  generatedAt: string;
  persistenceStatus: 'INFRASTRUCTURE_PENDING';
  stages: readonly MarketingProcessStageV1[];
}

export interface MarketingProcessResponseV1 {
  data: MarketingProcessProjectionV1;
}

export const MARKETING_RECORDS_CONTRACT_VERSION =
  'marketing.records.v1' as const;

export type MarketingCampaignPublicationStatus =
  'DRAFT' | 'ACTIVE' | 'SCHEDULED' | 'PAUSED' | 'CANCELLED';

export interface MarketingDeclaredSpendLineV1 {
  id?: string;
  label: string;
  amount: string;
  currencyCode: string;
}

export interface MarketingCampaignInputV1 {
  internalCode: string;
  name: string;
  campaignType: string;
  objective: string;
  executionCompany: string;
  channels: string[];
  ownerUserId: string;
  segmentId?: string | null;
  salesTarget: string;
  targetCurrencyCode: string;
  budgetAmount: string;
  budgetCurrencyCode: string;
  startsAt: string;
  endsAt: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  frequencyCap: number;
  progressPercent?: string;
  spendLines?: MarketingDeclaredSpendLineV1[];
  links?: string[];
  expectedVersion?: number;
}

export interface MarketingCampaignViewV1 extends MarketingCampaignInputV1 {
  contractVersion: typeof MARKETING_RECORDS_CONTRACT_VERSION;
  id: string;
  branchId: string;
  status: MarketingCampaignPublicationStatus;
  publicationRequestedAt: string | null;
  scheduledFor: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  declaredByUserId: string;
  declaredAt: string;
  externalPublicationStatus: 'UNAVAILABLE';
}

export type MarketingAssetKind =
  | 'SEGMENT'
  | 'MESSAGE'
  | 'SCHEDULE'
  | 'FORM'
  | 'LANDING_PAGE'
  | 'SHORT_LINK'
  | 'AUTOMATION';

export interface MarketingAssetInputV1 {
  kind: MarketingAssetKind;
  name: string;
  status: string;
  campaignId?: string | null;
  relatedAssetId?: string | null;
  scheduledAt?: string | null;
  expiresAt?: string | null;
  payload: Record<string, unknown>;
  expectedVersion?: number;
}

export interface MarketingAssetViewV1 extends MarketingAssetInputV1 {
  contractVersion: typeof MARKETING_RECORDS_CONTRACT_VERSION;
  id: string;
  branchId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  externalExecutionStatus: 'UNAVAILABLE';
}

export interface MarketingSourceCountV1 {
  sourceCategory: string;
  count: number;
}

export interface MarketingSourceCountsResponseV1 {
  contractVersion: typeof MARKETING_RECORDS_CONTRACT_VERSION;
  startsAt: string;
  endsAt: string;
  total: number;
  counts: MarketingSourceCountV1[];
  containsRawPii: false;
}
