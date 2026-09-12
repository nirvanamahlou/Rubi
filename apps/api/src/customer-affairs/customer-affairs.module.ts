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
import {
  CustomerAffairsSiteController,
  CustomerAffairsSiteGuard,
} from './customer-affairs-site.controller';
import { CustomerAffairsInternalController } from './customer-affairs-internal.controller';

@Module({
  imports: [
    IamModule,
    CustomersModule,
    DocumentsModule,
    SalesModule,
    ReservationsRuntimeModule,
    NotificationsModule,
  ],
  controllers: [
    CustomerAffairsController,
    CustomerAffairsPublicController,
    CustomerAffairsSiteController,
    CustomerAffairsInternalController,
  ],
  providers: [
    AuthGuard,
    PermissionGuard,
    CustomerAffairsRepository,
    CustomerAffairsService,
    CustomerAffairsSiteGuard,
  ],
  exports: [CustomerAffairsService],
})
export class CustomerAffairsModule {}
