import { Module } from '@nestjs/common';

import { CustomersModule } from '../customers/customers.module';
import { IamModule } from '../iam/iam.module';
import { AuthGuard } from '../iam/auth.guard';
import {
  AwaitingTicketCatalogPublicApi,
  SALES_TICKET_AVAILABILITY_PORT,
  SalesCustomersPublicAdapter,
} from './sales.adapters';
import { SalesController } from './sales.controller';
import { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';

@Module({
  imports: [IamModule, CustomersModule],
  controllers: [SalesController],
  providers: [
    AuthGuard,
    SalesRepository,
    SalesService,
    SalesCustomersPublicAdapter,
    AwaitingTicketCatalogPublicApi,
    {
      provide: SALES_TICKET_AVAILABILITY_PORT,
      useExisting: AwaitingTicketCatalogPublicApi,
    },
  ],
  exports: [SalesService],
})
export class SalesModule {}
