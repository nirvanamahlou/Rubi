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
import { NiyayeshController } from './niyayesh.controller';
import { NiyayeshService } from './niyayesh.service';
import { IssabelService } from './issabel/issabel.service';
import { IssabelRecordingsService } from './issabel/recordings.service';
import {
  IssabelController,
  IssabelRecordingController,
  IssabelRecordingGuard,
} from './issabel/issabel.controller';

@Module({
  imports: [
    CustomerAffairsModule,
    IamModule,
    ProcurementModule,
    SystemManagementModule,
  ],
  controllers: [
    IssabelController,
    IssabelRecordingController,
    TelephonyIntegrationController,
    TelephonyWorkerController,
    IntegrationsController,
    IntegrationRegistryController,
    NiyayeshController,
  ],
  providers: [
    IssabelService,
    IssabelRecordingsService,
    IssabelRecordingGuard,
    TelephonyIntegrationService,
    TelephonyWorkerGuard,
    ProcurementSupplierIntegrationService,
    IntegrationRegistryService,
    NiyayeshService,
  ],
})
export class IntegrationsModule {}
