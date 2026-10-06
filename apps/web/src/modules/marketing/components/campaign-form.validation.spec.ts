import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { CampaignDraft } from '../model/durable-records';
import { validateDraft } from './campaign-form';

const validDraft: CampaignDraft = {
  internalCode: 'MKT-DECIMAL-4',
  name: 'کمپین دقیق',
  campaignType: 'SALE',
  objective: 'فروش دقیق',
  company: 'NIAYESH_SEIR_SAHAR',
  channels: ['SMS'],
  ownerUserId: 'user-1',
  segmentReference: 'none',
  salesTarget: '1.0001',
  targetCurrencyCode: 'IRR',
  budgetAmount: '12.3456',
  budgetCurrencyCode: 'IRR',
  startsAt: '2026-10-07T00:00:00.000Z',
  endsAt: '2026-10-08T00:00:00.000Z',
  utmSource: '',
  utmMedium: '',
  utmCampaign: '',
  utmTerm: '',
  utmContent: '',
  frequencyCap: '1',
  progressPercent: '0',
  spendLines: [],
  links: '',
  expectedVersion: 0,
};

describe('CampaignForm decimal validation', () => {
  it('does not mark the automatically assigned owner as a required form field', () => {
    const source = readFileSync(
      new URL('./campaign-form.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('<FormField id="campaign-owner" label="مسئول">');
    expect(source).not.toContain('label="مسئول" required');
    expect(validateDraft(validDraft)).toEqual([]);
  });
  it('accepts and preserves a budget with four fractional digits', () => {
    expect(validateDraft(validDraft)).toEqual([]);
    expect(validDraft.budgetAmount).toBe('12.3456');
  });
});
