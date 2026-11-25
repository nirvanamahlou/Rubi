import {
  createHmac,
  createHash,
  timingSafeEqual,
  randomUUID,
} from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { DatabaseService } from '../../database/database.service';

export type VerifiedGatewayProof = {
  version: 1;
  provider: 'SAMAN';
  terminalId: string;
  reference: string;
  bankReference: string;
  amount: string;
  currencyCode: 'IRR';
  verifiedAt: string;
  signature: string;
};
type Binding = {
  userId: string;
  branchId: string;
  terminalId: string;
  accountId: string;
  secret: string;
};
export type GatewaySettlement = Omit<VerifiedGatewayProof, 'signature'> & {
  accountId: string;
  branchId: string;
};
export type GatewayReceipt = {
  id: string;
  amount: string;
  currencyCode: string;
  method: string;
  paymentReference?: string | null;
  destinationAccountId?: string | null;
};
type Confirmation = {
  version: 1;
  eventId: string;
  contractId: string;
  paymentId: string;
  financePaymentReference: string;
  receiptAccountId: string;
  confirmedAt: string;
  reviewedByUserId: string;
  reason: string;
};

/** Only the bank-verifying server can attest these immutable, order-bound facts. */
export function gatewayProofMessage(
  site: string,
  externalId: string,
  proof: VerifiedGatewayProof,
) {
  return JSON.stringify([
    'v1',
    site,
    externalId,
    proof.provider,
    proof.terminalId,
    proof.reference,
    proof.bankReference,
    proof.amount,
    proof.currencyCode,
    proof.verifiedAt,
  ]);
}

@Injectable()
export class VerifiedGatewayReceiptPublic {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  private binding(
    site: string,
    actor: AuthenticatedActor,
    raw = process.env.SITE_GATEWAY_SETTLEMENTS ?? '{}',
  ) {
    let binding: Binding | undefined;
    try {
      const values: unknown = JSON.parse(raw);
      if (
        values &&
        typeof values === 'object' &&
        !Array.isArray(values) &&
        Object.hasOwn(values, site)
      )
        binding = (values as Record<string, Binding>)[site];
    } catch {
      /* Fail closed; configuration and secrets never reach clients. */
    }
    if (
      !binding ||
      binding.userId !== actor.userId ||
      !actor.branchIds.includes(binding.branchId) ||
      typeof binding.secret !== 'string' ||
      binding.secret.length < 64 ||
      !binding.accountId
    )
      throw new ForbiddenException('اتصال تسویه درگاه تنظیم نشده است.');
    return binding;
  }

  private async assertDestination(
    binding: Pick<Binding, 'accountId' | 'branchId'>,
  ) {
    const account =
      await this.database.client.financeSettlementAccount.findFirst({
        where: {
          id: binding.accountId,
          branchId: binding.branchId,
          currencyCode: 'IRR',
          isActive: true,
          deletedAt: null,
          isExternal: false,
          kind: 'BANK',
        },
        select: { id: true },
      });
    if (!account)
      throw new ConflictException('حساب متصل به درگاه فعال یا معتبر نیست.');
  }

  async destination(site: string, actor: AuthenticatedActor) {
    const binding = this.binding(site, actor);
    await this.assertDestination(binding);
    return { branchId: binding.branchId, terminalId: binding.terminalId };
  }

  async resolve(
    site: string,
    externalId: string,
    proof: VerifiedGatewayProof,
    actor: AuthenticatedActor,
    raw = process.env.SITE_GATEWAY_SETTLEMENTS ?? '{}',
  ): Promise<GatewaySettlement> {
    const binding = this.binding(site, actor, raw);
    if (
      !proof ||
      proof.version !== 1 ||
      proof.provider !== 'SAMAN' ||
      proof.currencyCode !== 'IRR' ||
      proof.terminalId !== binding.terminalId ||
      typeof proof.amount !== 'string' ||
      !/^\d{1,16}$/.test(proof.amount) ||
      BigInt(proof.amount) <= 0n ||
      typeof proof.reference !== 'string' ||
      !proof.reference.trim() ||
      proof.reference.length > 100 ||
      typeof proof.bankReference !== 'string' ||
      !proof.bankReference.trim() ||
      proof.bankReference.length > 100 ||
      typeof proof.verifiedAt !== 'string' ||
      !Number.isFinite(Date.parse(proof.verifiedAt)) ||
      Date.parse(proof.verifiedAt) > Date.now() + 60_000 ||
      typeof proof.signature !== 'string' ||
      !/^[a-f0-9]{64}$/.test(proof.signature)
    )
      throw new BadRequestException('تأیید بانکی درگاه معتبر نیست.');
    const expected = createHmac('sha256', binding.secret)
      .update(gatewayProofMessage(site, externalId, proof))
      .digest();
    if (!timingSafeEqual(expected, Buffer.from(proof.signature, 'hex')))
      throw new ForbiddenException('امضای تأیید بانکی معتبر نیست.');
    await this.assertDestination(binding);
    return {
      version: 1,
      provider: 'SAMAN',
      terminalId: proof.terminalId,
      reference: proof.reference,
      bankReference: proof.bankReference,
      amount: proof.amount,
      currencyCode: 'IRR',
      verifiedAt: proof.verifiedAt,
      accountId: binding.accountId,
      branchId: binding.branchId,
    };
  }

  /** Finance owns destination validation and emits its native, idempotent Sales confirmation. */
  async confirm(
    contractId: string,
    receipt: GatewayReceipt,
    settlement: GatewaySettlement,
    actor: AuthenticatedActor,
    apply: (
      event: Confirmation,
    ) => Promise<'confirmed' | 'replayed' | 'not-found'>,
  ) {
    if (
      !actor.branchIds.includes(settlement.branchId) ||
      !receipt?.id ||
      receipt.method !== 'ONLINE_GATEWAY' ||
      receipt.paymentReference !== settlement.reference ||
      receipt.currencyCode !== settlement.currencyCode ||
      !new Prisma.Decimal(receipt.amount).eq(settlement.amount) ||
      (receipt.destinationAccountId &&
        receipt.destinationAccountId !== settlement.accountId)
    )
      throw new ConflictException(
        'رسید بانکی با قرارداد و حساب درگاه مطابقت ندارد.',
      );
    // Re-read account state immediately before the native transaction. Native confirmation
    // locks and validates the receipt, rejects void/correction and prevents duplicate posting.
    await this.assertDestination(settlement);
    const result = await apply({
      version: 1,
      eventId: randomUUID(),
      contractId,
      paymentId: receipt.id,
      financePaymentReference: `SEP-${createHash('sha256')
        .update(settlement.terminalId + ':' + settlement.bankReference)
        .digest('hex')
        .slice(0, 40)}`,
      receiptAccountId: settlement.accountId,
      confirmedAt: settlement.verifiedAt,
      reviewedByUserId: actor.userId,
      reason:
        'تأیید خودکار بانک سامان؛ تطبیق مبلغ، ترمینال، مرجع و امضای رسید سایت',
    });
    if (result === 'not-found')
      throw new ConflictException('رسید بانکی قرارداد پیدا نشد.');
    return result;
  }
}
