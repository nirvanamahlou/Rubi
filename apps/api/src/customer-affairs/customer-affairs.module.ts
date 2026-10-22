import { HrCallAnswerDirectory } from '../hr/hr-call-answer-directory';
import { CallCenterTelephonyService } from './call-center-telephony.service';
import { CallCenterAccessService } from './call-center-access.service';
import { CallCenterOwnerService } from './call-center-owner.service';
import { CallCenterOwnerController } from './call-center-owner.controller';
import { CallCenterTelephonyController } from './call-center-telephony.controller';
import { CallCenterCustomerController } from './call-center-customer.controller';
import { CallCenterCustomerService } from './call-center-customer.service';
import { CallCenterReadController } from './call-center-read.controller';
import { CallCenterReadService } from './call-center-read.service';
import { TasksModule } from '../tasks/tasks.module';
import { CallCenterWorkflowService } from './call-center-workflow.service';
import { CallCenterWorkflowController } from './call-center-workflow.controller';
import { Module } from '@nestjs/common';
import { CallCenterController } from './call-center.controller';
import { CallCenterService } from './call-center.service';
import { CallCenterCrypto } from './call-center.crypto';
import { CustomerAffairsAssistantController } from './customer-affairs-assistant.controller';

import { CustomersModule } from '../customers/customers.module';
import { CustomerContactCrypto } from '../customers/customer-contact.crypto';
import { HrDirectoryModule } from '../hr/hr-directory.module';
import { DocumentsModule } from '../documents/documents.module';
import { IamModule } from '../iam/iam.module';
import { IamWorkbenchRequestDirectory } from '../iam/iam-workbench-request-directory';
import { HrWorkbenchRequestUnits } from '../hr/hr-workbench-request-units';
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
    TasksModule,
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
    CallCenterOwnerController,
    CallCenterTelephonyController,
    CallCenterCustomerController,
    CallCenterReadController,
    CallCenterWorkflowController,
    CallCenterController,
    CustomerAffairsAssistantController,
    CustomerAffairsController,
    CustomerAffairsPublicController,
    CustomerAffairsSiteController,
    CustomerAffairsInternalController,
    CustomerAffairsSmsController,
    CustomerAffairsMarketingIntakeController,
  ],
  providers: [
    HrCallAnswerDirectory,
    CallCenterOwnerService,
    CallCenterAccessService,
    CallCenterTelephonyService,
    CallCenterCustomerService,
    CallCenterReadService,
    CallCenterWorkflowService,
    CallCenterService,
    CallCenterCrypto,
    IamWorkbenchRequestDirectory,
    HrWorkbenchRequestUnits,
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
  exports: [
    CallCenterAccessService,
    IamWorkbenchRequestDirectory,
    CallCenterTelephonyService,
    CustomerAffairsService,
    CustomerAffairsMarketingIntakeService,
  ],
})
export class CustomerAffairsModule {}
