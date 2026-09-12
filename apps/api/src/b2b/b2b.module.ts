import { Module } from '@nestjs/common';
import { B2bActivityController } from './b2b-activity.controller';
import { B2bActivityService } from './b2b-activity.service';
import { B2bActivityRepository } from './b2b-activity.repository';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { B2bOrganizationUserRepository } from './b2b-organization-user.repository';
import { B2bOrganizationUserService } from './b2b-organization-user.service';
import {
  B2bOrganizationUserController,
  B2bPortalController,
} from './b2b-organization-user.controller';
import { B2bPortalBoundaryInterceptor } from './b2b-portal-boundary.interceptor';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { MasterDataModule } from '../master-data/master-data.module';
import { DocumentsModule } from '../documents/documents.module';
import { B2bAgreementDocuments } from './b2b-agreement-documents';
import { B2bController } from './b2b.controller';
import { B2bRepository } from './b2b.repository';
import { B2bService } from './b2b.service';
import { B2bSignatoryService } from './b2b-signatory.service';
import { B2bSignatoryRepository } from './b2b-signatory.repository';
import { B2bAgreementWorkflowRepository } from './b2b-agreement-workflow.repository';
import { B2bAgreementWorkflowService } from './b2b-agreement-workflow.service';
import {
  FINANCE_PARTY_EXPOSURE_PORT,
  UnavailableFinanceExposureAdapter,
} from './finance-exposure.port';

@Module({
  imports: [IamModule, MasterDataModule, DocumentsModule],
  controllers: [
    B2bActivityController,
    B2bController,
    B2bOrganizationUserController,
    B2bPortalController,
  ],
  providers: [
    B2bActivityService,
    B2bActivityRepository,
    B2bOrganizationUserRepository,
    B2bOrganizationUserService,
    { provide: APP_INTERCEPTOR, useClass: B2bPortalBoundaryInterceptor },
    AuthGuard,
    PermissionGuard,
    B2bRepository,
    B2bService,
    B2bSignatoryService,
    B2bSignatoryRepository,
    B2bAgreementWorkflowRepository,
    B2bAgreementWorkflowService,
    B2bAgreementDocuments,
    UnavailableFinanceExposureAdapter,
    {
      provide: FINANCE_PARTY_EXPOSURE_PORT,
      useExisting: UnavailableFinanceExposureAdapter,
    },
  ],
  exports: [B2bService, FINANCE_PARTY_EXPOSURE_PORT],
})
export class B2bModule {}
