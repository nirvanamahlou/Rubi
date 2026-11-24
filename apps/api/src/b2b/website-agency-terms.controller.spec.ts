import { describe, expect, it, vi } from 'vitest';
import { WebsiteAgencyTermsController } from './website-agency-terms.controller';

describe('website agency terms', () => {
  it('requires a unique approved website account before reading agreements', async () => {
    const terms = vi.fn();
    const service = new WebsiteAgencyTermsController(
      { client: { agencyOperationalProfile: { findFirst: terms } } } as never,
      { activeWebsiteAccount: vi.fn().mockResolvedValue(null) } as never,
    );
    await expect(
      service.terms('nss', 'fixture-account', { actor: {} } as never),
    ).rejects.toMatchObject({ status: 404 });
    expect(terms).not.toHaveBeenCalled();
  });

  it('uses the resolved branch and organization and returns public terms only', async () => {
    const terms = vi.fn().mockResolvedValue({
      agreements: [
        {
          code: 'fixture-agreement',
          title: 'Synthetic',
          startsAt: new Date('2024-01-01'),
          endsAt: null,
        },
      ],
      agreedRates: [
        {
          code: 'fixture-rate',
          title: 'Synthetic',
          kind: 'FIXED_AMOUNT',
          value: { toString: () => '100.40' },
          currencyCode: 'EUR',
          validTo: null,
        },
      ],
    });
    const service = new WebsiteAgencyTermsController(
      { client: { agencyOperationalProfile: { findFirst: terms } } } as never,
      {
        activeWebsiteAccount: vi
          .fn()
          .mockResolvedValue({
            organizationId: 'fixture-org',
            branchId: 'fixture-branch',
          }),
      } as never,
    );
    const response = await service.terms('nss', 'fixture-account', {
      actor: {},
    } as never);
    expect(terms.mock.calls[0]?.[0].where).toMatchObject({
      branchId: 'fixture-branch',
      organizationId: 'fixture-org',
      role: 'AGENCY',
      status: 'ACTIVE',
    });
    expect(
      terms.mock.calls[0]?.[0].select.agreements.where.activeRevision.status,
    ).toBe('APPROVED');
    expect(response.data.rates[0]?.value).toBe('100.40');
  });
});
