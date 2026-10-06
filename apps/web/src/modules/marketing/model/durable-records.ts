import type {
  MarketingAssetInputV1,
  MarketingAssetViewV1,
  MarketingCampaignInputV1,
  MarketingCampaignViewV1,
} from '@nora/contracts';

import {
  campaignChannelLabels,
  type CampaignChannel,
  type CampaignPreview,
  type CampaignStatus,
  type ExecutionCompany,
} from './marketing';

export type MarketingCurrencyCode = 'IRR' | 'USD' | 'EUR';

export interface SegmentOption {
  id: string;
  name: string;
}

export interface CampaignSpendDraft {
  id?: string;
  label: string;
  amount: string;
  currencyCode: MarketingCurrencyCode;
}

export interface CampaignDraft {
  internalCode: string;
  name: string;
  campaignType: string;
  objective: string;
  company: ExecutionCompany;
  channels: CampaignChannel[];
  segmentReference: string;
  startsAt: string;
  endsAt: string;
  budgetAmount: string;
  budgetCurrencyCode: MarketingCurrencyCode;
  targetCurrencyCode: MarketingCurrencyCode;
  ownerUserId: string;
  salesTarget: string;
  progressPercent: string;
  spendLines: CampaignSpendDraft[];
  links: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  frequencyCap: string;
  expectedVersion: number;
}

function decimalToUnits(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,4}))?$/.exec(value);
  if (!match) throw new Error(`Invalid decimal: ${value}`);
  return BigInt(match[1]!) * 10_000n + BigInt((match[2] ?? '').padEnd(4, '0'));
}

function unitsToDecimal(value: bigint): string {
  const integer = value / 10_000n;
  const fraction = String(value % 10_000n)
    .padStart(4, '0')
    .replace(/0+$/, '');
  return fraction ? `${integer}.${fraction}` : String(integer);
}

export function sumSpendByCurrency(
  lines: readonly { amount: string; currencyCode: string }[],
): Array<{ amount: string; currencyCode: string }> {
  const totals = new Map<string, bigint>();
  for (const line of lines)
    totals.set(
      line.currencyCode,
      (totals.get(line.currencyCode) ?? 0n) + decimalToUnits(line.amount),
    );
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currencyCode, amount]) => ({
      currencyCode,
      amount: unitsToDecimal(amount),
    }));
}

export function campaignPreviewFromRecord(
  record: MarketingCampaignViewV1,
  segments: readonly SegmentOption[],
): CampaignPreview {
  const spendTotals = sumSpendByCurrency(record.spendLines ?? []);
  const status: CampaignStatus =
    record.status === 'ACTIVE'
      ? 'RUNNING'
      : record.status === 'SCHEDULED'
        ? 'SCHEDULED'
        : record.status === 'PAUSED'
          ? 'PAUSED'
          : record.status === 'CANCELLED'
            ? 'CANCELLED'
            : 'DRAFT';
  const segment = segments.find((item) => item.id === record.segmentId);
  return {
    id: record.id,
    internalCode: record.internalCode,
    name: record.name,
    campaignType: record.campaignType,
    objective: record.objective,
    channels: record.channels.filter(
      (channel): channel is CampaignChannel => channel in campaignChannelLabels,
    ),
    audienceSummary:
      segment?.name ?? (record.segmentId ? 'سگمنت ثبت‌شده' : 'بدون سگمنت'),
    segmentReference: record.segmentId ?? '',
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    budgetAmount: record.budgetAmount,
    spendAmount:
      spendTotals.find(
        (item) => item.currencyCode === record.budgetCurrencyCode,
      )?.amount ?? '0',
    spendTotals,
    currencyCode: record.budgetCurrencyCode as MarketingCurrencyCode,
    budgetCurrencyCode: record.budgetCurrencyCode as MarketingCurrencyCode,
    targetCurrencyCode: record.targetCurrencyCode as MarketingCurrencyCode,
    attributedRevenue: null,
    ownerRole: record.ownerUserId,
    ownerUserId: record.ownerUserId,
    salesTarget: record.salesTarget,
    progressPercent: record.progressPercent ?? '0',
    links: record.links ?? [],
    spendLines: (record.spendLines ?? []).map((line) => ({
      ...line,
      currencyCode: line.currencyCode,
    })),
    executionCompany: record.executionCompany as ExecutionCompany,
    offerTitle: '—',
    couponCode: null,
    utmSource: record.utmSource ?? '',
    utmMedium: record.utmMedium ?? '',
    utmCampaign: record.utmCampaign ?? '',
    utmTerm: record.utmTerm ?? '',
    utmContent: record.utmContent ?? '',
    frequencyCap: String(record.frequencyCap),
    status,
    version: record.version,
    declaredByUserId: record.declaredByUserId,
    declaredAt: record.declaredAt,
    publicationRequestedAt: record.publicationRequestedAt,
    scheduledFor: record.scheduledFor,
    updatedAt: record.updatedAt,
  };
}

export function campaignDraftFromPreview(
  campaign: CampaignPreview | undefined,
  ownerUserId: string,
): CampaignDraft {
  return {
    internalCode: campaign?.internalCode ?? 'MKT-NEW',
    name: campaign?.name ?? '',
    campaignType: campaign?.campaignType ?? 'فروش فصلی',
    objective: campaign?.objective ?? '',
    company: campaign?.executionCompany ?? 'NIAYESH_SEIR_SAHAR',
    channels: campaign ? [...campaign.channels] : ['WEBSITE'],
    segmentReference: campaign?.segmentReference ?? '',
    startsAt: campaign?.startsAt ?? '',
    endsAt: campaign?.endsAt ?? '',
    budgetAmount: campaign?.budgetAmount ?? '',
    budgetCurrencyCode:
      campaign?.budgetCurrencyCode ?? campaign?.currencyCode ?? 'IRR',
    targetCurrencyCode:
      campaign?.targetCurrencyCode ?? campaign?.currencyCode ?? 'IRR',
    ownerUserId: campaign?.ownerUserId ?? ownerUserId,
    salesTarget: campaign?.salesTarget ?? '',
    progressPercent: campaign?.progressPercent ?? '0',
    spendLines: (campaign?.spendLines ?? []).map((line) => ({
      ...line,
      currencyCode: line.currencyCode as MarketingCurrencyCode,
    })),
    links: campaign?.links?.join('\n') ?? '',
    utmSource: campaign?.utmSource ?? '',
    utmMedium: campaign?.utmMedium ?? '',
    utmCampaign: campaign?.utmCampaign ?? '',
    utmTerm: campaign?.utmTerm ?? '',
    utmContent: campaign?.utmContent ?? '',
    frequencyCap: /^\d+$/.test(campaign?.frequencyCap ?? '')
      ? campaign!.frequencyCap
      : '1',
    expectedVersion: campaign?.version ?? 1,
  };
}

export function campaignInputFromDraft(
  draft: CampaignDraft,
  existing?: CampaignPreview,
): MarketingCampaignInputV1 {
  const date = (value: string) => new Date(value).toISOString();
  return {
    internalCode: draft.internalCode,
    name: draft.name,
    campaignType: draft.campaignType,
    objective: draft.objective,
    executionCompany: draft.company,
    channels: draft.channels,
    ownerUserId: draft.ownerUserId,
    segmentId: draft.segmentReference || null,
    salesTarget: draft.salesTarget,
    targetCurrencyCode: draft.targetCurrencyCode,
    budgetAmount: draft.budgetAmount,
    budgetCurrencyCode: draft.budgetCurrencyCode,
    startsAt: date(draft.startsAt),
    endsAt: date(draft.endsAt),
    utmSource: draft.utmSource || null,
    utmMedium: draft.utmMedium || null,
    utmCampaign: draft.utmCampaign || null,
    utmTerm: draft.utmTerm || null,
    utmContent: draft.utmContent || null,
    frequencyCap: Number(draft.frequencyCap),
    progressPercent: draft.progressPercent,
    spendLines: draft.spendLines.map((line) => ({ ...line })),
    links: draft.links
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean),
    ...(existing ? { expectedVersion: existing.version } : {}),
  };
}

export interface CampaignPublicationAttempt {
  fingerprint: string;
  createKey: string;
  publicationKey: string;
  created?: MarketingCampaignViewV1;
}

export function ensureCampaignPublicationAttempt(
  current: CampaignPublicationAttempt | null,
  input: MarketingCampaignInputV1,
  keyFactory: () => string = () => crypto.randomUUID(),
): CampaignPublicationAttempt {
  const fingerprint = JSON.stringify(input);
  if (current?.fingerprint === fingerprint) return current;
  return {
    fingerprint,
    createKey: keyFactory(),
    publicationKey: keyFactory(),
  };
}

export async function executeCampaignPublication(
  attempt: CampaignPublicationAttempt,
  input: MarketingCampaignInputV1,
  branchId: string,
  api: {
    createCampaign: (
      input: MarketingCampaignInputV1,
      branchId: string,
      key: string,
    ) => Promise<{ data: MarketingCampaignViewV1 }>;
    publishCampaign: (
      id: string,
      version: number,
      scheduledFor: null,
      key: string,
    ) => Promise<{ data: MarketingCampaignViewV1 }>;
  },
) {
  if (!attempt.created)
    attempt.created = (
      await api.createCampaign(input, branchId, attempt.createKey)
    ).data;
  return api.publishCampaign(
    attempt.created.id,
    attempt.created.version,
    null,
    attempt.publicationKey,
  );
}

export type ContentTab = 'forms' | 'landing' | 'links';

export interface ContentDraft {
  id?: string;
  version?: number;
  name: string;
  campaignId: string;
  status: string;
  type: string;
  primary: string;
  metricOne: string;
  metricTwo: string;
  metricThree: string;
  relatedId: string;
  expiresAt: string;
}

export function emptyContentDraft(): ContentDraft {
  return {
    name: '',
    campaignId: 'none',
    status: 'DRAFT',
    type: 'REGISTRATION',
    primary: '',
    metricOne: '',
    metricTwo: '0',
    metricThree: '0',
    relatedId: 'none',
    expiresAt: '',
  };
}

export function contentDraftFromAsset(
  item: MarketingAssetViewV1,
): ContentDraft {
  return {
    id: item.id,
    version: item.version,
    name: item.name,
    campaignId: item.campaignId ?? 'none',
    status: item.status,
    type: String(item.payload.type ?? 'REGISTRATION'),
    primary: String(
      item.payload.landingPage ??
        item.payload.domainUrl ??
        item.payload.targetUrl ??
        '',
    ),
    metricOne: String(
      item.payload.shortUrl ??
        item.payload.completionRate ??
        item.payload.visits ??
        '',
    ),
    metricTwo: String(
      item.payload.responseCount ??
        item.payload.clicks ??
        item.payload.conversions ??
        '0',
    ),
    metricThree: String(
      item.kind === 'LANDING_PAGE'
        ? (item.payload.lastPublishedAt ?? '')
        : item.kind === 'SHORT_LINK'
          ? (item.payload.conversions ?? '0')
          : '',
    ),
    relatedId: item.relatedAssetId ?? 'none',
    expiresAt: item.expiresAt ?? '',
  };
}

export function contentInputFromDraft(
  tab: ContentTab,
  draft: ContentDraft,
): MarketingAssetInputV1 {
  const kind =
    tab === 'forms'
      ? 'FORM'
      : tab === 'landing'
        ? 'LANDING_PAGE'
        : 'SHORT_LINK';
  const payload =
    tab === 'forms'
      ? {
          type: draft.type,
          landingPage: draft.primary,
          completionRate: draft.metricOne,
          responseCount: draft.metricTwo,
        }
      : tab === 'landing'
        ? {
            domainUrl: draft.primary,
            visits: draft.metricOne,
            conversions: draft.metricTwo,
            lastPublishedAt: draft.metricThree,
          }
        : {
            targetUrl: draft.primary,
            shortUrl: draft.metricOne,
            clicks: draft.metricTwo,
            conversions: draft.metricThree,
          };
  return {
    kind,
    name: draft.name,
    status: draft.status,
    campaignId: draft.campaignId === 'none' ? null : draft.campaignId,
    relatedAssetId:
      tab === 'landing' && draft.relatedId !== 'none' ? draft.relatedId : null,
    expiresAt:
      tab === 'links' && draft.expiresAt
        ? new Date(draft.expiresAt).toISOString()
        : null,
    payload,
    ...(draft.version ? { expectedVersion: draft.version } : {}),
  };
}

export type AutomationPort = 'top' | 'right' | 'bottom' | 'left';
export interface AutomationNode {
  id: string;
  title: string;
}
export interface AutomationEdge {
  source: string;
  target: string;
  sourcePort: AutomationPort;
  targetPort: AutomationPort;
}
export interface AutomationDraft {
  id?: string;
  version?: number;
  name: string;
  nodes: AutomationNode[];
  edges: AutomationEdge[];
}

export function automationDraftFromAsset(
  item: MarketingAssetViewV1,
): AutomationDraft {
  return {
    id: item.id,
    version: item.version,
    name: item.name,
    nodes: (item.payload.nodes as AutomationNode[]) ?? [],
    edges: (item.payload.edges as AutomationEdge[]) ?? [],
  };
}

export function automationInputFromDraft(
  draft: AutomationDraft,
): MarketingAssetInputV1 {
  return {
    kind: 'AUTOMATION',
    name: draft.name,
    status: 'DRAFT',
    payload: { nodes: draft.nodes, edges: draft.edges },
    ...(draft.version ? { expectedVersion: draft.version } : {}),
  };
}
