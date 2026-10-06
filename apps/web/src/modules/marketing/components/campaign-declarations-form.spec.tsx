import { renderToStaticMarkup } from 'react-dom/server';
import { isValidElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CampaignCard } from './marketing-workspace';
import {
  campaignDraftFromPreview,
  sumSpendByCurrency,
} from '../model/durable-records';
import type { CampaignPreview } from '../model/marketing';
import {
  CampaignDeclarationsForm,
  campaignDeclarationsInput,
  validateDeclarations,
} from './campaign-declarations-form';

const campaign: CampaignPreview = {
  id: 'campaign',
  internalCode: 'CMP-LEGACY',
  name: 'کمپین',
  campaignType: 'SALE',
  objective: 'فروش',
  channels: ['SMS'],
  audienceSummary: '',
  segmentReference: 'segment',
  startsAt: '2026-10-01T00:00:00.000Z',
  endsAt: '2026-11-01T00:00:00.000Z',
  budgetAmount: '100.25',
  spendAmount: '1',
  currencyCode: 'IRR',
  attributedRevenue: null,
  ownerRole: 'owner',
  ownerUserId: 'owner',
  salesTarget: '200',
  progressPercent: '10',
  executionCompany: 'JAHAN_BASTAN',
  offerTitle: '',
  couponCode: null,
  utmCampaign: 'campaign',
  utmSource: 'source',
  frequencyCap: '2',
  status: 'RUNNING',
  version: 7,
  updatedAt: '2026-10-02T00:00:00.000Z',
  spendLines: [
    { id: 'persisted-line', label: 'قبلی', amount: '1', currencyCode: 'IRR' },
  ],
  links: ['https://example.test/original'],
};

describe('campaign declarations', () => {
  it('exposes a working icon-only declarations action beside the existing red operation', () => {
    const onDetails = vi.fn();
    const tree = CampaignCard({
      campaign,
      disabled: false,
      onOpen: vi.fn(),
      onToggleActive: vi.fn(),
      onDetails,
    });
    const actions: Record<string, unknown>[] = [];
    const visit = (node: ReactNode): void => {
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (!isValidElement<{ children?: ReactNode }>(node)) return;
      const props = node.props as Record<string, unknown>;
      if (props['aria-label']) actions.push(props);
      visit(node.props.children);
    };
    visit(tree);
    const action = actions.find((item) => item.title === 'ثبت جزئیات')!;
    expect(action.size).toBe('icon');
    (action.onClick as () => void)();
    expect(onDetails).toHaveBeenCalledOnce();
    expect(actions[1]?.title).toBe('غیرفعال‌سازی');
    expect(renderToStaticMarkup(tree)).toContain(
      'aria-label="ثبت جزئیات کمپین"',
    );
  });
  it('changes only declarations, preserves campaign references and CAS version, and omits expense database IDs', () => {
    const draft = campaignDraftFromPreview(campaign, 'other');
    draft.name = 'must not overwrite';
    draft.ownerUserId = 'must not reassign';
    draft.progressPercent = '44.125';
    draft.spendLines.push({
      label: ' طراحی ',
      amount: '999999999999999999.1251',
      currencyCode: 'USD',
    });
    draft.links = 'https://example.test/new\nhttps://example.test/second';
    const input = campaignDeclarationsInput(campaign, draft);
    expect(input).toMatchObject({
      name: campaign.name,
      ownerUserId: 'owner',
      segmentId: 'segment',
      budgetAmount: '100.25',
      utmSource: 'source',
      expectedVersion: 7,
      progressPercent: '44.125',
      links: ['https://example.test/new', 'https://example.test/second'],
    });
    expect(input.spendLines).toEqual([
      { label: 'قبلی', amount: '1', currencyCode: 'IRR' },
      {
        label: 'طراحی',
        amount: '999999999999999999.1251',
        currencyCode: 'USD',
      },
    ]);
  });
  it('validates only declarations, allowing existing legacy codes', () => {
    expect(
      validateDeclarations(campaignDraftFromPreview(campaign, 'owner')),
    ).toEqual([]);
    for (const progressPercent of ['-1', '101', '1.12345', ''])
      expect(
        validateDeclarations({ progressPercent, spendLines: [], links: '' })
          .length,
      ).toBeGreaterThan(0);
    for (const amount of ['-1', '1e5', 'NaN', '1.12345', ''])
      expect(
        validateDeclarations({
          progressPercent: '0',
          spendLines: [{ label: 'هزینه', amount, currencyCode: 'IRR' }],
          links: '',
        }).length,
      ).toBeGreaterThan(0);
    expect(
      validateDeclarations({
        progressPercent: '100',
        spendLines: [{ label: ' ', amount: '1', currencyCode: 'IRR' }],
        links: 'javascript:alert(1)',
      }).length,
    ).toBeGreaterThan(0);
    expect(
      validateDeclarations({
        progressPercent: '0',
        spendLines: [],
        links: Array(31).fill('https://example.test').join('\n'),
      }).length,
    ).toBeGreaterThan(0);
  });
  it('computes exact actual expense separately per currency', () => {
    expect(
      sumSpendByCurrency([
        { amount: '999999999999999999.0001', currencyCode: 'IRR' },
        { amount: '0.9999', currencyCode: 'IRR' },
        { amount: '2.5', currencyCode: 'USD' },
      ]),
    ).toEqual([
      { amount: '1000000000000000000', currencyCode: 'IRR' },
      { amount: '2.5', currencyCode: 'USD' },
    ]);
  });
  it('renders a dedicated RTL form with progress, expense title/amount/currency, links and an icon-only save', () => {
    const html = renderToStaticMarkup(
      <CampaignDeclarationsForm campaign={campaign} onSave={async () => {}} />,
    );
    for (const label of [
      'dir="rtl"',
      'پیشرفت هدف',
      'عنوان هزینه',
      'مبلغ',
      'ارز',
      'هزینه واقعی',
      'لینک‌ها',
      'aria-label="ثبت جزئیات کمپین"',
    ])
      expect(html).toContain(label);
    expect(html).not.toContain('هدف فروش');
  });
});
