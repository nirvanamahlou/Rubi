import { createHmac, randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProcurementSupplierIntegrationService } from './procurement-supplier.integration';

describe('ProcurementSupplierIntegrationService', () => {
  afterEach(() => {
    delete process.env.PROCUREMENT_SUPPLIER_ADAPTER_URL;
    delete process.env.PROCUREMENT_SUPPLIER_ADAPTER_SECRET;
    vi.unstubAllGlobals();
  });

  it('keeps outbound orders queued while the external adapter is not configured', async () => {
    const procurement = { claimConnectionEvents: vi.fn() };
    const service = new ProcurementSupplierIntegrationService(
      {} as never,
      procurement as never,
    );
    await expect(service.dispatch(['branch-a'])).resolves.toEqual({
      configured: false,
      claimed: 0,
      delivered: 0,
      retrying: 0,
    });
    expect(procurement.claimConnectionEvents).not.toHaveBeenCalled();
  });

  it('signs an outbound event and acknowledges successful delivery', async () => {
    process.env.PROCUREMENT_SUPPLIER_ADAPTER_URL =
      'https://supplier.example.test/orders';
    process.env.PROCUREMENT_SUPPLIER_ADAPTER_SECRET = 's'.repeat(32);
    const procurement = {
      claimConnectionEvents: vi
        .fn()
        .mockResolvedValue([
          { eventId: randomUUID(), payload: { orderId: randomUUID() } },
        ]),
      settleConnectionEvent: vi.fn().mockResolvedValue('delivered'),
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const service = new ProcurementSupplierIntegrationService(
      {} as never,
      procurement as never,
    );

    await expect(service.dispatch(['branch-a'])).resolves.toMatchObject({
      configured: true,
      claimed: 1,
      delivered: 1,
      retrying: 0,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://supplier.example.test/orders',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-rubi-signature': expect.stringMatching(/^[0-9a-f]{64}$/),
        }),
      }),
    );
    expect(procurement.settleConnectionEvent).toHaveBeenCalledWith(
      expect.any(String),
      { delivered: true },
    );
  });

  it('rejects unsigned inbound events and accepts a valid signed event', async () => {
    const secret = 's'.repeat(32);
    process.env.PROCUREMENT_SUPPLIER_ADAPTER_SECRET = secret;
    const input = {
      contract: 'procurement.supplier-inbound.v1' as const,
      externalMessageId: 'supplier-event-1',
      eventType: 'ORDER_ACKNOWLEDGED' as const,
      orderReference: randomUUID(),
      occurredAt: new Date().toISOString(),
      payload: {},
    };
    const timestamp = Date.now().toString();
    const database = {
      client: {
        integrationSupplierMessage: {
          create: vi.fn().mockResolvedValue({ id: 'message-1' }),
          update: vi.fn().mockResolvedValue({}),
        },
      },
    };
    const procurement = {
      applySupplierInboundEvent: vi.fn().mockResolvedValue('applied'),
    };
    const service = new ProcurementSupplierIntegrationService(
      database as never,
      procurement as never,
    );

    await expect(
      service.receive(input, timestamp, 'bad'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      database.client.integrationSupplierMessage.create,
    ).not.toHaveBeenCalled();

    const validSignature = createHmac('sha256', secret)
      .update(`${timestamp}.${JSON.stringify(input)}`)
      .digest('hex');
    await expect(
      service.receive(input, timestamp, validSignature),
    ).resolves.toEqual({ accepted: true, duplicate: false });
    expect(procurement.applySupplierInboundEvent).toHaveBeenCalledWith(input);
  });
});
