import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { PackageSourceReferenceV1 } from '@nora/contracts';

export const PACKAGE_PRICING_SOURCE_PORT = Symbol(
  'PACKAGE_PRICING_SOURCE_PORT',
);

export interface PackagePricingResolvedSource {
  reference: PackageSourceReferenceV1;
  amount: string;
  currencyCode: string;
  capacity: number | null;
  observedAt: string;
  approved: true;
  snapshot: Readonly<Record<string, unknown>>;
}

export interface PackagePricingSourcePort {
  resolve(
    references: readonly PackageSourceReferenceV1[],
    branchId: string,
    outputCurrencyCode: string,
  ): Promise<{
    sources: readonly PackagePricingResolvedSource[];
    fxSnapshot: Readonly<Record<string, unknown>> | null;
  }>;
  recheck(
    sources: readonly PackagePricingResolvedSource[],
    branchId: string,
    requiredCapacity: number,
  ): Promise<void>;
}

@Injectable()
export class FailClosedPackagePricingSourceAdapter implements PackagePricingSourcePort {
  async resolve(): Promise<never> {
    throw new UnprocessableEntityException({
      code: 'SOURCE_RATE_UNAVAILABLE',
      message:
        'قرارداد عمومی نرخ پایه هتل/بلیت هنوز منتشر نشده است؛ نسخه قیمت ساخته نشد.',
    });
  }

  async recheck(): Promise<never> {
    throw new UnprocessableEntityException({
      code: 'CAPACITY_RECHECK_FAILED',
      message:
        'قرارداد Recheck ظرفیت و وضعیت منبع در دسترس نیست؛ انتشار انجام نشد.',
    });
  }
}
