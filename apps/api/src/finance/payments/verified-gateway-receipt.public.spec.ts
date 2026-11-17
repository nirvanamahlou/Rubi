import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import {
  VerifiedGatewayReceiptPublic,
  gatewayProofMessage,
  type VerifiedGatewayProof,
} from './verified-gateway-receipt.public';
const actor = {
  sessionId: 'synthetic-session',
  userId: 'site-user',
  branchIds: ['branch'],
  permissions: [],
} as AuthenticatedActor;
const config = {
  nss: {
    userId: 'site-user',
    branchId: 'branch',
    terminalId: '123456',
    accountId: 'bank-account',
    secret: 'a'.repeat(64),
  },
};
function fixture() {
  const findFirst = vi.fn().mockResolvedValue({ id: 'bank-account' });
  const service = new VerifiedGatewayReceiptPublic({
    client: { financeSettlementAccount: { findFirst } },
  } as never);
  const proof: VerifiedGatewayProof = {
    version: 1,
    provider: 'SAMAN',
    terminalId: '123456',
    reference: 'synthetic-bank-reference',
    bankReference: 'synthetic-digital-receipt',
    amount: '17100',
    currencyCode: 'IRR',
    verifiedAt: '2026-01-01T00:00:00+00:00',
    signature: '',
  };
  const sign = () =>
    (proof.signature = createHmac('sha256', config.nss.secret)
      .update(gatewayProofMessage('nss', 'order', proof))
      .digest('hex'));
  sign();
  const resolve = () =>
    service.resolve('nss', 'order', proof, actor, JSON.stringify(config));
  return { service, proof, findFirst, sign, resolve };
}
describe('Bank-verified gateway Finance boundary', () => {
  it('resolves only the configured active exact-branch IRR company bank account', async () => {
    const f = fixture();
    expect((await f.resolve()).accountId).toBe('bank-account');
    expect(f.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'bank-account',
          branchId: 'branch',
          currencyCode: 'IRR',
          isActive: true,
          deletedAt: null,
          isExternal: false,
          kind: 'BANK',
        }),
      }),
    );
  });
  for (const field of [
    'amount',
    'reference',
    'bankReference',
    'terminalId',
    'verifiedAt',
  ] as const)
    it('rejects tampered ' + field, async () => {
      const f = fixture();
      f.proof[field] =
        field === 'amount'
          ? '18000'
          : field === 'verifiedAt'
            ? '2026-01-02T00:00:00Z'
            : 'changed';
      await expect(f.resolve()).rejects.toThrow();
      expect(f.findFirst).not.toHaveBeenCalled();
    });
  it('binds the proof to the exact external order', async () => {
    const f = fixture();
    await expect(
      f.service.resolve(
        'nss',
        'another-order',
        f.proof,
        actor,
        JSON.stringify(config),
      ),
    ).rejects.toThrow();
  });
  it('binds principal and branch without a generic finance grant', async () => {
    const f = fixture();
    for (const a of [
      { ...actor, userId: 'other' },
      { ...actor, branchIds: ['other'] },
    ])
      await expect(
        f.service.resolve('nss', 'order', f.proof, a, JSON.stringify(config)),
      ).rejects.toThrow();
  });
  it('rejects missing/disabled/wrong-currency account', async () => {
    const f = fixture();
    f.findFirst.mockResolvedValue(null);
    await expect(f.resolve()).rejects.toThrow();
  });
  it('rejects zero, negative and fractional bank amounts', async () => {
    for (const amount of ['0', '-1', '17.1']) {
      const f = fixture();
      f.proof.amount = amount;
      f.sign();
      await expect(f.resolve()).rejects.toThrow();
    }
  });
  it('rejects a signed future verification', async () => {
    const f = fixture();
    f.proof.verifiedAt = new Date(Date.now() + 120000).toISOString();
    f.sign();
    await expect(f.resolve()).rejects.toThrow();
  });
  it('retains durable exact signed facts for late delivery retries', async () => {
    const f = fixture();
    expect((await f.resolve()).verifiedAt).toBe(f.proof.verifiedAt);
  });
  it('uses native posting with the mapped account and preserves its replay result', async () => {
    const f = fixture(),
      gateway = await f.resolve(),
      apply = vi.fn().mockResolvedValue('confirmed');
    const receipt = {
      id: 'receipt',
      amount: '17100.00',
      currencyCode: 'IRR',
      method: 'ONLINE_GATEWAY',
      paymentReference: f.proof.reference,
    };
    expect(
      await f.service.confirm('contract', receipt, gateway, actor, apply),
    ).toBe('confirmed');
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: 'contract',
        paymentId: 'receipt',
        receiptAccountId: 'bank-account',
        confirmedAt: f.proof.verifiedAt,
        reviewedByUserId: 'site-user',
      }),
    );
    apply.mockResolvedValue('replayed');
    expect(
      await f.service.confirm('contract', receipt, gateway, actor, apply),
    ).toBe('replayed');
  });
  for (const changes of [
    { method: 'BANK_TRANSFER' },
    { amount: '17000' },
    { paymentReference: 'other' },
    { currencyCode: 'USD' },
    { destinationAccountId: 'another-account' },
  ])
    it(
      'does not confirm a mismatching native receipt ' +
        JSON.stringify(changes),
      async () => {
        const f = fixture(),
          gateway = await f.resolve(),
          apply = vi.fn();
        await expect(
          f.service.confirm(
            'contract',
            {
              id: 'receipt',
              amount: '17100',
              currencyCode: 'IRR',
              method: 'ONLINE_GATEWAY',
              paymentReference: f.proof.reference,
              ...changes,
            },
            gateway,
            actor,
            apply,
          ),
        ).rejects.toThrow();
        expect(apply).not.toHaveBeenCalled();
      },
    );
  it('propagates native void/correction/concurrency rejection without bypassing it', async () => {
    const f = fixture(),
      gateway = await f.resolve(),
      apply = vi.fn().mockRejectedValue(Error('voided'));
    await expect(
      f.service.confirm(
        'contract',
        {
          id: 'receipt',
          amount: '17100',
          currencyCode: 'IRR',
          method: 'ONLINE_GATEWAY',
          paymentReference: f.proof.reference,
        },
        gateway,
        actor,
        apply,
      ),
    ).rejects.toThrow('voided');
  });
  it('rechecks account before emitting the native event', async () => {
    const f = fixture(),
      gateway = await f.resolve(),
      apply = vi.fn();
    f.findFirst.mockResolvedValue(null);
    await expect(
      f.service.confirm(
        'contract',
        {
          id: 'receipt',
          amount: '17100',
          currencyCode: 'IRR',
          method: 'ONLINE_GATEWAY',
          paymentReference: f.proof.reference,
        },
        gateway,
        actor,
        apply,
      ),
    ).rejects.toThrow();
    expect(apply).not.toHaveBeenCalled();
  });
});
