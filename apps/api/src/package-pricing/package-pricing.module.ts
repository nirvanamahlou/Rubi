import { Module } from '@nestjs/common';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { LegalEntitiesModule } from '../legal-entities/legal-entities.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { PackagePricingController } from './package-pricing.controller';
import { PackagePricingService } from './package-pricing.service';
import {
  FailClosedPackagePricingSourceAdapter,
  PACKAGE_PRICING_SOURCE_PORT,
  VersionedPackagePricingSourceAdapter,
} from './package-pricing-source.port';

@Module({
  imports: [IamModule, LegalEntitiesModule, MasterDataModule],
  controllers: [PackagePricingController],
  providers: [
    AuthGuard,
    PermissionGuard,
    PackagePricingService,
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
