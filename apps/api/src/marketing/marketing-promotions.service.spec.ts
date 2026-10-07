import type {
  AuthenticatedActor,
  MarketingAssetInputV1,
} from '@nora/contracts';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import { MarketingRecordsService } from './marketing-records.service';
import { CustomerService } from '../customers/customer.service';
import type { CustomerRepository } from '../customers/customer.repository';
import type { CustomerContactCrypto } from '../customers/customer-contact.crypto';
import type { CustomerNationalIdProtector } from '../customers/customer-national-id';

const branchId = '33333333-3333-4333-8333-333333333333';
const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: [branchId],
  permissions: ['marketing.read', 'marketing.offer.manage', 'customers.read'],
};
const input: MarketingAssetInputV1 = {
  kind: 'COUPON',
  name: 'تخفیف پایدار',
  status: 'ACTIVE',
  scheduledAt: '2026-10-01T00:00:00Z',
  expiresAt: '2026-11-01T00:00:00Z',
  payload: {
    code: 'TEST-10',
    discountType: 'PERCENT',
    value: '10',
    currencyCode: 'IRR',
    minimumPurchase: '0',
    usageLimit: 100,
    perCustomerLimit: 1,
    service: 'ALL',
    combinability: 'EXCLUSIVE',
    description: '',
  },
};
describe('promotion validation before writes', () => {
  it('resolves public references before acquiring a write transaction connection', async () => {
    let inTransaction = false;
    const stop = new Error('transaction reached');
    const currency = vi.fn(async () => {
      expect(inTransaction).toBe(false);
      return ['IRR'];
    });
    const customer = vi.fn(async () => {
      expect(inTransaction).toBe(false);
      return { id: actor.userId, branchId };
    });
    const service = new MarketingRecordsService(
      {
        client: {
          marketingCommand: { findUnique: vi.fn().mockResolvedValue(null) },
          $transaction: vi.fn(async () => {
            inTransaction = true;
            throw stop;
          }),
        },
      } as unknown as DatabaseService,
      { marketingTargetReference: customer } as unknown as CustomerService,
      {
        activeCurrencyCodes: currency,
      } as unknown as import('../master-data/master-organization-directory').MasterOrganizationDirectory,
    );
    await expect(
      service.saveAsset(
        null,
        { ...input, targetCustomerId: actor.userId },
        actor,
        branchId,
        'preflight',
      ),
    ).rejects.toBe(stop);
    expect(currency).toHaveBeenCalledOnce();
    expect(customer).toHaveBeenCalledOnce();
  });
  it.each([
    { payload: { ...input.payload, value: '-1' } },
    { payload: { ...input.payload, value: '101' } },
    { payload: { ...input.payload, minimumPurchase: '-1' } },
    { payload: { ...input.payload, usageLimit: 1, perCustomerLimit: 2 } },
    { payload: { ...input.payload, description: 'x'.repeat(2001) } },
    { payload: { ...input.payload, phone: '09121234567' } },
    { payload: { ...input.payload, description: 'contact@example.test' } },
    { payload: { ...input.payload, currencyCode: 'irr' } },
    { payload: { ...input.payload, code: 'x' } },
    { targetCustomerId: actor.userId, targetAgencyId: actor.userId },
    { scheduledAt: '2026-11-01T00:00:00Z' },
    { expiresAt: null },
    { scheduledAt: '2026-10-01T00:00:00' },
  ])(
    'rejects invalid form input %# before entering a transaction',
    async (changes) => {
      const transaction = vi.fn();
      const service = new MarketingRecordsService({
        client: { $transaction: transaction },
      } as unknown as DatabaseService);
      await expect(
        service.saveAsset(
          null,
          { ...input, ...changes },
          actor,
          branchId,
          'key',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(transaction).not.toHaveBeenCalled();
    },
  );
  it('requires the offer-specific permission, not only campaign update permission', async () => {
    const transaction = vi.fn();
    const service = new MarketingRecordsService({
      client: { $transaction: transaction },
    } as unknown as DatabaseService);
    await expect(
      service.saveAsset(
        null,
        input,
        {
          ...actor,
          permissions: ['marketing.read', 'marketing.campaign.update'],
        },
        branchId,
        'key',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
describe('Customers public minimal promotion reference', () => {
  function service(row: unknown) {
    const find = vi.fn().mockResolvedValue(row);
    return {
      find,
      customers: new CustomerService(
        { find } as unknown as CustomerRepository,
        {} as CustomerContactCrypto,
        {} as CustomerNationalIdProtector,
      ),
    };
  }
  it('returns only canonical identity and branch, not customer/contact PII', async () => {
    const { find, customers } = service({
      id: 'customer-1',
      ownerBranchId: branchId,
      isActive: true,
      isCustomer: true,
      displayName: 'Secret name',
      contacts: [{ value: 'Secret contact' }],
      consents: [{ purpose: 'MARKETING', status: 'GRANTED' }],
    });
    expect(
      await customers.marketingTargetReference('customer-1', branchId, actor),
    ).toEqual({ id: 'customer-1', branchId });
    expect(find).toHaveBeenCalledWith('customer-1', [branchId]);
  });
  it.each([
    null,
    { isActive: false },
    { isActive: true, isCustomer: false },
    { isActive: true, isCustomer: true, consents: [] },
    {
      isActive: true,
      isCustomer: true,
      consents: [
        { purpose: 'MARKETING', status: 'REVOKED' },
        { purpose: 'MARKETING', status: 'GRANTED' },
      ],
    },
  ])('rejects unavailable or ineligible customers %#', async (row) => {
    await expect(
      service(row).customers.marketingTargetReference(
        'customer-1',
        branchId,
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('checks current customer read permission and branch before repository access', async () => {
    const { find, customers } = service(null);
    await expect(
      customers.marketingTargetReference('customer-1', branchId, {
        ...actor,
        permissions: ['marketing.read'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      customers.marketingTargetReference('customer-1', 'outside', actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(find).not.toHaveBeenCalled();
  });
});
