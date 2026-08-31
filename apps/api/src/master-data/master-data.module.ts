import { Module } from '@nestjs/common';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import {
  CurrencyRateController,
  MasterDataAuditController,
} from './currency-rate.controller';
import { CurrencyRateService } from './currency-rate.service';
import { HotelImportController } from './hotel-import.controller';
import { HotelImportService } from './hotel-import.service';
import { MasterDataController } from './master-data.controller';
import { MasterDataRepository } from './master-data.repository';
import { MasterDataService } from './master-data.service';

@Module({
  imports: [IamModule],
  controllers: [
    CurrencyRateController,
    MasterDataAuditController,
    HotelImportController,
    MasterDataController,
  ],
  providers: [
    AuthGuard,
    PermissionGuard,
    MasterDataRepository,
    MasterDataService,
    CurrencyRateService,
    HotelImportService,
  ],
})
export class MasterDataModule {}
