import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ProcurementSupplierInboundEventV1 } from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { ProcurementPublicService } from '../procurement/procurement-public.service';

@Injectable()
export class ProcurementSupplierIntegrationService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ProcurementPublicService)
    private readonly procurement: ProcurementPublicService,
  ) {}

  async dispatch(branchIds: readonly string[]) {
    const endpoint = process.env.PROCUREMENT_SUPPLIER_ADAPTER_URL?.trim();
    const secret = process.env.PROCUREMENT_SUPPLIER_ADAPTER_SECRET?.trim();
    if (!endpoint || !secret)
      return { configured: false, claimed: 0, delivered: 0, retrying: 0 };
    const events = await this.procurement.claimConnectionEvents(
      branchIds,
      'procurement.supplier-order-intent.v1',
    );
    let delivered = 0;
    let retrying = 0;
    for (const event of events) {
      const body = JSON.stringify({
        contract: 'procurement.supplier-order-intent.v1',
        eventId: event.eventId,
        payload: event.payload,
      });
      const timestamp = Date.now().toString();
      const signature = createHmac('sha256', secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-rubi-timestamp': timestamp,
            'x-rubi-signature': signature,
            'idempotency-key': event.eventId,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        await this.procurement.settleConnectionEvent(event.eventId, {
          delivered: true,
        });
        delivered += 1;
      } catch (error) {
        await this.procurement.settleConnectionEvent(event.eventId, {
          delivered: false,
          errorCode:
            error instanceof Error
              ? error.message.slice(0, 100)
              : 'SUPPLIER_DELIVERY_FAILED',
        });
        retrying += 1;
      }
    }
    return {
      configured: true,
      claimed: events.length,
      delivered,
      retrying,
    };
  }

  async receive(
    input: ProcurementSupplierInboundEventV1,
    timestamp: string | undefined,
    signature: string | undefined,
  ) {
    const secret = process.env.PROCUREMENT_SUPPLIER_ADAPTER_SECRET?.trim();
    if (!secret)
      throw new ServiceUnavailableException(
        'کلید اتصال تأمین‌کننده تنظیم نشده است.',
      );
    this.validate(input);
    const milliseconds = Number(timestamp);
    if (
      !timestamp ||
      !Number.isSafeInteger(milliseconds) ||
      Math.abs(Date.now() - milliseconds) > 5 * 60_000
    )
      throw new ForbiddenException('زمان امضای پیام معتبر نیست.');
    const body = JSON.stringify(input);
    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest();
    let received: Buffer;
    try {
      received = Buffer.from(signature ?? '', 'hex');
    } catch {
      throw new ForbiddenException('امضای پیام معتبر نیست.');
    }
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    )
      throw new ForbiddenException('امضای پیام معتبر نیست.');
    try {
      const row = await this.database.client.integrationSupplierMessage.create({
        data: {
          externalMessageId: input.externalMessageId,
          eventType: input.eventType,
          orderReference: input.orderReference,
          payload: input as unknown as Prisma.InputJsonValue,
        },
      });
      return this.processInbound(row.id, input, false);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing =
          await this.database.client.integrationSupplierMessage.findUnique({
            where: { externalMessageId: input.externalMessageId },
            select: { id: true, status: true },
          });
        if (!existing) throw error;
        if (existing.status === 'PROCESSED')
          return { accepted: true, duplicate: true };
        return this.processInbound(existing.id, input, true);
      }
      throw error;
    }
  }

  private async processInbound(
    rowId: string,
    input: ProcurementSupplierInboundEventV1,
    duplicate: boolean,
  ) {
    const result = await this.procurement.applySupplierInboundEvent(input);
    await this.database.client.integrationSupplierMessage.update({
      where: { id: rowId },
      data: {
        status: result === 'applied' ? 'PROCESSED' : 'REJECTED',
        processedAt: new Date(),
        lastErrorCode: result === 'applied' ? null : 'ORDER_NOT_FOUND',
      },
    });
    return { accepted: result === 'applied', duplicate };
  }

  private validate(input: ProcurementSupplierInboundEventV1) {
    if (
      input?.contract !== 'procurement.supplier-inbound.v1' ||
      !input.externalMessageId?.trim() ||
      input.externalMessageId.length > 160 ||
      ![
        'ORDER_ACKNOWLEDGED',
        'ORDER_REJECTED',
        'SHIPMENT_NOTICE',
        'INVOICE_AVAILABLE',
      ].includes(input.eventType) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        input.orderReference,
      ) ||
      !Number.isFinite(Date.parse(input.occurredAt)) ||
      !input.payload ||
      Array.isArray(input.payload) ||
      typeof input.payload !== 'object'
    )
      throw new BadRequestException('پیام تأمین‌کننده معتبر نیست.');
  }
}
