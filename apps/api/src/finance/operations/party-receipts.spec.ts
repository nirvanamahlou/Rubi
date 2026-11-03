import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../../database/database.service';
import { FinancePartyReceipts } from './party-receipts';
const mocks = vi.hoisted(() => ({
  balance: vi.fn(),
  replay: vi.fn(),
  persist: vi.fn(),
  search: vi.fn(),
}));
vi.mock('../../sales/party-receipts.public', () => ({
  lockPartyContracts: vi.fn(),
  partyContractBalance: mocks.balance,
  partyReceiptReplay: mocks.replay,
  persistPartyReceipt: mocks.persist,
  contractParties: mocks.search,
}));
vi.mock('../accounting/financial-event.public', () => ({
  recordFinancialEvent: vi.fn(),
  financialDate: () => '2026-01-01',
}));
vi.mock('../accounting/sales-contract-accounting.public', () => ({
  captureSalesContractAccounting: vi.fn(),
}));
const branch = '11111111-1111-4111-8111-111111111111',
  payer = '22222222-2222-4222-8222-222222222222';
const command = {
  operationId: '33333333-3333-4333-8333-333333333333',
  branchId: branch,
  payerId: payer,
  accountId: '44444444-4444-4444-8444-444444444444',
  revision: 'a'.repeat(64),
  amount: '650',
  currencyCode: 'USD',
  reference: 'bank',
};
const actor = {
  userId: 'actor',
  branchIds: [branch],
  permissions: ['finance.read', 'finance.receipt.approve'],
} as unknown as AuthenticatedActor;
function setup() {
  const tx = {
    $queryRaw: vi.fn(),
    financeSettlementAccount: {
      findFirst: vi.fn().mockResolvedValue({ title: 'Bank' }),
    },
  };
  const transaction = vi.fn(async (fn: (t: unknown) => unknown) => fn(tx));
  return {
    tx,
    transaction,
    service: new FinancePartyReceipts({
      client: { $transaction: transaction },
    } as unknown as DatabaseService),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.replay.mockResolvedValue(null);
  mocks.balance.mockResolvedValue({ revision: command.revision });
  mocks.persist.mockResolvedValue({
    operationId: command.operationId,
    allocations: [],
  });
});
describe('Finance party receipt command', () => {
  it('requires receipt permission and exact branch access before entering a transaction', async () => {
    const { service, transaction } = setup();
    await expect(
      service.receive(command, {
        ...actor,
        permissions: ['finance.read'],
      } as AuthenticatedActor),
    ).rejects.toThrow('مجوز');
    await expect(
      service.receive(command, { ...actor, branchIds: [] }),
    ).rejects.toThrow('مجوز');
    expect(transaction).not.toHaveBeenCalled();
  });
  it('serializes the operation and payer rows, checks the preview, then writes inside one serializable transaction', async () => {
    const { service, tx, transaction } = setup();
    await service.receive(command, actor);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mocks.persist).toHaveBeenCalledOnce();
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
      timeout: 30000,
    });
  });
  it('replays a known operation before the stale preview check and never creates another payment', async () => {
    const { service } = setup();
    mocks.replay.mockResolvedValue({
      operationId: command.operationId,
      allocations: [{ amount: '650' }],
    });
    expect((await service.receive(command, actor)).allocations).toHaveLength(1);
    expect(mocks.balance).not.toHaveBeenCalled();
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it('rejects stale balance and inactive/wrong-currency accounts', async () => {
    const { service, tx } = setup();
    mocks.balance.mockResolvedValueOnce({ revision: 'stale' });
    await expect(service.receive(command, actor)).rejects.toThrow('تغییر');
    tx.financeSettlementAccount.findFirst.mockResolvedValueOnce(null);
    await expect(service.receive(command, actor)).rejects.toThrow('حساب مقصد');
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it.each(['0', '-1', '10000000000000000', '1.00001', '1e5'])(
    'rejects invalid amount %s',
    async (amount) => {
      const { service, transaction } = setup();
      await expect(
        service.receive({ ...command, amount }, actor),
      ).rejects.toThrow();
      expect(transaction).not.toHaveBeenCalled();
    },
  );
  it('returns the committed same-operation receipt after a serialization loser rolls back', async () => {
    const { service, transaction } = setup();
    transaction.mockRejectedValueOnce({ code: 'P2034' });
    const result = {
      operationId: command.operationId,
      allocations: [{ amount: '650' }],
    };
    mocks.replay.mockResolvedValue(result);
    expect(await service.receive(command, actor)).toEqual(result);
    expect(mocks.persist).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(2);
  });
  it('does not hide financial capture failure or report a successful partial receipt', async () => {
    const { service } = setup();
    mocks.persist.mockRejectedValue(new Error('event failed'));
    await expect(service.receive(command, actor)).rejects.toThrow(
      'event failed',
    );
  });
  it.each([
    { code: 'P2010', meta: { code: '40001' } },
    {
      code: 'P2010',
      meta: { driverAdapterError: { cause: { originalCode: '40001' } } },
    },
  ])(
    'recovers the committed receipt after a raw PostgreSQL conflict: %j',
    async (failure) => {
      const { service, transaction } = setup();
      transaction.mockRejectedValueOnce(failure);
      const result = {
        operationId: command.operationId,
        allocations: [{ amount: '650' }],
      };
      mocks.replay.mockResolvedValue(result);
      expect(await service.receive(command, actor)).toEqual(result);
      expect(mocks.persist).not.toHaveBeenCalled();
      expect(transaction).toHaveBeenCalledTimes(2);
    },
  );
});
