import { Module } from '@nestjs/common';
import { HrDirectoryModule } from '../hr/hr-directory.module';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { WindowsDefenderAntivirus } from './documents.antivirus';
import { DocumentsController } from './documents.controller';
import { DocumentsRepository } from './documents.repository';
import { DocumentsScanProcessor } from './documents.scan-processor';
import { DocumentsService } from './documents.service';
import { LocalDocumentStorage } from './documents.storage';

@Module({
  imports: [IamModule, NotificationsModule, HrDirectoryModule],
  controllers: [DocumentsController],
  providers: [
    AuthGuard,
    PermissionGuard,
    DocumentsRepository,
    DocumentsScanProcessor,
    DocumentsService,
    LocalDocumentStorage,
    WindowsDefenderAntivirus,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
