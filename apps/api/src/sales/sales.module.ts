import { DocumentsModule } from '../documents/documents.module';
import {
  SalesPaymentReceiptsController,
  SalesPaymentReceiptsService,
} from './sales-payment-receipts';
import { SalesAgencyCustomerController } from './sales-agency-customer.controller';
import { PackagePricingModule } from '../package-pricing/package-pricing.module';
import { SalesPartyCorrectionService } from './sales-party-correction.service';
import { PassengerCorrectionModule } from './corrections/passenger-correction.module';
import { SalesProfitService } from './sales-profit.service';
import { FinanceTicketCostModule } from '../finance/finance-ticket-cost.module';
import { SalesBuyerContactCrypto } from './sales-buyer-contact.crypto';
import { Module } from '@nestjs/common';
import { SalesReferencesController } from './sales-references.controller';
import { MasterDataModule } from '../master-data/master-data.module';

import { CustomersModule } from '../customers/customers.module';
import { IamModule } from '../iam/iam.module';
import { AuthGuard } from '../iam/auth.guard';
import {
  SalesTicketsPublicAdapter,
  SALES_TICKET_AVAILABILITY_PORT,
  SalesCustomersPublicAdapter,
} from './sales.adapters';
import { SalesController } from './sales.controller';
import { SalesAssistantController } from './sales-assistant.controller';
import { SalesAssistantConfirmationService } from './sales-assistant-confirmation.service';
import { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';
import { SalesOutputService } from './sales-output.service';
import { LegalEntitiesModule } from '../legal-entities/legal-entities.module';
import { TicketRuntimeModule } from '../ticket-catalog/ticket-runtime.module';
import { ReservationsRuntimeModule } from '../reservations/reservations-runtime.module';
import { SalesReservationDispatcher } from './sales-reservation-dispatcher';

@Module({
  imports: [
    DocumentsModule,
    PackagePricingModule,
    PassengerCorrectionModule,
    FinanceTicketCostModule,
    MasterDataModule,
    IamModule,
    LegalEntitiesModule,
    CustomersModule,
    TicketRuntimeModule,
    ReservationsRuntimeModule,
  ],
  controllers: [
    SalesPaymentReceiptsController,
    SalesController,
    SalesAssistantController,
    SalesReferencesController,
    SalesAgencyCustomerController,
  ],
  providers: [
    SalesPaymentReceiptsService,
    AuthGuard,
    SalesRepository,
    SalesPartyCorrectionService,
    SalesAssistantConfirmationService,
    SalesBuyerContactCrypto,
    SalesService,
    SalesProfitService,
    SalesOutputService,
    SalesCustomersPublicAdapter,
    SalesTicketsPublicAdapter,
    SalesReservationDispatcher,
    {
      provide: SALES_TICKET_AVAILABILITY_PORT,
      useExisting: SalesTicketsPublicAdapter,
    },
  ],
  exports: [SalesService, SalesAssistantConfirmationService],
})
export class SalesModule {}
