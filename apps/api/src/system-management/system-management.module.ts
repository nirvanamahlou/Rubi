import { Module } from '@nestjs/common';

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
  controllers: [SystemManagementController, CorrespondenceNumberingController],
  providers: [SystemManagementService, CorrespondenceNumberingService],
  exports: [SystemManagementService],
})
export class SystemManagementModule {}
