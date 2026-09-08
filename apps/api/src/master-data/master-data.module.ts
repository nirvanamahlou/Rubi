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
import { MasterDataContactCrypto } from './master-data-contact.crypto';
import { MasterDataRepository } from './master-data.repository';
import { MasterDataService } from './master-data.service';
import { MasterOrganizationDirectory } from './master-organization-directory';
import { OrganizationAddressController } from './organization-address.controller';

@Module({
  imports: [IamModule],
  controllers: [
    CurrencyRateController,
    MasterDataAuditController,
    HotelImportController,
    MasterDataController,
    OrganizationAddressController,
  ],
  providers: [
    AuthGuard,
    PermissionGuard,
    MasterDataRepository,
    MasterDataContactCrypto,
    MasterDataService,
    MasterOrganizationDirectory,
    CurrencyRateService,
    HotelImportService,
  ],
  exports: [MasterOrganizationDirectory],
})
export class MasterDataModule {}
