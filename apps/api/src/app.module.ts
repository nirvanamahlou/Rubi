import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { B2bModule } from './b2b/b2b.module';
import { environmentValidationSchema } from './config/environment.validation';
import { CustomersModule } from './customers/customers.module';
import { CustomerAffairsModule } from './customer-affairs/customer-affairs.module';
import { DatabaseModule } from './database/database.module';
import { DocumentsModule } from './documents/documents.module';
import { FinanceModule } from './finance/finance.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { HrModule } from './hr/hr.module';
import { IamModule } from './iam/iam.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { LegalEntitiesModule } from './legal-entities/legal-entities.module';
import { MasterDataModule } from './master-data/master-data.module';
import { MasterDataLogoModule } from './master-data/master-data-logo.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ProcurementModule } from './procurement/procurement.module';
import { SalesModule } from './sales/sales.module';
import { SettingsModule } from './settings/settings.module';
import { TasksModule } from './tasks/tasks.module';
import { WorkbenchFeedbackModule } from './workbench-feedback/workbench-feedback.module';
import { WorkbenchModule } from './workbench/workbench.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
      validationSchema: environmentValidationSchema,
    }),
    DatabaseModule,
    B2bModule,
    DocumentsModule,
    FinanceModule,
    CustomersModule,
    CustomerAffairsModule,
    MasterDataModule,
    MasterDataLogoModule,
    MessagingModule,
    IamModule,
    IntegrationsModule,
    LegalEntitiesModule,
    SalesModule,
    SettingsModule,
    TasksModule,
    NotificationsModule,
    ProcurementModule,
    HrModule,
    WorkbenchFeedbackModule,
    WorkbenchModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
