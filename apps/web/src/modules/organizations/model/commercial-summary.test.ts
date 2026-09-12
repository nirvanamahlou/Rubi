import { describe, expect, it, vi } from 'vitest';
import type { B2bAgreementCaseV1 } from '@rubi/contracts';
import { agencyClient } from '../api/agency-client';
import {
  isCurrentAgreement,
  loadCommercialSummary,
} from './commercial-summary';

const agreement = (id: string, endsAt: string | null = null) =>
  ({
    id,
    status: 'ACTIVE',
    activeRevisionId: id,
    revisions: [{ id, status: 'APPROVED', startsAt: '2026-01-01', endsAt }],
  }) as B2bAgreementCaseV1;
const permissions = [
  'b2b.agency.read',
  'b2b.agreement.read',
  'b2b.credit.read',
] as const;

describe('commercial directory public connections', () => {
  it('counts only effective approved revisions, including the end date', () => {
    expect(isCurrentAgreement(agreement('a', '2026-09-11'), '2026-09-11')).toBe(
      true,
    );
    expect(isCurrentAgreement(agreement('a', '2026-09-10'), '2026-09-11')).toBe(
      false,
    );
    expect(
      isCurrentAgreement(
        { ...agreement('a'), activeRevisionId: null },
        '2026-09-11',
      ),
    ).toBe(false);
    expect(
      isCurrentAgreement({ ...agreement('a'), status: 'DRAFT' }, '2026-09-11'),
    ).toBe(false);
  });
  it('reads later pages, deduplicates and forwards organization, branch and corporate role', async () => {
    const profileDetails = vi.fn();
    const agreements = vi
      .fn()
      .mockImplementation(async (_org, _branch, _role, page) => ({
        data:
          page === 1
            ? [agreement('a')]
            : [
                agreement('a'),
                agreement('b'),
                agreement('expired', '2026-01-02'),
              ],
        meta: { totalPages: 2 },
      }));
    const client = { ...agencyClient, profileDetails, agreements };
    const result = await loadCommercialSummary(
      'org',
      'branch',
      'CORPORATE_CUSTOMER',
      permissions,
      () => true,
      client,
      '2026-09-11',
    );
    expect(result.agreements).toBe('۲');
    expect(profileDetails).not.toHaveBeenCalled();
    expect(agreements).toHaveBeenLastCalledWith(
      'org',
      'branch',
      'CORPORATE_CUSTOMER',
      2,
    );
  });
  it('preserves partial success and never substitutes zero on failure', async () => {
    const client = {
      ...agencyClient,
      profileDetails: vi.fn().mockResolvedValue({
        data: {
          profile: { accountManagerUserId: 'user' },
          accountManagers: [{ id: 'user', displayName: 'Manager' }],
        },
      }),
      agreements: vi.fn().mockRejectedValue(new Error('unavailable')),
    };
    expect(
      await loadCommercialSummary(
        'org',
        'branch',
        'AGENCY',
        permissions,
        () => true,
        client,
      ),
    ).toEqual({ manager: 'Manager', agreements: 'دریافت ناموفق' });
  });
  it('does not call protected endpoints without permissions or after cancellation', async () => {
    const client = {
      ...agencyClient,
      profileDetails: vi.fn(),
      agreements: vi.fn(),
    };
    expect(
      await loadCommercialSummary(
        'org',
        'branch',
        'AGENCY',
        [],
        () => true,
        client,
      ),
    ).toEqual({ manager: 'نیاز به دسترسی', agreements: 'نیاز به دسترسی' });
    await loadCommercialSummary(
      'org',
      'branch',
      'CORPORATE_CUSTOMER',
      permissions,
      () => false,
      client,
    );
    expect(client.profileDetails).not.toHaveBeenCalled();
    expect(client.agreements).not.toHaveBeenCalled();
  });
});
