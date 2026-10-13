import { Module } from '@nestjs/common';
import { MasterHrDirectory } from './master-hr-directory';
import { MasterProcurementDirectory } from './master-procurement-directory';

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
import { MasterDataContactCrypto } from './master-data-contact.crypto';
import { MasterDataRepository } from './master-data.repository';
import { MasterDataService } from './master-data.service';
import { MasterOrganizationDirectory } from './master-organization-directory';
import { MasterTravelDirectory } from './master-travel-directory';
import { OrganizationAddressController } from './organization-address.controller';
import { MasterHotelBaseRatesController } from './hotel-base-rates.controller';
import {
  MasterHotelBaseRatePublicService,
  MasterHotelBaseRatesService,
} from './hotel-base-rates.service';

@Module({
  imports: [IamModule],
  controllers: [
    CurrencyRateController,
    MasterDataAuditController,
    HotelImportController,
    MasterHotelBaseRatesController,
    MasterDataController,
    OrganizationAddressController,
  ],
  providers: [
    MasterProcurementDirectory,
    AuthGuard,
    PermissionGuard,
    MasterDataRepository,
    MasterDataContactCrypto,
    MasterDataService,
    MasterHrDirectory,
    MasterOrganizationDirectory,
    MasterTravelDirectory,
    CurrencyRateService,
    HotelImportService,
    MasterHotelBaseRatesService,
    MasterHotelBaseRatePublicService,
  ],
  exports: [
    MasterProcurementDirectory,
    MasterDataService,
    MasterOrganizationDirectory,
    MasterTravelDirectory,
    MasterHrDirectory,
    MasterHotelBaseRatePublicService,
  ],
})
export class MasterDataModule {}
