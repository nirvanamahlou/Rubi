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
import {
  isClosedFinanceItem,
  filterFinanceInbox,
  validateInboxQuery,
} from './finance-inbox-query';
import { financeExportSnapshot } from './finance-export';
import { buildFinanceXlsx, FINANCE_XLSX_MIME } from './finance-xlsx';

@Controller('finance')
@UseGuards(AuthGuard, PermissionGuard)
export class FinanceInboxController {
  constructor(
    @Inject(FinanceInboxService)
    private readonly inbox: FinanceInboxService,
  ) {}

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
  async page(
    @Query() query: FinanceInboxQueryV1,
    @Req() request: AuthenticatedRequest,
  ) {
    const { page, pageSize } = validateInboxQuery(query, request.actor);
    const result = await this.inbox.list(request.actor);
    const items = filterFinanceInbox(result.items, query);
    const open = items.filter((item) => !isClosedFinanceItem(item));
    return {
      ...result,
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total: items.length,
      page,
      pageSize,
      summary: {
        openCount: open.length,
        overdueCount: open.filter(
          (item) => item.dueAt && item.dueAt < result.generatedAt,
        ).length,
        receiptCount: open.filter((item) => item.source === 'SALES').length,
        paymentCount: open.filter(
          (item) =>
            [
              'PAYMENT_REQUEST',
              'PAYROLL_REQUEST',
              'OPERATIONAL_REQUEST',
            ].includes(item.kind) &&
            item.amount &&
            ['READY_FOR_PAYMENT', 'APPROVED', 'PAYING'].includes(item.status),
        ).length,
      },
    };
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
    response.send(Buffer.from(buildFinanceXlsx(snapshot, requestDisplayLanguage(request))));
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
