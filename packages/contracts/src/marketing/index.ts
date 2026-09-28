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
  'marketing.content.manage',
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

export const MARKETING_CONTENT_ASSET_KINDS = [
  'campaign-banner',
  'brochure',
  'catalog',
  'landing-asset',
  'brand-identity',
  'media-plan',
] as const;
export type MarketingContentAssetKind =
  (typeof MARKETING_CONTENT_ASSET_KINDS)[number];

export interface MarketingContentAssetV1 {
  documentId: string;
  title: string;
  description: string | null;
  branchId: string;
  kind: MarketingContentAssetKind;
  archiveCode: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: string;
  createdAt: string;
}

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
