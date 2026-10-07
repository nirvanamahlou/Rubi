import { Module } from '@nestjs/common';

import { CustomersModule } from '../customers/customers.module';
import { CustomerContactCrypto } from '../customers/customer-contact.crypto';
import { HrDirectoryModule } from '../hr/hr-directory.module';
import { DocumentsModule } from '../documents/documents.module';
import { IamModule } from '../iam/iam.module';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { MarketingModule } from '../marketing/marketing.module';
import { ReservationsRuntimeModule } from '../reservations/reservations-runtime.module';
import { SalesModule } from '../sales/sales.module';
import { SettingsModule } from '../settings/settings.module';
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
import { CustomerAffairsRemindersService } from './customer-affairs-reminders.service';
import { CustomerAffairsSmsService } from './customer-affairs-sms.service';
import { CustomerAffairsSmsController } from './customer-affairs-sms.controller';
import { CustomerAffairsMarketingIntakeController } from './customer-affairs-marketing-intake.controller';
import { CustomerAffairsMarketingIntakeService } from './customer-affairs-marketing-intake.service';

@Module({
  imports: [
    IamModule,
    CustomersModule,
    HrDirectoryModule,
    DocumentsModule,
    SalesModule,
    ReservationsRuntimeModule,
    NotificationsModule,
    MarketingModule,
    SettingsModule,
  ],
  controllers: [
    CustomerAffairsController,
    CustomerAffairsPublicController,
    CustomerAffairsSiteController,
    CustomerAffairsInternalController,
    CustomerAffairsSmsController,
    CustomerAffairsMarketingIntakeController,
  ],
  providers: [
    AuthGuard,
    PermissionGuard,
    CustomerAffairsRepository,
    CustomerAffairsService,
    CustomerAffairsSiteGuard,
    CustomerAffairsRemindersService,
    CustomerAffairsSmsService,
    CustomerContactCrypto,
    CustomerAffairsMarketingIntakeService,
  ],
  exports: [CustomerAffairsService, CustomerAffairsMarketingIntakeService],
})
export class CustomerAffairsModule {}
