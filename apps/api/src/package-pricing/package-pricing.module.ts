import { Module } from '@nestjs/common';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { LegalEntitiesModule } from '../legal-entities/legal-entities.module';
import { PackagePricingController } from './package-pricing.controller';
import { PackagePricingService } from './package-pricing.service';
import {
  FailClosedPackagePricingSourceAdapter,
  PACKAGE_PRICING_SOURCE_PORT,
} from './package-pricing-source.port';

@Module({
  imports: [IamModule, LegalEntitiesModule],
  controllers: [PackagePricingController],
  providers: [
    AuthGuard,
    PermissionGuard,
    PackagePricingService,
    FailClosedPackagePricingSourceAdapter,
    {
      provide: PACKAGE_PRICING_SOURCE_PORT,
      useExisting: FailClosedPackagePricingSourceAdapter,
    },
  ],
  exports: [PackagePricingService],
})
export class PackagePricingModule {}
