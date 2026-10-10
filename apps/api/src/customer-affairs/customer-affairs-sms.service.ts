import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedActor } from '@nora/contracts';
import { CustomerAffairsRepository } from './customer-affairs.repository';
import { CustomerAffairsService } from './customer-affairs.service';

const hash = (input: string) =>
  createHash('sha256').update(input).digest('hex');
@Injectable()
export class CustomerAffairsSmsService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(CustomerAffairsRepository)
    private readonly repository: CustomerAffairsRepository,
    @Inject(CustomerAffairsService)
    private readonly affairs: CustomerAffairsService,
  ) {}

  async send(
    ticketId: string,
    input: { mobile: string; message: string },
    key: string | undefined,
    actor: AuthenticatedActor,
  ) {
    await this.affairs.getTicket(ticketId, actor);
    const apiKey = this.config.get<string>('SMSIR_API_KEY');
    const lineNumber = Number(this.config.get<string>('SMSIR_LINE_NUMBER'));
    if (
      this.config.get<string>('CUSTOMER_AFFAIRS_SMS_ENABLED') !== 'true' ||
      !apiKey ||
      !Number.isSafeInteger(lineNumber) ||
      lineNumber <= 0
    )
      throw new ServiceUnavailableException(
        'ارسال پیامک هنوز پیکربندی نشده است.',
      );
    const senders = (
      this.config.get<string>('CUSTOMER_AFFAIRS_SMS_SENDERS') ?? ''
    )
      .split(',')
      .map((id) => id.trim());
    if (!senders.includes(actor.userId))
      throw new ForbiddenException(
        'مجوز ارسال پیامک برای این کاربر فعال نیست.',
      );
    if (!key || key.length < 16 || key.length > 160)
      throw new BadRequestException('کلید یکتای ارسال معتبر الزامی است.');
    const mobile = input.mobile.replace(/^\+98/, '0');
    if (
      !/^09\d{9}$/.test(mobile) ||
      input.message.trim().length < 2 ||
      input.message.length > 1000
    )
      throw new BadRequestException('گیرنده یا متن پیام معتبر نیست.');
    const deliveryKey = `smsir:${hash(`${ticketId}:${actor.userId}:${key}`)}`;
    const fingerprint = hash(`${key}:${mobile}:${input.message}`);
    const scope = 'smsir.send.v1';
    const claim = await this.repository.transaction(async (tx) => {
      const lock = await tx.customerAffairsCommand.createMany({
        data: [
          {
            actorUserId: actor.userId,
            scope,
            idempotencyKey: deliveryKey,
            requestFingerprint: fingerprint,
            resultEntityId: ticketId,
          },
        ],
        skipDuplicates: true,
      });
      if (!lock.count) {
        const prior = await tx.customerAffairsCommand.findUniqueOrThrow({
          where: {
            actorUserId_scope_idempotencyKey: {
              actorUserId: actor.userId,
              scope,
              idempotencyKey: deliveryKey,
            },
          },
        });
        if (prior.requestFingerprint !== fingerprint)
          throw new ConflictException(
            'کلید ارسال برای پیام دیگری استفاده شده است.',
          );
        const existing = await tx.customerAffairsTimeline.findUniqueOrThrow({
          where: { deliveryKey },
        });
        return { fresh: false, row: existing };
      }
      const row = await tx.customerAffairsTimeline.create({
        data: {
          ticketId,
          type: 'MESSAGE',
          summary: input.message,
          channel: 'SMS',
          recipientReference: `***${mobile.slice(-4)}`,
          customerVisible: true,
          deliveryStatus: 'PENDING',
          deliveryKey,
          outcome: 'SMSIR_SUBMITTING',
          actorUserId: actor.userId,
          documentVersionIds: [],
        },
      });
      return { fresh: true, row };
    });
    if (!claim.fresh)
      return {
        data: {
          id: claim.row.id,
          status: claim.row.deliveryStatus,
          replay: true,
        },
      };

    // Persist the claim before network I/O. Uncertain requests are never automatically resent.
    let status = 'UNKNOWN';
    let outcome = 'SMSIR_UNCERTAIN';
    try {
      const response = await fetch('https://api.sms.ir/v1/send/bulk', {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          lineNumber,
          messageText: input.message,
          mobiles: [mobile],
          sendDateTime: null,
        }),
      });
      const result = (await response.json()) as {
        status?: number;
        data?: { messageIds?: unknown[] };
      };
      const messageId = result.data?.messageIds?.[0];
      if (
        response.ok &&
        result.status === 1 &&
        typeof messageId === 'number' &&
        Number.isSafeInteger(messageId) &&
        messageId > 0
      ) {
        status = 'ACCEPTED';
        outcome = `SMSIR:${messageId}`;
      } else if (response.status >= 400 && response.status < 500) {
        status = 'FAILED';
        outcome = 'SMSIR_REJECTED';
      } else if (
        response.ok &&
        typeof result.status === 'number' &&
        result.status !== 1
      ) {
        status = 'FAILED';
        outcome = 'SMSIR_REJECTED';
      }
    } catch {
      /* Timeout/invalid response may occur after acceptance. Preserve uncertainty. */
    }
    await this.repository.transaction((tx) =>
      tx.customerAffairsTimeline.update({
        where: { id: claim.row.id },
        data: { deliveryStatus: status, outcome },
      }),
    );
    return { data: { id: claim.row.id, status, replay: false } };
  }
}
