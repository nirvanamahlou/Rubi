import {
  Controller,
  Body,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  FinanceReceiptDecisionCommandV1,
  FinanceSettlementAccountCreateV1,
  FinanceSupplierPaymentCommandV1,
} from '@nora/contracts';

import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
import { FinanceInboxService } from './finance-inbox.service';

@Controller('finance')
@UseGuards(AuthGuard, PermissionGuard)
export class FinanceInboxController {
  constructor(
    @Inject(FinanceInboxService)
    private readonly inbox: FinanceInboxService,
  ) {}

  @Get('inbox')
  @RequirePermissions('finance.read')
  @Header('Cache-Control', 'private, no-store')
  list(@Req() request: AuthenticatedRequest) {
    return this.inbox.list(request.actor);
  }

  @Get('settlement-accounts')
  @RequirePermissions('finance.read')
  async listAccounts(@Req() request: AuthenticatedRequest) {
    return { data: await this.inbox.listSettlementAccounts(request.actor) };
  }

  @Get('payment-methods')
  @RequirePermissions('finance.payment.create')
  async paymentMethods(@Req() request: AuthenticatedRequest) {
    return { data: await this.inbox.listPaymentMethods(request.actor) };
  }

  @Post('settlement-accounts')
  @RequirePermissions('finance.account.manage')
  async createAccount(
    @Body() input: FinanceSettlementAccountCreateV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      data: await this.inbox.createSettlementAccount(input, request.actor),
    };
  }

  @Get('account-banks')
  @RequirePermissions('finance.account.manage')
  async accountBanks(@Req() request: AuthenticatedRequest) {
    return { data: await this.inbox.listBanks(request.actor) };
  }

  @Post('inbox/sales/:paymentId/decision')
  @RequirePermissions('finance.receipt.approve')
  async receiptDecision(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() input: FinanceReceiptDecisionCommandV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      data: await this.inbox.decideReceipt(paymentId, input, request.actor),
    };
  }

  @Post('inbox/reservations/:intakeId/purchases/:purchaseId/payments')
  @RequirePermissions('finance.payment.create')
  async supplierPayment(
    @Param('intakeId', ParseUUIDPipe) intakeId: string,
    @Param('purchaseId', ParseUUIDPipe) purchaseId: string,
    @Body() input: FinanceSupplierPaymentCommandV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      data: await this.inbox.supplierPayment(
        intakeId,
        purchaseId,
        input,
        request.actor,
      ),
    };
  }
}
