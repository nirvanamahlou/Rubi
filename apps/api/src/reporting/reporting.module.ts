import { Module } from '@nestjs/common';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { DocumentsModule } from '../documents/documents.module';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { ReportingRepository } from './reporting.repository';
import { ReportingExportService } from './reporting-export.service';

@Module({
  imports: [IamModule, DocumentsModule],
  controllers: [ReportingController],
  providers: [
    ReportingService,
    ReportingRepository,
    ReportingExportService,
    AuthGuard,
  ],
  exports: [ReportingService],
})
export class ReportingModule {}
