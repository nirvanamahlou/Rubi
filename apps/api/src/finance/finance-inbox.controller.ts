import { requestDisplayLanguage } from '../common/i18n/language';
import {
  Controller,
  Body,
  Get,
  Header,
  Inject,
  Param,
  Query,
  ParseUUIDPipe,
  Post,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  FinanceHistoryQueryV1,
  FinanceInboxQueryV1,
  FinanceExportQueryV1,
  FinanceReceiptDecisionCommandV1,
  FinanceProcurementInvoiceDecisionCommandV1,
  FinanceProcurementInvoicePaymentCommandV1,
  FinanceProcurementCorrectionDecisionCommandV1,
  FinanceSettlementAccountCreateV1,
  FinanceCustomerDocumentDeliveryCommandV1,
  FinanceSupplierPaymentCommandV1,
} from '@nora/contracts';

import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
import { FinanceInboxService } from './finance-inbox.service';
import type { Response } from 'express';
import { financeExportSnapshot } from './finance-export';
import { buildFinanceXlsx, FINANCE_XLSX_MIME } from './finance-xlsx';

@Controller('finance')
@UseGuards(AuthGuard, PermissionGuard)
export class FinanceInboxController {
  constructor(
    @Inject(FinanceInboxService)
    private readonly inbox: FinanceInboxService,
  ) {}

  @Get('purchase-fx-quote')
  @Header('Cache-Control', 'private, no-store')
  async purchaseFxQuote(
    @Query('currency') currency: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return { data: await this.inbox.purchaseFxQuote(currency, req.actor) };
  }
  @Post('purchase-fx/:id')
  @RequirePermissions('finance.read', 'finance.payment.create')
  async purchaseFxCapture(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: { rateToIrr: string; referenceIds?: string[] },
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      data: await this.inbox.capturePurchaseFx(
        id,
        input?.rateToIrr,
        req.actor,
        input?.referenceIds,
      ),
    };
  }

  @Get('paying-suppliers')
  @RequirePermissions('finance.payment.create')
  @Header('Cache-Control', 'private, no-store')
  async payingSuppliers(
    @Query('search') search?: string,
    @Query('page') page?: string,
  ) {
    const parsed = Number(page || '1');
    return {
      data: await this.inbox.payingSuppliers(
        (search || '').slice(0, 160),
        Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1,
      ),
    };
  }

  @Get('transaction-history')
  @RequirePermissions('finance.read')
  @Header('Cache-Control', 'private, no-store')
  history(
    @Query() query: FinanceHistoryQueryV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inbox.history(query, request.actor);
  }

  @Get('inbox')
  @RequirePermissions('finance.read')
  @Header('Cache-Control', 'private, no-store')
  list(@Req() request: AuthenticatedRequest) {
    return this.inbox.list(request.actor);
  }

  @Get('inbox/page')
  @RequirePermissions('finance.read')
  @Header('Cache-Control', 'private, no-store')
  page(
    @Query() query: FinanceInboxQueryV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inbox.page(query, request.actor);
  }

  @Get('export-data')
  @RequirePermissions('finance.read', 'finance.export')
  @Header('Cache-Control', 'private, no-store')
  exportData(
    @Query() query: FinanceExportQueryV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return financeExportSnapshot(this.inbox, query, request.actor);
  }

  @Get('export.xlsx')
  @RequirePermissions('finance.read', 'finance.export')
  async exportXlsx(
    @Query() query: FinanceExportQueryV1,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const snapshot = await financeExportSnapshot(
      this.inbox,
      query,
      request.actor,
    );
    response.setHeader('Content-Type', FINANCE_XLSX_MIME);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="finance-' +
        snapshot.scope.toLowerCase() +
        '.xlsx"',
    );
    response.send(
      Buffer.from(buildFinanceXlsx(snapshot, requestDisplayLanguage(request))),
    );
  }

  @Get('settlement-accounts')
  @RequirePermissions('finance.read')
  async listAccounts(@Req() request: AuthenticatedRequest) {
    return { data: await this.inbox.listSettlementAccounts(request.actor) };
  }

  @Get('payment-methods')
  @RequirePermissions('finance.payment.create')
  async paymentMethods(
    @Req() request: AuthenticatedRequest,
    @Query('direction') direction?: string,
  ) {
    return {
      data: await this.inbox.listPaymentMethods(
        request.actor,
        direction === 'RECEIPT' ? 'RECEIPT' : 'PAYMENT',
      ),
    };
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

  @Get('customer-document-delivery')
  @RequirePermissions('finance.financial_release.read')
  @Header('Cache-Control', 'private, no-store')
  async customerDocumentDeliveryQueue(
    @Query('contractNumber') contractNumber: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      data: await this.inbox.customerDocumentDeliveryQueue(
        contractNumber,
        request.actor,
      ),
    };
  }

  @Get('reservation-document-delivery/:contractId')
  @RequirePermissions('reservations.documents.manage')
  @Header('Cache-Control', 'private, no-store')
  async reservationDocumentDelivery(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      data: await this.inbox.reservationDocumentDelivery(
        contractId,
        request.actor,
      ),
    };
  }
  @Post('reservation-document-delivery/:contractId')
  @RequirePermissions('reservations.documents.manage')
  async reservationDocumentDeliveryDecision(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() input: FinanceCustomerDocumentDeliveryCommandV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      data: await this.inbox.decideReservationDocumentDelivery(
        contractId,
        input,
        request.actor,
      ),
    };
  }
  @Post('customer-document-delivery/:contractId')
  @RequirePermissions('finance.financial_release.approve')
  async customerDocumentDeliveryDecision(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() input: FinanceCustomerDocumentDeliveryCommandV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      data: await this.inbox.decideCustomerDocumentDelivery(
        contractId,
        input,
        request.actor,
      ),
    };
  }
  @Get('inbox/sales/:contractId/:paymentId/void')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('finance.read', 'finance.receipt.approve')
  async receiptVoidPreview(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      data: await this.inbox.receiptVoid(paymentId, contractId, request.actor),
    };
  }

  @Post('inbox/sales/:contractId/:paymentId/void')
  @RequirePermissions('finance.read', 'finance.receipt.approve')
  async receiptVoid(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() input: { reason: string; version: number },
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      data: await this.inbox.receiptVoid(paymentId, contractId, request.actor, {
        reason: input?.reason,
        version: input?.version,
      }),
    };
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

  @Post('inbox/purchases/invoices/:invoiceId/decision')
  @RequirePermissions('finance.receipt.approve')
  async procurementInvoiceDecision(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() input: FinanceProcurementInvoiceDecisionCommandV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      data: await this.inbox.decideProcurementInvoice(
        invoiceId,
        input,
        request.actor,
      ),
    };
  }

  @Post('inbox/purchases/invoices/:invoiceId/payments')
  @RequirePermissions('finance.payment.create')
  async procurementInvoicePayment(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() input: FinanceProcurementInvoicePaymentCommandV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      data: await this.inbox.payProcurementInvoice(
        invoiceId,
        input,
        request.actor,
      ),
    };
  }

  @Post('inbox/purchases/corrections/:eventId/decision')
  @RequirePermissions('finance.receipt.approve')
  async procurementCorrectionDecision(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() input: FinanceProcurementCorrectionDecisionCommandV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      data: await this.inbox.decideProcurementCorrection(
        eventId,
        input,
        request.actor,
      ),
    };
  }
}
