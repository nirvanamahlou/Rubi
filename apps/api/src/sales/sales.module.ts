import { Module } from '@nestjs/common';

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
import { TicketRuntimeModule } from '../ticket-catalog/ticket-runtime.module';
import { ReservationsRuntimeModule } from '../reservations/reservations-runtime.module';
import { SalesReservationDispatcher } from './sales-reservation-dispatcher';

@Module({
  imports: [
    IamModule,
    CustomersModule,
    TicketRuntimeModule,
    ReservationsRuntimeModule,
  ],
  controllers: [SalesController],
  providers: [
    AuthGuard,
    SalesRepository,
    SalesService,
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
