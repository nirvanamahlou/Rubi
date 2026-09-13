import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { HrModule } from '../hr/hr.module';
import { IamModule } from '../iam/iam.module';
import { AuthGuard } from '../iam/auth.guard';
import { LegalEntitiesModule } from '../legal-entities/legal-entities.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { ProcurementController } from './procurement.controller';
import { ProcurementOperations } from './procurement.operations';
import { ProcurementPolicyPort } from './procurement.ports';
import { ProcurementService } from './procurement.service';
import { ProcurementExports } from './procurement.exports';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    IamModule,
    HrModule,
    MasterDataModule,
    DocumentsModule,
    LegalEntitiesModule,
    NotificationsModule,
  ],
  controllers: [ProcurementController],
  providers: [
    AuthGuard,
    ProcurementPolicyPort,
    ProcurementOperations,
    ProcurementService,
    ProcurementExports,
  ],
  exports: [ProcurementService],
})
export class ProcurementModule {}
