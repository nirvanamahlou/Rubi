import type {
  MarketingAssetViewV1,
  MarketingCampaignViewV1,
} from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  automationDraftFromAsset,
  automationInputFromDraft,
  campaignDraftFromPreview,
  campaignInputFromDraft,
  campaignPreviewFromRecord,
  contentDraftFromAsset,
  contentInputFromDraft,
  ensureCampaignPublicationAttempt,
  executeCampaignPublication,
  sumSpendByCurrency,
} from './durable-records';

const campaign: MarketingCampaignViewV1 = {
  contractVersion: 'marketing.records.v1',
  id: 'campaign-1',
  branchId: 'branch-1',
  internalCode: 'MKT-ROUNDTRIP',
  name: 'کمپین پایدار',
  campaignType: 'SALE',
  objective: 'فروش قابل سنجش',
  executionCompany: 'NIAYESH_SEIR_SAHAR',
  channels: ['SMS', 'EMAIL'],
  ownerUserId: 'user-1',
  segmentId: 'segment-1',
  salesTarget: '999999999999999999.125',
  targetCurrencyCode: 'USD',
  budgetAmount: '123456789012345678.25',
  budgetCurrencyCode: 'IRR',
  startsAt: '2026-10-01T00:00:00.000Z',
  endsAt: '2026-11-01T00:00:00.000Z',
  utmSource: 'newsletter',
  utmMedium: 'email',
  utmCampaign: 'autumn',
  utmTerm: 'business-class',
  utmContent: 'hero-a',
  frequencyCap: 4,
  progressPercent: '12.375',
  spendLines: [
    {
      id: 's1',
      label: 'رسانه',
      amount: '999999999999999999.0001',
      currencyCode: 'IRR',
    },
    { id: 's2', label: 'طراحی', amount: '0.9999', currencyCode: 'IRR' },
    { id: 's3', label: 'ابزار', amount: '20.25', currencyCode: 'USD' },
  ],
  links: ['https://example.test/a/b?x=1'],
  status: 'ACTIVE',
  publicationRequestedAt: '2026-09-30T00:00:00.000Z',
  scheduledFor: null,
  version: 7,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
  declaredByUserId: 'user-1',
  declaredAt: '2026-10-02T00:00:00.000Z',
  externalPublicationStatus: 'UNAVAILABLE',
};

describe('durable Marketing form adapters', () => {
  it('round-trips every populated campaign field and preserves exact mixed-currency amounts', () => {
    const preview = campaignPreviewFromRecord(campaign, [
      { id: 'segment-1', name: 'مشتریان وفادار' },
    ]);
    const input = campaignInputFromDraft(
      campaignDraftFromPreview(preview, 'user-other'),
      preview,
    );

    expect(preview.audienceSummary).toBe('مشتریان وفادار');
    expect(preview.spendTotals).toEqual([
      { amount: '1000000000000000000', currencyCode: 'IRR' },
      { amount: '20.25', currencyCode: 'USD' },
    ]);
    expect(input).toMatchObject({
      segmentId: campaign.segmentId,
      salesTarget: campaign.salesTarget,
      targetCurrencyCode: 'USD',
      budgetAmount: campaign.budgetAmount,
      budgetCurrencyCode: 'IRR',
      utmSource: campaign.utmSource,
      utmMedium: campaign.utmMedium,
      utmCampaign: campaign.utmCampaign,
      utmTerm: campaign.utmTerm,
      utmContent: campaign.utmContent,
      spendLines: campaign.spendLines,
      links: campaign.links,
      expectedVersion: 7,
    });
    expect(sumSpendByCurrency(campaign.spendLines ?? [])).toEqual(
      preview.spendTotals,
    );
  });

  it('reuses create and publication keys across lost-response and publish retries', async () => {
    let keys = 0;
    const attempt = ensureCampaignPublicationAttempt(
      null,
      campaign,
      () => `key-${++keys}`,
    );
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValue({ data: campaign });
    const publish = vi
      .fn()
      .mockRejectedValueOnce(new Error('publish unavailable'))
      .mockResolvedValue({ data: { ...campaign, status: 'ACTIVE' } });
    const api = { createCampaign: create, publishCampaign: publish };

    await expect(
      executeCampaignPublication(attempt, campaign, 'branch-1', api),
    ).rejects.toThrow('response lost');
    await expect(
      executeCampaignPublication(attempt, campaign, 'branch-1', api),
    ).rejects.toThrow('publish unavailable');
    await expect(
      executeCampaignPublication(attempt, campaign, 'branch-1', api),
    ).resolves.toMatchObject({ data: { status: 'ACTIVE' } });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.map((call) => call[2])).toEqual([
      'key-1',
      'key-1',
    ]);
    expect(publish.mock.calls.map((call) => call[3])).toEqual([
      'key-2',
      'key-2',
    ]);
  });

  it('keeps HTTP(S) short-link fields separate through edit and save', () => {
    const asset: MarketingAssetViewV1 = {
      contractVersion: 'marketing.records.v1',
      id: 'link-1',
      branchId: 'branch-1',
      kind: 'SHORT_LINK',
      name: 'لینک',
      status: 'ACTIVE',
      payload: {
        targetUrl: 'https://example.test/a/b?x=1',
        shortUrl: 'https://n.example/x/y',
        clicks: '12',
        conversions: '3',
      },
      version: 4,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      externalExecutionStatus: 'UNAVAILABLE',
    };
    expect(
      contentInputFromDraft('links', contentDraftFromAsset(asset)),
    ).toMatchObject({
      expectedVersion: 4,
      payload: asset.payload,
    });
  });

  it('keeps graph identity, version and all four selected ports on edit', () => {
    const asset: MarketingAssetViewV1 = {
      contractVersion: 'marketing.records.v1',
      id: 'automation-1',
      branchId: 'branch-1',
      kind: 'AUTOMATION',
      name: 'سفر',
      status: 'DRAFT',
      payload: {
        nodes: [
          { id: 'a', title: 'شروع' },
          { id: 'b', title: 'پایان' },
        ],
        edges: [
          { source: 'a', target: 'b', sourcePort: 'top', targetPort: 'bottom' },
        ],
      },
      version: 5,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      externalExecutionStatus: 'UNAVAILABLE',
    };
    expect(
      automationInputFromDraft(automationDraftFromAsset(asset)),
    ).toMatchObject({
      expectedVersion: 5,
      payload: asset.payload,
    });
  });
});
