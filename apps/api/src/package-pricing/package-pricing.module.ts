import { Module } from '@nestjs/common';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { LegalEntitiesModule } from '../legal-entities/legal-entities.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { HotelRatesModule } from '../reservations/hotel-rates.module';
import { TicketRuntimeModule } from '../ticket-catalog/ticket-runtime.module';
import { FinanceTicketCostModule } from '../finance/finance-ticket-cost.module';
import { PackagePricingController } from './package-pricing.controller';
import { PackagePricingService } from './package-pricing.service';
import { PackageTourPricingController } from './package-tour-pricing.controller';
import { PackageTourPricingService } from './package-tour-pricing.service';
import {
  FailClosedPackagePricingSourceAdapter,
  PACKAGE_PRICING_SOURCE_PORT,
  VersionedPackagePricingSourceAdapter,
} from './package-pricing-source.port';

@Module({
  imports: [
    IamModule,
    LegalEntitiesModule,
    MasterDataModule,
    HotelRatesModule,
    TicketRuntimeModule,
    FinanceTicketCostModule,
  ],
  controllers: [PackagePricingController, PackageTourPricingController],
  providers: [
    AuthGuard,
    PermissionGuard,
    PackagePricingService,
    PackageTourPricingService,
    FailClosedPackagePricingSourceAdapter,
    VersionedPackagePricingSourceAdapter,
    {
      provide: PACKAGE_PRICING_SOURCE_PORT,
      useExisting: VersionedPackagePricingSourceAdapter,
    },
  ],
  exports: [PackagePricingService],
})
export class PackagePricingModule {}
