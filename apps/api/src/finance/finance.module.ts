import { BankControlsController } from './payments/bank-controls.controller';
import { LegalEntitiesModule } from '../legal-entities/legal-entities.module';
import { SalesFinanceContractReadModule } from '../sales/finance-contract-read.public';
import { FinanceSourceReferences } from './source-read/finance-source-references.service';
import { FinanceSourceReadController } from './finance-source-read.controller';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { FinanceFiscalStorageModule } from './fiscal-context/finance-fiscal-storage.module';
import { FinanceFiscalContextService } from './fiscal-context/finance-fiscal-context.service';
import { FinanceFiscalContextController } from './fiscal-context/finance-fiscal-context.controller';
import { FinanceFiscalInterceptor } from './fiscal-context/finance-fiscal.interceptor';
import { ExchangeOfficeModule } from './exchange-offices/exchange-office.module';
import {
  FinancePartyReceipts,
  FinancePartyReceiptsController,
} from './operations/party-receipts';
import { FinanceReceiptAllocationController } from './receipt-allocation.controller';
import { FinanceReceiptAllocationService } from './operations/receipt-allocation.service';
import { FinancialEventDispatcher } from './accounting/financial-event-dispatcher';
import { BankAccountModule } from './bank-accounts/bank-account.module';
import { PurchaseFxModule } from './purchase-fx/purchase-fx.service';
import { FinancePartnerModule } from './partner-finance.module';
import { AccountingController } from './accounting/accounting.controller';
import { AccountingTaxController } from './accounting/accounting-tax.controller';
import { AccountingTaxService } from './accounting/accounting-tax.service';
import { AccountingService } from './accounting/accounting.service';
import { AccountingCompanyScope } from './accounting/accounting-company-scope';
import { AccountingCompletionModule } from './accounting/accounting-completion.module';
import { Module } from '@nestjs/common';

import { HrModule } from '../hr/hr.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DocumentsModule } from '../documents/documents.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { FinanceRequestsController } from './operations/finance-requests.controller';
import { FinanceFollowupController } from './operations/finance-followup.controller';
import { FinanceFollowupService } from './operations/finance-followup.service';
import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { ReservationsRuntimeModule } from '../reservations/reservations-runtime.module';
import { SalesModule } from '../sales/sales.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { FinanceInboxController } from './finance-inbox.controller';
import { FinancePayrollController } from './operations/finance-payroll.controller';
import { FinancePayrollService } from './operations/finance-payroll.service';
import { FinanceInboxService } from './finance-inbox.service';
import { FinanceTicketCostModule } from './finance-ticket-cost.module';

@Module({
  imports: [
    SalesFinanceContractReadModule,
    FinanceFiscalStorageModule,
    LegalEntitiesModule,
    BankAccountModule,
    ExchangeOfficeModule,
    FinancePartnerModule,
    PurchaseFxModule,
    IamModule,
    NotificationsModule,
    DocumentsModule,
    MasterDataModule,
    SalesModule,
    HrModule,
    ReservationsRuntimeModule,
    ProcurementModule,
    FinanceTicketCostModule,
    AccountingCompletionModule,
  ],
  controllers: [
    BankControlsController,
    FinanceSourceReadController,
    FinanceFiscalContextController,
    FinancePartyReceiptsController,
    FinanceReceiptAllocationController,
    AccountingTaxController,
    AccountingController,
    FinanceInboxController,
    FinancePayrollController,
    FinanceFollowupController,
    FinanceRequestsController,
  ],
  providers: [
    FinanceSourceReferences,
    FinanceFiscalContextService,
    { provide: APP_INTERCEPTOR, useClass: FinanceFiscalInterceptor },
    FinancePartyReceipts,
    FinanceReceiptAllocationService,
    FinancialEventDispatcher,
    AccountingTaxService,
    AccountingService,
    AccountingCompanyScope,
    AuthGuard,
    PermissionGuard,
    FinanceInboxService,
    FinancePayrollService,
    FinanceFollowupService,
  ],
})
export class FinanceModule {}
