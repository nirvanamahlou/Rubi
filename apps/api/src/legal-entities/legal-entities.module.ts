import { ContractCompanyScope } from '../sales/contract-company-scope.public';
import { ContractArchiveController } from './contract-archive.controller';
import { Module } from '@nestjs/common';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import {
  DOCUMENT_TEMPLATE_POLICY_PORT,
  FailClosedDocumentTemplatePolicyAdapter,
} from './document-template-policy.port';
import { LegalEntitiesController } from './legal-entities.controller';
import { LegalEntitiesService } from './legal-entities.service';

@Module({
  imports: [IamModule],
  controllers: [ContractArchiveController, LegalEntitiesController],
  providers: [
    AuthGuard,
    PermissionGuard,
    FailClosedDocumentTemplatePolicyAdapter,
    {
      provide: DOCUMENT_TEMPLATE_POLICY_PORT,
      useExisting: FailClosedDocumentTemplatePolicyAdapter,
    },
    ContractCompanyScope,
    LegalEntitiesService,
  ],
  exports: [LegalEntitiesService, ContractCompanyScope],
})
export class LegalEntitiesModule {}
