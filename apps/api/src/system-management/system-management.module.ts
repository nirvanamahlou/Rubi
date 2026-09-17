import { Module } from '@nestjs/common';

import { IamModule } from '../iam/iam.module';
import { DocumentsModule } from '../documents/documents.module';
import { ReportingModule } from '../reporting/reporting.module';
import { SystemManagementController } from './system-management.controller';
import { SystemManagementService } from './system-management.service';

@Module({
  imports: [IamModule, ReportingModule, DocumentsModule],
  controllers: [SystemManagementController],
  providers: [SystemManagementService],
  exports: [SystemManagementService],
})
export class SystemManagementModule {}
