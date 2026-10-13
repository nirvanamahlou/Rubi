import { describe, expect, it } from 'vitest';

import { createMarketingMoney } from './marketing.decimal';
import {
  assertAuditMetadataSafe,
  canTransitionCampaign,
  evaluateAudienceEligibility,
  sanitizeMarketingText,
  transitionCampaign,
  validateAttributionTouchpoint,
  validateCampaign,
  validateCoupon,
  validateDispatchIntent,
  validateSegmentDefinition,
  type AttributionTouchpoint,
  type Campaign,
  type CampaignStatus,
  type CouponDefinition,
  type SegmentDefinition,
} from './marketing.domain';

const campaign: Campaign = {
  id: 'preview-campaign-001',
  internalCode: 'MKT-NOWRUZ-01',
  name: 'کمپین نمونه نوروز',
  campaignTypeReference: 'preview-campaign-type-seasonal',
  objective: 'آگاهی از برند',
  channels: ['SMS', 'EMAIL'],
  segmentReference: 'preview-segment-loyal',
  executionCompany: 'NIAYESH_SEIR_SAHAR',
  ownerReference: 'preview-actor-marketing',
  startsAt: '2026-09-10T08:00:00.000Z',
  endsAt: '2026-09-20T20:00:00.000Z',
  budget: createMarketingMoney('10000000', 'IRR'),
  spend: createMarketingMoney('2500000', 'IRR'),
  status: 'DRAFT',
  version: 1,
  updatedAt: '2026-09-01T08:00:00.000Z',
};

const transitionContext = {
  expectedVersion: 1,
  actorReference: 'preview-actor-marketing',
  actorPermissions: ['marketing.campaign.update'],
  reason: 'آماده بررسی اولیه',
  occurredAt: '2026-09-02T08:00:00.000Z',
};

describe('campaign lifecycle', () => {
  it('validates a campaign and applies a permitted versioned transition', () => {
    expect(() => validateCampaign(campaign)).not.toThrow();
    const result = transitionCampaign(
      campaign,
      'READY_FOR_APPROVAL',
      transitionContext,
    );
    expect(result.campaign).toMatchObject({
      status: 'READY_FOR_APPROVAL',
      version: 2,
    });
    expect(result.event).toMatchObject({
      fromStatus: 'DRAFT',
      toStatus: 'READY_FOR_APPROVAL',
      version: 2,
    });
  });

  it('defines every allowed lifecycle edge and blocks bypasses', () => {
    const allowed: Readonly<Record<CampaignStatus, readonly CampaignStatus[]>> =
      {
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
    for (const [current, targets] of Object.entries(allowed)) {
      for (const target of Object.keys(allowed) as CampaignStatus[]) {
        expect(canTransitionCampaign(current as CampaignStatus, target)).toBe(
          targets.includes(target),
        );
      }
    }
    expect(() =>
      transitionCampaign(campaign, 'RUNNING', {
        ...transitionContext,
        actorPermissions: ['marketing.campaign.execute'],
      }),
    ).toThrow('cannot transition');
  });

  it('enforces optimistic locking and transition permissions', () => {
    expect(() =>
      transitionCampaign(campaign, 'READY_FOR_APPROVAL', {
        ...transitionContext,
        expectedVersion: 9,
      }),
    ).toThrow('expectedVersion');
    expect(() =>
      transitionCampaign(campaign, 'READY_FOR_APPROVAL', {
        ...transitionContext,
        actorPermissions: [],
      }),
    ).toThrow('deny-by-default');
  });

  it('rejects invalid date ranges and budget inconsistencies', () => {
    expect(() =>
      validateCampaign({ ...campaign, endsAt: campaign.startsAt }),
    ).toThrow('date range');
    expect(() =>
      validateCampaign({
        ...campaign,
        spend: createMarketingMoney('10000001', 'IRR'),
      }),
    ).toThrow('cannot exceed');
    expect(() =>
      validateCampaign({
        ...campaign,
        spend: createMarketingMoney('1', 'USD'),
      }),
    ).toThrow('same currency');
  });
});

describe('audience safety', () => {
  const safeEligibility = {
    channel: 'SMS' as const,
    consent: {
      status: 'GRANTED' as const,
      channel: 'SMS' as const,
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveUntil: null,
      contractVersion: 'customers.consent.v2',
    },
    suppressions: [],
    recentTouchpointTimes: ['2026-09-01T08:00:00.000Z'],
    frequencyCap: { maximumMessages: 2, windowHours: 24 },
    now: '2026-09-02T07:00:00.000Z',
  };

  it('requires valid channel consent before a send intent', () => {
    expect(evaluateAudienceEligibility(safeEligibility)).toEqual({
      eligible: true,
      reasonCodes: [],
    });
    expect(
      evaluateAudienceEligibility({ ...safeEligibility, consent: null }),
    ).toMatchObject({ eligible: false, reasonCodes: ['CONSENT_REQUIRED'] });
  });

  it('enforces global and channel suppression', () => {
    const result = evaluateAudienceEligibility({
      ...safeEligibility,
      suppressions: [
        {
          kind: 'GLOBAL_SUPPRESSION' as const,
          channel: null,
          reasonCode: 'preview-unsubscribe',
          effectiveFrom: '2026-09-01T00:00:00.000Z',
          effectiveUntil: null,
        },
      ],
    });
    expect(result).toMatchObject({ eligible: false });
    expect(result.reasonCodes).toContain('SUPPRESSED');
  });

  it('enforces the frequency cap inside its UTC window', () => {
    const result = evaluateAudienceEligibility({
      ...safeEligibility,
      recentTouchpointTimes: [
        '2026-09-02T01:00:00.000Z',
        '2026-09-02T02:00:00.000Z',
      ],
    });
    expect(result.reasonCodes).toContain('FREQUENCY_CAP_REACHED');
  });
});

describe('segment, coupon and attribution rules', () => {
  const segment: SegmentDefinition = {
    id: 'preview-segment-001',
    name: 'مشتریان وفادار نمونه',
    match: 'ALL',
    criteria: [
      { field: 'TRIP_COUNT', operator: 'GREATER_THAN', value: 2 },
      {
        field: 'MARKETING_CONSENT_STATUS',
        operator: 'EQUALS',
        value: 'GRANTED',
      },
    ],
    customerContractVersion: 'customers.audience-read.v1-proposal',
    storesRawPii: false,
    version: 1,
  };

  it('accepts only allowlisted segment definitions without raw PII', () => {
    expect(() => validateSegmentDefinition(segment)).not.toThrow();
    expect(() =>
      validateSegmentDefinition({
        ...segment,
        criteria: [
          {
            field: 'RAW_PHONE' as never,
            operator: 'EQUALS',
            value: 'preview',
          },
        ],
      }),
    ).toThrow('sensitive field');
  });

  const coupon: CouponDefinition = {
    code: 'NOWRUZ_20',
    discountType: 'PERCENTAGE',
    discountValue: '20',
    currencyCode: null,
    minimumPurchase: createMarketingMoney('1000000', 'IRR'),
    maximumDiscount: createMarketingMoney('500000', 'IRR'),
    validFrom: '2026-09-01T00:00:00.000Z',
    validUntil: '2026-10-01T00:00:00.000Z',
    capacity: 100,
    usageCount: 4,
    customerLimit: 1,
    serviceTypeReferences: ['FLIGHT'],
    status: 'DRAFT',
    version: 1,
  };

  it('validates coupon percentage, capacity and service restrictions', () => {
    expect(() => validateCoupon(coupon)).not.toThrow();
    expect(() => validateCoupon({ ...coupon, discountValue: '101' })).toThrow(
      'at most 100',
    );
    expect(() => validateCoupon({ ...coupon, usageCount: 101 })).toThrow(
      'capacity',
    );
  });

  it.each(['FIRST_TOUCH', 'LAST_TOUCH', 'LINEAR', 'MANUAL_REVIEWED'] as const)(
    'keeps %s financial attribution explicitly proposed',
    (model) => {
      const touchpoint: AttributionTouchpoint = {
        id: 'preview-touchpoint-001',
        campaignReference: 'preview-campaign-001',
        source: 'website',
        medium: 'banner',
        utmCampaign: 'nowruz_2026',
        utmSource: 'website',
        utmMedium: 'banner',
        utmContent: null,
        utmTerm: null,
        occurredAt: '2026-09-02T08:00:00.000Z',
        anonymousReference: 'preview-anonymous-001',
        customerReference: null,
        leadReference: null,
        salesContractReference: null,
        model,
        financialStatus: 'PROPOSED',
      };
      expect(() => validateAttributionTouchpoint(touchpoint)).not.toThrow();
    },
  );
});

describe('content, audit and future dispatch safety', () => {
  it('escapes HTML and neutralizes spreadsheet formulas', () => {
    expect(sanitizeMarketingText('<script>alert(1)</script>').htmlSafe).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
    expect(sanitizeMarketingText('=HYPERLINK("x")').formulaSafe).toBe(
      '\'=HYPERLINK("x")',
    );
  });

  it('rejects raw PII in audit metadata', () => {
    expect(() =>
      assertAuditMetadataSafe({ campaignReference: 'preview-campaign-001' }),
    ).not.toThrow();
    expect(() =>
      assertAuditMetadataSafe({ email: 'user@example.test' }),
    ).toThrow('raw PII');
    expect(() =>
      assertAuditMetadataSafe({ note: 'user@example.test' }),
    ).toThrow('raw PII');
  });

  it('requires idempotency and recent safety-check timestamps for dispatch', () => {
    expect(() =>
      validateDispatchIntent({
        idempotencyKey: 'marketing:intent:preview-001',
        requestFingerprint: 'a'.repeat(64),
        campaignReference: 'preview-campaign-001',
        segmentReference: 'preview-segment-001',
        channel: 'EMAIL',
        consentCheckedAt: '2026-09-02T08:00:00.000Z',
        suppressionCheckedAt: '2026-09-02T08:00:00.000Z',
      }),
    ).not.toThrow();
    expect(() =>
      validateDispatchIntent({
        idempotencyKey: 'short',
        requestFingerprint: 'bad',
        campaignReference: 'preview-campaign-001',
        segmentReference: 'preview-segment-001',
        channel: 'EMAIL',
        consentCheckedAt: '2026-09-02T08:00:00.000Z',
        suppressionCheckedAt: '2026-09-02T08:00:00.000Z',
      }),
    ).toThrow('idempotency');
  });
});
