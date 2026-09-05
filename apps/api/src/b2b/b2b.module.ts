import { Module } from '@nestjs/common';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { MasterDataModule } from '../master-data/master-data.module';
import { B2bController } from './b2b.controller';
import { B2bRepository } from './b2b.repository';
import { B2bService } from './b2b.service';
import {
  FINANCE_PARTY_EXPOSURE_PORT,
  UnavailableFinanceExposureAdapter,
} from './finance-exposure.port';

@Module({
  imports: [IamModule, MasterDataModule],
  controllers: [B2bController],
  providers: [
    AuthGuard,
    PermissionGuard,
    B2bRepository,
    B2bService,
    UnavailableFinanceExposureAdapter,
    {
      provide: FINANCE_PARTY_EXPOSURE_PORT,
      useExisting: UnavailableFinanceExposureAdapter,
    },
  ],
  exports: [B2bService, FINANCE_PARTY_EXPOSURE_PORT],
})
export class B2bModule {}
