import { Module } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module';
import { IamModule } from '../iam/iam.module';
import { ReportingModule } from '../reporting/reporting.module';
import { SystemManagementController } from './system-management.controller';
import { SystemManagementService } from './system-management.service';

@Module({
  imports: [IamModule, DocumentsModule, ReportingModule],
  controllers: [SystemManagementController],
  providers: [SystemManagementService],
  exports: [SystemManagementService],
})
export class SystemManagementModule {}
