import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SystemActivityRetention } from './system-activity-retention';
import { SystemActivityInterceptor } from './system-activity.interceptor';
import {
  InternalCorrespondenceController,
  InternalCorrespondenceService,
} from './internal-correspondence';

import { DocumentsModule } from '../documents/documents.module';
import { IamModule } from '../iam/iam.module';
import { ReportingModule } from '../reporting/reporting.module';
import { SystemManagementController } from './system-management.controller';
import { SystemManagementService } from './system-management.service';
import {
  CorrespondenceNumberingController,
  CorrespondenceNumberingService,
} from './correspondence-numbering';

@Module({
  imports: [IamModule, DocumentsModule, ReportingModule],
  controllers: [
    SystemManagementController,
    CorrespondenceNumberingController,
    InternalCorrespondenceController,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: SystemActivityInterceptor },
    SystemActivityRetention,
    SystemManagementService,
    CorrespondenceNumberingService,
    InternalCorrespondenceService,
  ],
  exports: [SystemManagementService],
})
export class SystemManagementModule {}
