import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { IntegrationsController } from './integrations.controller';
import { ProcurementSupplierIntegrationService } from './procurement-supplier.integration';

@Module({
  imports: [IamModule, ProcurementModule],
  controllers: [IntegrationsController],
  providers: [ProcurementSupplierIntegrationService],
})
export class IntegrationsModule {}
