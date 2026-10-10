import { SalesProfitService } from './sales-profit.service';
import { FinanceTicketCostModule } from '../finance/finance-ticket-cost.module';
import { SalesBuyerContactCrypto } from './sales-buyer-contact.crypto';
import { Module } from '@nestjs/common';
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
import { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';
import { SalesOutputService } from './sales-output.service';
import { LegalEntitiesModule } from '../legal-entities/legal-entities.module';
import { TicketRuntimeModule } from '../ticket-catalog/ticket-runtime.module';
import { ReservationsRuntimeModule } from '../reservations/reservations-runtime.module';
import { SalesReservationDispatcher } from './sales-reservation-dispatcher';

@Module({
  imports: [
    FinanceTicketCostModule,
    MasterDataModule,
    IamModule,
    LegalEntitiesModule,
    CustomersModule,
    TicketRuntimeModule,
    ReservationsRuntimeModule,
  ],
  controllers: [SalesController],
  providers: [
    AuthGuard,
    SalesRepository,
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
  exports: [SalesService],
})
export class SalesModule {}
