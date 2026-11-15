import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { CustomerService } from '../customers/customer.service';
import type { AuthenticatedRequest } from '../iam/iam.types';
import type { IamService } from '../iam/iam.service';
import type { SiteCommerceService } from './site-commerce.service';
import { SiteCommerceController } from './site-commerce.controller';

const actor = {
  userId: 'site-user',
  sessionId: 'session',
  branchIds: ['headquarters', 'other'],
  permissions: ['sales.contracts.create'],
};
const body = {
  kind: 'person' as const,
  firstName: 'Synthetic',
  lastName: 'Passenger',
  displayName: 'Synthetic Passenger',
  roles: ['passenger' as const],
};
afterEach(() => vi.unstubAllEnvs());
function fixture() {
  vi.stubEnv(
    'SITE_COMMERCE_BINDINGS',
    JSON.stringify({ nss: { userId: actor.userId, branchId: 'headquarters' } }),
  );
  const customers = {
    syncWebsitePassenger: vi
      .fn()
      .mockResolvedValue({
        data: {
          id: 'person',
          displayName: 'Synthetic Passenger',
          nationalId: 'never-return',
        },
      }),
  };
  const controller = new SiteCommerceController(
    {} as SiteCommerceService,
    customers as unknown as CustomerService,
    {} as IamService,
  );
  return { customers, controller };
}
describe('configured website passenger synchronization', () => {
  it('uses the Customers public sync contract and returns only the minimal identity reference', async () => {
    const { customers, controller } = fixture();
    expect(
      await controller.person('nss', body, { actor } as AuthenticatedRequest),
    ).toEqual({ data: { id: 'person', displayName: 'Synthetic Passenger' } });
    expect(customers.syncWebsitePassenger).toHaveBeenCalledWith(
      body,
      { ...actor, branchIds: ['headquarters'] },
      'headquarters',
      'site:nss:passenger-sync',
    );
  });
  it('does not expose sync to another actor or an unconfigured website', async () => {
    const { customers, controller } = fixture();
    await expect(
      controller.person('nss', body, {
        actor: { ...actor, userId: 'other' },
      } as AuthenticatedRequest),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.person('unknown', body, { actor } as AuthenticatedRequest),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(customers.syncWebsitePassenger).not.toHaveBeenCalled();
  });
});
