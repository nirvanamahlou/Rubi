import { createHmac } from 'node:crypto';
import type { AuthenticatedActor } from '@nora/contracts';
import { Prisma } from '@nora/database';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import {
  gatewayProofMessage,
  VerifiedGatewayReceiptPublic,
  type VerifiedGatewayProof,
} from '../finance/payments/verified-gateway-receipt.public';
import type { LegalEntitiesService } from '../legal-entities/legal-entities.service';
import { stableFingerprint } from './site-commerce.policy';
import { WebsiteContractPayments } from './website-contract-payments';

const attempt = 'a'.repeat(40);
const secret = 'k'.repeat(64);
const input = {
  contractNumber: 'LEGACY-847',
  customerName: 'مسافر آزمایشی',
  amount: '15051',
};
const actor = {
  userId: 'nss-user',
  branchIds: ['branch'],
  permissions: [],
} as unknown as AuthenticatedActor;
const operator = {
  ...actor,
  permissions: ['sales.contracts.read.branch', 'sales.payments.read'],
} as AuthenticatedActor;

function setup(selection = 'NIYAYESH_SEIR_SAHAR') {
  vi.stubEnv(
    'SITE_COMMERCE_BINDINGS',
    JSON.stringify({ nss: { userId: actor.userId, branchId: 'branch' } }),
  );
  vi.stubEnv(
    'SITE_GATEWAY_SETTLEMENTS',
    JSON.stringify({
      nss: {
        userId: actor.userId,
        branchId: 'branch',
        terminalId: '123',
        accountId: 'bank',
        secret,
      },
    }),
  );
  const records = new Map();
  const findMany = vi.fn(async () => [...records.values()]);
  const upsert = vi.fn(async ({ where, create }) => {
    const row = records.get(where.attempt);
    if (row) return row;
    const created = {
      ...create,
      id: 'record',
      receiptNumber: 1n,
      amountRial: new Prisma.Decimal(create.amountRial),
    };
    records.set(where.attempt, created);
    return created;
  });
  const db = {
    client: {
      financeSettlementAccount: {
        findFirst: vi.fn(async () => ({ id: 'bank' })),
      },
      websiteContractPayment: { upsert, findMany },
    },
  } as unknown as DatabaseService;
  const service = new WebsiteContractPayments(
    db,
    new VerifiedGatewayReceiptPublic(db),
    {
      current: vi.fn(async () => ({ data: { selection } })),
    } as unknown as LegalEntitiesService,
  );
  const proof: VerifiedGatewayProof = {
    version: 1,
    provider: 'SAMAN',
    terminalId: '123',
    currencyCode: 'IRR',
    reference: '456123',
    bankReference: 'TEST-REF',
    amount: input.amount,
    verifiedAt: new Date().toISOString(),
    signature: '',
  };
  proof.signature = createHmac('sha256', secret)
    .update(
      gatewayProofMessage(
        'nss',
        `guest:${stableFingerprint(input)}:${attempt}`,
        proof,
      ),
    )
    .digest('hex');
  return { service, proof, upsert, findMany, records };
}

afterEach(() => vi.unstubAllEnvs());

describe('Niyayesh contract payment intake', () => {
  it('keeps a standalone receipt for a customer-entered reference and repeats safely', async () => {
    const { service, proof, records, findMany } = setup();
    expect(await service.prepare('nss', input, actor)).toEqual({
      data: { target: stableFingerprint(input), terminalId: '123' },
    });
    const settlement = { ...input, attempt, gatewayReceipt: proof };
    await expect(service.settle('nss', settlement, actor)).resolves.toEqual({
      data: { state: 'recorded' },
    });
    await expect(service.settle('nss', settlement, actor)).resolves.toEqual({
      data: { state: 'recorded' },
    });
    expect(records.size).toBe(1);
    await expect(service.list(actor)).rejects.toThrow();
    const list = await service.list(operator, 'LEGACY-847');
    expect(list.data[0]).toMatchObject({
      receiptNumber: 'NSS-P-00000001',
      contractNumber: 'LEGACY-847',
      seller: 'سایت نیایش',
      trackingNumber: '456123',
      amountRial: '15051',
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId: { in: ['branch'] },
          contractNumber: { equals: 'LEGACY-847', mode: 'insensitive' },
        },
      }),
    );
  });

  it.each(['JAHAN_BASTAN', 'GHESATI_RO', 'ALL'])(
    'denies listing and reference lookup in %s despite shared branch and permissions',
    async (company) => {
      const { service, findMany } = setup(company);
      const authorized = {
        ...operator,
        permissions: [...operator.permissions, 'legal-entity.aggregate.read'],
      } as AuthenticatedActor;
      await expect(service.list(authorized)).rejects.toMatchObject({
        status: 403,
      });
      await expect(
        service.list(authorized, input.contractNumber),
      ).rejects.toMatchObject({ status: 403 });
      expect(findMany).not.toHaveBeenCalled();
    },
  );

  it('rejects altered contract details, amounts and integration identities before a write', async () => {
    const { service, proof, upsert } = setup();
    const settlement = { ...input, attempt, gatewayReceipt: proof };
    await expect(
      service.settle('nss', { ...settlement, contractNumber: 'WRONG' }, actor),
    ).rejects.toThrow();
    await expect(
      service.settle('nss', { ...settlement, amount: '100000' }, actor),
    ).rejects.toThrow();
    await expect(
      service.settle('nss', settlement, { ...actor, userId: 'other' }),
    ).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });
});
