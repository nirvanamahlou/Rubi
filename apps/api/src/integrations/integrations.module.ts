import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { IntegrationsController } from './integrations.controller';
import { ProcurementSupplierIntegrationService } from './procurement-supplier.integration';
import { SystemManagementModule } from '../system-management/system-management.module';
import { IntegrationRegistryController } from './integration-registry.controller';
import { IntegrationRegistryService } from './integration-registry.service';

@Module({
  imports: [IamModule, ProcurementModule, SystemManagementModule],
  controllers: [IntegrationsController, IntegrationRegistryController],
  providers: [
    ProcurementSupplierIntegrationService,
    IntegrationRegistryService,
  ],
})
export class IntegrationsModule {}
