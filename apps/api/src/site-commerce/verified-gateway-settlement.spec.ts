import { describe, expect, it, vi } from 'vitest';
import { SiteCommerceService } from './site-commerce.service';
import type {
  AuthenticatedActor,
  SalesPaymentCreateRequest,
} from '@nora/contracts';
import type {
  GatewayReceipt,
  GatewaySettlement,
} from '../finance/payments/verified-gateway-receipt.public';
type Mock = ReturnType<typeof vi.fn>;
type Harness = {
  paid: SiteCommerceService['paid'];
  order: Mock;
  db: {
    client: { websiteOrder: { updateMany: Mock; findUniqueOrThrow: Mock } };
  };
  sales: { detail: Mock; addPayment: Mock; applyFinancePaymentConfirmed: Mock };
  gatewayReceipts: { resolve: Mock; confirm: Mock };
  releaseSettledWebsiteDocuments: Mock;
  status: Mock;
};
const actor = {
  userId: 'site-user',
  branchIds: ['branch'],
  permissions: [],
} as AuthenticatedActor;
const proof = {
  version: 1,
  provider: 'SAMAN',
  terminalId: '123456',
  reference: 'synthetic-ref',
  bankReference: 'synthetic-digital-receipt',
  amount: '17100',
  currencyCode: 'IRR',
  verifiedAt: '2026-01-01T00:00:00Z',
  signature: 'a'.repeat(64),
} as const;
const payment = {
  amount: '17100',
  currencyCode: 'IRR',
  method: 'ONLINE_GATEWAY',
  paymentReference: 'synthetic-ref',
  dueAt: '2026-01-01T00:00:00Z',
} as SalesPaymentCreateRequest;
function fixture() {
  const service = Object.create(SiteCommerceService.prototype) as Harness;
  const row = {
    id: 'link',
    contractId: 'contract',
    paymentFingerprint: null as string | null,
    paymentCommands: null as unknown,
  };
  const receipt = { ...payment, id: 'receipt' };
  const contract = {
    id: 'contract',
    version: 1,
    status: 'SENT_TO_RESERVATIONS',
    balances: [{ amount: '17100', currencyCode: 'IRR' }],
    payments: [receipt],
  };
  service.order = vi.fn().mockResolvedValue({ row, scoped: actor });
  service.db = {
    client: {
      websiteOrder: {
        updateMany: vi
          .fn()
          .mockImplementation(async ({ data }: { data: object }) =>
            Object.assign(row, data),
          ),
        findUniqueOrThrow: vi.fn().mockResolvedValue(row),
      },
    },
  };
  service.sales = {
    detail: vi.fn().mockResolvedValue({ data: contract }),
    addPayment: vi.fn(),
    applyFinancePaymentConfirmed: vi.fn().mockResolvedValue('confirmed'),
  };
  service.gatewayReceipts = {
    resolve: vi.fn().mockResolvedValue({
      ...proof,
      accountId: 'mapped-bank',
      branchId: 'branch',
    }),
    confirm: vi
      .fn()
      .mockImplementation(
        async (
          _id: string,
          receipt: GatewayReceipt,
          gateway: GatewaySettlement,
          _actor: AuthenticatedActor,
          apply: (event: unknown) => Promise<unknown>,
        ) =>
          apply({ paymentId: receipt.id, receiptAccountId: gateway.accountId }),
      ),
  };
  service.releaseSettledWebsiteDocuments = vi.fn();
  service.status = vi.fn().mockResolvedValue({
    data: {
      paymentStatus: 'paid',
      hasConfirmedPayment: true,
      fullySettled: true,
    },
  });
  return { service, row, contract };
}
describe('Verified site gateway orchestration', () => {
  it('uses native receipt identity and account, then existing full-settlement document guard', async () => {
    const f = fixture();
    const result = await f.service.paid(
      'nss',
      'order',
      [payment],
      actor,
      proof,
    );
    expect(f.service.sales.applyFinancePaymentConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'receipt',
        receiptAccountId: 'mapped-bank',
      }),
    );
    expect(f.service.releaseSettledWebsiteDocuments).toHaveBeenCalledWith(
      f.row,
      actor,
    );
    expect(result.data.fullySettled).toBe(true);
  });
  it('retains ordinary manual Finance review for unsigned receipts', async () => {
    const f = fixture();
    await f.service.paid('nss', 'order', [payment], actor);
    expect(f.service.gatewayReceipts.resolve).not.toHaveBeenCalled();
    expect(f.service.sales.applyFinancePaymentConfirmed).not.toHaveBeenCalled();
    expect(f.service.releaseSettledWebsiteDocuments).not.toHaveBeenCalled();
  });
  it('rejects invalid proof before receipt creation', async () => {
    const f = fixture();
    f.service.gatewayReceipts.resolve.mockRejectedValue(Error('signature'));
    await expect(
      f.service.paid('nss', 'order', [payment], actor, proof),
    ).rejects.toThrow('signature');
    expect(f.service.sales.addPayment).not.toHaveBeenCalled();
  });
  it('rejects cross-account payment before receipt creation', async () => {
    const f = fixture();
    await expect(
      f.service.paid(
        'nss',
        'order',
        [{ ...payment, destinationAccountId: 'wrong' }],
        actor,
        proof,
      ),
    ).rejects.toThrow();
    expect(f.service.sales.addPayment).not.toHaveBeenCalled();
  });
  it('does not open documents if native financial confirmation fails', async () => {
    const f = fixture();
    f.service.sales.applyFinancePaymentConfirmed.mockRejectedValue(
      Error('voided'),
    );
    await expect(
      f.service.paid('nss', 'order', [payment], actor, proof),
    ).rejects.toThrow('voided');
    expect(f.service.releaseSettledWebsiteDocuments).not.toHaveBeenCalled();
  });
  it('retries the same frozen native command and receipt after an interrupted confirmation', async () => {
    const f = fixture();
    f.service.sales.applyFinancePaymentConfirmed
      .mockRejectedValueOnce(Error('temporary'))
      .mockResolvedValue('confirmed');
    await expect(
      f.service.paid('nss', 'order', [payment], actor, proof),
    ).rejects.toThrow('temporary');
    const first = f.service.sales.addPayment.mock.calls[0];
    await f.service.paid('nss', 'order', [payment], actor, proof);
    expect(f.service.sales.addPayment.mock.calls[1]).toEqual(first);
    expect(
      f.service.sales.applyFinancePaymentConfirmed.mock.calls.map(
        (c) => c[0].paymentId,
      ),
    ).toEqual(['receipt', 'receipt']);
  });
  it('rejects cancelled contract without creating a receipt', async () => {
    const f = fixture();
    f.contract.status = 'CANCELLED';
    await expect(
      f.service.paid('nss', 'order', [payment], actor, proof),
    ).rejects.toThrow();
    expect(f.service.sales.addPayment).not.toHaveBeenCalled();
  });
});
