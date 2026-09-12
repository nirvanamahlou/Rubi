import { Module } from '@nestjs/common';

import { CustomersModule } from '../customers/customers.module';
import { DocumentsModule } from '../documents/documents.module';
import { IamModule } from '../iam/iam.module';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReservationsRuntimeModule } from '../reservations/reservations-runtime.module';
import { SalesModule } from '../sales/sales.module';
import {
  CustomerAffairsController,
  CustomerAffairsPublicController,
} from './customer-affairs.controller';
import { CustomerAffairsRepository } from './customer-affairs.repository';
import { CustomerAffairsService } from './customer-affairs.service';

@Module({
  imports: [
    IamModule,
    CustomersModule,
    DocumentsModule,
    SalesModule,
    ReservationsRuntimeModule,
    NotificationsModule,
  ],
  controllers: [CustomerAffairsController, CustomerAffairsPublicController],
  providers: [
    AuthGuard,
    PermissionGuard,
    CustomerAffairsRepository,
    CustomerAffairsService,
  ],
  exports: [CustomerAffairsService],
})
export class CustomerAffairsModule {}
