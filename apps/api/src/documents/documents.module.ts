import { Module } from '@nestjs/common';
import { HrDirectoryModule } from '../hr/hr-directory.module';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { WindowsDefenderAntivirus } from './documents.antivirus';
import { DocumentsController } from './documents.controller';
import { DocumentsRepository } from './documents.repository';
import { DocumentsScanProcessor } from './documents.scan-processor';
import { DocumentsService } from './documents.service';
import { DocumentsDailyPackagesService } from './documents-daily-packages.service';
import { DocumentsDailyPackagesRepository } from './documents-daily-packages.repository';
import { LocalDocumentStorage } from './documents.storage';

@Module({
  imports: [IamModule, NotificationsModule, HrDirectoryModule, SettingsModule],
  controllers: [DocumentsController],
  providers: [
    AuthGuard,
    PermissionGuard,
    DocumentsRepository,
    DocumentsScanProcessor,
    DocumentsService,
    DocumentsDailyPackagesService,
    DocumentsDailyPackagesRepository,
    LocalDocumentStorage,
    WindowsDefenderAntivirus,
  ],
  exports: [
    DocumentsService,
    DocumentsDailyPackagesService,
    LocalDocumentStorage,
  ],
})
export class DocumentsModule {}
