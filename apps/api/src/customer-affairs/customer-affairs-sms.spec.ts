import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomerAffairsSmsService } from './customer-affairs-sms.service';
const actor = { userId: 'sender', branchIds: ['branch'] };
const input = { mobile: '09120000000', message: 'پیگیری درخواست شما' };
const key = 'test-request-key-0001';
function setup(enabled = true) {
  const config: Record<string, string> = {
    CUSTOMER_AFFAIRS_SMS_ENABLED: String(enabled),
    SMSIR_API_KEY: 'test-only-key',
    SMSIR_LINE_NUMBER: '30000000',
    CUSTOMER_AFFAIRS_SMS_SENDERS: 'sender',
  };
  const tx = {
    customerAffairsCommand: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn(),
    },
    customerAffairsTimeline: {
      create: vi.fn().mockResolvedValue({ id: 'message' }),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
  };
  const affairs = { getTicket: vi.fn().mockResolvedValue({ data: {} }) };
  const service = new CustomerAffairsSmsService(
    { get: (key: string) => config[key] } as never,
    { transaction: (fn: (tx: unknown) => unknown) => fn(tx) } as never,
    affairs as never,
  );
  return { service, tx, affairs, config };
}
afterEach(() => vi.unstubAllGlobals());
describe('sms.ir ticket transport', () => {
  it('fails closed before persistence/network when disabled or sender is not approved', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const enabled of [false, true]) {
      const { service, tx, config } = setup(enabled);
      config.CUSTOMER_AFFAIRS_SMS_SENDERS = '';
      await expect(
        service.send('ticket', input, key, actor as never),
      ).rejects.toThrow();
      expect(tx.customerAffairsCommand.createMany).not.toHaveBeenCalled();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('posts only to the fixed provider endpoint and records acceptance, not delivery', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 1, data: { messageIds: [1234] } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const { service, tx } = setup();
    expect(
      (await service.send('ticket', input, key, actor as never)).data.status,
    ).toBe('ACCEPTED');
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.sms.ir/v1/send/bulk',
    );
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body).mobiles).toEqual([
      input.mobile,
    ]);
    expect(tx.customerAffairsTimeline.update).toHaveBeenCalledWith({
      where: { id: 'message' },
      data: { deliveryStatus: 'ACCEPTED', outcome: 'SMSIR:1234' },
    });
    expect(
      JSON.stringify(tx.customerAffairsTimeline.create.mock.calls),
    ).not.toContain(input.mobile);
  });
  it('persists an uncertain timeout without automatically retrying the charged request', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('timeout'));
    vi.stubGlobal('fetch', fetchMock);
    const { service } = setup();
    expect(
      (await service.send('ticket', input, key, actor as never)).data.status,
    ).toBe('UNKNOWN');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it('replays the persisted result without making another provider request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 1, data: { messageIds: [1234] } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const { service, tx } = setup();
    await service.send('ticket', input, key, actor as never);
    const fingerprint =
      tx.customerAffairsCommand.createMany.mock.calls[0]?.[0].data[0]
        .requestFingerprint;
    tx.customerAffairsCommand.createMany.mockResolvedValue({ count: 0 });
    tx.customerAffairsCommand.findUniqueOrThrow.mockResolvedValue({
      requestFingerprint: fingerprint,
    });
    tx.customerAffairsTimeline.findUniqueOrThrow.mockResolvedValue({
      id: 'message',
      deliveryStatus: 'ACCEPTED',
    });
    expect(
      (await service.send('ticket', input, key, actor as never)).data.replay,
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    await expect(
      service.send(
        'ticket',
        { ...input, message: 'پیام متفاوت' },
        key,
        actor as never,
      ),
    ).rejects.toThrow();
  });
  it('propagates a persisted-claim failure before sending externally', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { service, tx } = setup();
    tx.customerAffairsCommand.createMany.mockRejectedValue(
      new Error('db failure'),
    );
    await expect(
      service.send('ticket', input, key, actor as never),
    ).rejects.toThrow('db failure');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
