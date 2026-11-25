import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Injectable,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import {
  VerifiedGatewayReceiptPublic,
  type VerifiedGatewayProof,
} from '../finance/payments/verified-gateway-receipt.public';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { siteBinding, stableFingerprint } from './site-commerce.policy';
import { SiteCommerceWriteGuard } from './site-commerce-write.guard';

type PaymentDetails = {
  customerName: string;
  contractNumber: string;
  amount: string;
};
type Settlement = PaymentDetails & {
  attempt: string;
  gatewayReceipt: VerifiedGatewayProof;
};

function receiptDetails(input: PaymentDetails) {
  if (
    typeof input?.customerName !== 'string' ||
    input.customerName.length < 2 ||
    input.customerName.length > 150 ||
    !/\p{L}/u.test(input.customerName) ||
    /\p{Cc}/u.test(input.customerName) ||
    typeof input.contractNumber !== 'string' ||
    !/^[\p{L}0-9][\p{L}0-9./_-]{0,39}$/u.test(input.contractNumber) ||
    typeof input.amount !== 'string' ||
    !/^[1-9][0-9]{0,13}0$/.test(input.amount)
  )
    throw new BadRequestException();
  const { customerName, contractNumber, amount } = input;
  return { customerName, contractNumber, amount };
}

export function canViewWebsiteContractPayments(actor: AuthenticatedActor) {
  return (
    actor.permissions.includes('sales.payments.read') &&
    (actor.permissions.includes('sales.contracts.read.branch') ||
      actor.permissions.includes('sales.contracts.read.all'))
  );
}

@Injectable()
export class WebsiteContractPayments {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(VerifiedGatewayReceiptPublic)
    private readonly gateway: VerifiedGatewayReceiptPublic,
  ) {}

  async prepare(
    site: string,
    input: PaymentDetails,
    actor: AuthenticatedActor,
  ) {
    if (site !== 'nss') throw new ForbiddenException();
    const { branchId } = siteBinding(site, actor);
    const details = receiptDetails(input);
    const destination = await this.gateway.destination(site, actor);
    if (destination.branchId !== branchId) throw new ForbiddenException();
    return {
      data: {
        target: stableFingerprint(details),
        terminalId: destination.terminalId,
      },
    };
  }

  async settle(site: string, input: Settlement, actor: AuthenticatedActor) {
    if (site !== 'nss') throw new ForbiddenException();
    const { branchId } = siteBinding(site, actor);
    const details = receiptDetails(input);
    if (
      typeof input.attempt !== 'string' ||
      !/^[a-f0-9]{40}$/.test(input.attempt)
    )
      throw new BadRequestException();
    const target = stableFingerprint(details);
    const proof = await this.gateway.resolve(
      site,
      `guest:${target}:${input.attempt}`,
      input.gatewayReceipt,
      actor,
    );
    if (proof.branchId !== branchId || proof.amount !== details.amount)
      throw new ConflictException();
    const row = await this.db.client.websiteContractPayment.upsert({
      where: { attempt: input.attempt },
      create: {
        attempt: input.attempt,
        branchId,
        customerName: details.customerName,
        contractNumber: details.contractNumber,
        amountRial: details.amount,
        terminalId: proof.terminalId,
        bankReference: proof.bankReference,
        trackingNumber: proof.reference,
        verifiedAt: new Date(proof.verifiedAt),
      },
      update: {},
    });
    if (
      row.branchId !== branchId ||
      row.customerName !== details.customerName ||
      row.contractNumber !== details.contractNumber ||
      !row.amountRial.eq(details.amount) ||
      row.terminalId !== proof.terminalId ||
      row.bankReference !== proof.bankReference ||
      row.trackingNumber !== proof.reference ||
      row.verifiedAt.toISOString() !== new Date(proof.verifiedAt).toISOString()
    )
      throw new ConflictException();
    return { data: { state: 'recorded' as const } };
  }

  async list(actor: AuthenticatedActor, contractNumber?: string) {
    if (!canViewWebsiteContractPayments(actor)) throw new ForbiddenException();
    const reference = contractNumber?.trim();
    if (reference && reference.length > 40) throw new BadRequestException();
    const data = await this.db.client.websiteContractPayment.findMany({
      where: {
        branchId: { in: actor.branchIds },
        ...(reference
          ? { contractNumber: { equals: reference, mode: 'insensitive' } }
          : {}),
      },
      orderBy: [{ verifiedAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: {
        id: true,
        receiptNumber: true,
        customerName: true,
        contractNumber: true,
        trackingNumber: true,
        amountRial: true,
        verifiedAt: true,
      },
    });
    return {
      data: data.map(({ receiptNumber, amountRial, ...row }) => ({
        ...row,
        receiptNumber: 'NSS-P-' + receiptNumber.toString().padStart(8, '0'),
        amountRial: amountRial.toFixed(0),
        seller: 'سایت نیایش',
      })),
    };
  }
}

@Controller('sales/site-commerce/v1/:site/contract-payments')
@UseGuards(AuthGuard, SiteCommerceWriteGuard)
export class WebsiteContractPaymentIntakeController {
  constructor(
    @Inject(WebsiteContractPayments)
    private readonly payments: WebsiteContractPayments,
  ) {}

  @Post('prepare')
  prepare(
    @Param('site') site: string,
    @Body() body: PaymentDetails,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payments.prepare(site, body, request.actor);
  }

  @Post('settle')
  settle(
    @Param('site') site: string,
    @Body() body: Settlement,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payments.settle(site, body, request.actor);
  }
}

@Controller('sales/website-contract-payments')
@UseGuards(AuthGuard)
export class WebsiteContractPaymentListController {
  constructor(
    @Inject(WebsiteContractPayments)
    private readonly payments: WebsiteContractPayments,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(
    @Req() request: AuthenticatedRequest,
    @Query('contractNumber') contractNumber?: string,
  ) {
    if (contractNumber !== undefined && typeof contractNumber !== 'string')
      throw new BadRequestException();
    return this.payments.list(request.actor, contractNumber);
  }
}
