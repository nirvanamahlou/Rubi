import { CustomerAffairsModule } from '../customer-affairs/customer-affairs.module';
import { TelephonyIntegrationService } from './telephony.service';
import {
  TelephonyIntegrationController,
  TelephonyWorkerController,
  TelephonyWorkerGuard,
} from './telephony.controller';
import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { IntegrationsController } from './integrations.controller';
import { ProcurementSupplierIntegrationService } from './procurement-supplier.integration';
import { SystemManagementModule } from '../system-management/system-management.module';
import { IntegrationRegistryController } from './integration-registry.controller';
import { IntegrationRegistryService } from './integration-registry.service';

@Module({
  imports: [
    CustomerAffairsModule,
    IamModule,
    ProcurementModule,
    SystemManagementModule,
  ],
  controllers: [
    TelephonyIntegrationController,
    TelephonyWorkerController,
    IntegrationsController,
    IntegrationRegistryController,
  ],
  providers: [
    TelephonyIntegrationService,
    TelephonyWorkerGuard,
    ProcurementSupplierIntegrationService,
    IntegrationRegistryService,
  ],
})
export class IntegrationsModule {}
