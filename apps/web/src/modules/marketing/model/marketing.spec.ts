import { describe, expect, it } from 'vitest';

import {
  MARKETING_ANALYTICS_STATUS,
  marketingKpiDefinitions,
  marketingPermissionProposals,
} from '../api/contracts';
import {
  filterAndSortCampaigns,
  marketingAttributionModels,
  marketingCoupons,
  marketingOffers,
  marketingPreviewCampaigns,
  marketingSegments,
  marketingSuppressionSummary,
  marketingTimeline,
  neutralizeSpreadsheetFormula,
  normalizeMarketingCampaignQuery,
  paginateCampaigns,
} from './marketing';
import {
  marketingPreviewItems,
  marketingSections,
  marketingSectionTabs,
} from './reference-data';

describe('marketing preview model', () => {
  it('defines all 18 analytics KPIs without invented values', () => {
    expect(marketingKpiDefinitions).toHaveLength(18);
    expect(new Set(marketingKpiDefinitions.map((kpi) => kpi.key)).size).toBe(
      18,
    );
    expect(
      marketingKpiDefinitions.every(
        (kpi) =>
          kpi.value === null &&
          kpi.status === MARKETING_ANALYTICS_STATUS &&
          kpi.definition.length > 10 &&
          kpi.numerator.length > 3,
      ),
    ).toBe(true);
  });

  it('keeps permission proposals complete and deny-by-default compatible', () => {
    expect(marketingPermissionProposals).toHaveLength(18);
    expect(new Set(marketingPermissionProposals).size).toBe(18);
    expect(
      marketingPermissionProposals.every((value) =>
        value.startsWith('marketing.'),
      ),
    ).toBe(true);
  });

  it('normalizes bounded search and pagination inputs', () => {
    expect(
      normalizeMarketingCampaignQuery({
        search: `  ${'x'.repeat(120)}  `,
        page: -10,
        pageSize: 500,
      }),
    ).toMatchObject({
      search: 'x'.repeat(100),
      page: 1,
      pageSize: 20,
      status: 'ALL',
      channel: 'ALL',
      company: 'ALL',
    });
  });

  it('filters, sorts and paginates campaigns deterministically', () => {
    const results = filterAndSortCampaigns(marketingPreviewCampaigns, {
      company: 'NIAYESH_SEIR_SAHAR',
      channel: 'SMS',
      sortBy: 'name',
      sortDirection: 'asc',
    });
    expect(results).toHaveLength(2);
    expect(results.every((campaign) => campaign.channels.includes('SMS'))).toBe(
      true,
    );
    expect(paginateCampaigns(results, 1, 2)).toHaveLength(2);
    expect(
      filterAndSortCampaigns(marketingPreviewCampaigns, {
        search: 'CMP-1405-040',
      }),
    ).toHaveLength(1);
    expect(
      filterAndSortCampaigns(marketingPreviewCampaigns, {
        startsAfter: '2026-09-21',
        endsBefore: '2026-10-05',
        sortBy: 'startsAt',
        sortDirection: 'asc',
      }).map((campaign) => campaign.id),
    ).toEqual([
      'preview-campaign-dubai',
      'preview-campaign-spring',
      'preview-campaign-retention',
      'preview-campaign-return',
    ]);
  });

  it('uses the exact synthetic campaigns from the marketing reference', () => {
    expect(marketingPreviewCampaigns.map((campaign) => campaign.name)).toEqual([
      'جشنواره تابستان اروپا',
      'پرواز استانبول شهریور',
      'هتل‌های دبی پاییز',
      'تورهای نوروز ۱۴۰۶',
      'بازگشت مشتریان غیرفعال',
    ]);
  });

  it('defines complete reference navigation and populated synthetic subtabs', () => {
    expect(marketingSections).toHaveLength(7);
    expect(Object.keys(marketingSectionTabs)).toHaveLength(6);
    expect(marketingPreviewItems).toHaveLength(23);
    expect(
      marketingPreviewItems.every(
        (item) =>
          item.id.startsWith('preview-') && item.description.length > 10,
      ),
    ).toBe(true);
  });

  it('uses only synthetic preview identifiers and contains no direct contact PII', () => {
    const previewCollections = [
      marketingPreviewCampaigns,
      marketingSegments,
      marketingOffers,
      marketingCoupons,
      marketingAttributionModels,
      marketingTimeline,
      marketingSuppressionSummary,
      marketingPreviewItems,
    ];
    for (const collection of previewCollections) {
      for (const item of collection) {
        expect(item.id).toMatch(/^preview-/);
      }
    }
    const serialized = JSON.stringify(previewCollections);
    expect(serialized).not.toMatch(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
    expect(serialized).not.toMatch(/(?:\+98|0098|0)?9\d{9}/);
  });

  it('neutralizes spreadsheet formula prefixes', () => {
    expect(neutralizeSpreadsheetFormula('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(neutralizeSpreadsheetFormula('+cmd')).toBe("'+cmd");
    expect(neutralizeSpreadsheetFormula('-1')).toBe("'-1");
    expect(neutralizeSpreadsheetFormula('@name')).toBe("'@name");
    expect(neutralizeSpreadsheetFormula('safe text')).toBe('safe text');
  });
});
