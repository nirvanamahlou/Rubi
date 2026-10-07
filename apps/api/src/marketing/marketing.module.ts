import { Module } from '@nestjs/common';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { MarketingController } from './marketing.controller';
import { MarketingProcessService } from './marketing-process.service';
import { MarketingRecordsService } from './marketing-records.service';

@Module({
  imports: [IamModule],
  controllers: [MarketingController],
  providers: [
    AuthGuard,
    PermissionGuard,
    MarketingProcessService,
    MarketingRecordsService,
  ],
  exports: [MarketingProcessService, MarketingRecordsService],
})
export class MarketingModule {}
