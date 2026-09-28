import { Module } from '@nestjs/common';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { DocumentsModule } from '../documents/documents.module';
import { MarketingController } from './marketing.controller';
import { MarketingProcessService } from './marketing-process.service';

@Module({
  imports: [IamModule, DocumentsModule],
  controllers: [MarketingController],
  providers: [AuthGuard, PermissionGuard, MarketingProcessService],
  exports: [MarketingProcessService],
})
export class MarketingModule {}
