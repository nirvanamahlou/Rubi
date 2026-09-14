import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { PackageSourceReferenceV1 } from '@nora/contracts';
import { MasterHotelBaseRatePublicService } from '../master-data/hotel-base-rates.service';

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

@Injectable()
export class VersionedPackagePricingSourceAdapter
  implements PackagePricingSourcePort
{
  constructor(
    @Inject(MasterHotelBaseRatePublicService)
    private readonly hotelRates: MasterHotelBaseRatePublicService,
  ) {}

  async resolve(
    references: readonly PackageSourceReferenceV1[],
    branchId: string,
    outputCurrencyCode: string,
  ) {
    if (
      references.some(
        (reference) =>
          reference.owner !== 'MASTER_DATA' ||
          reference.kind !== 'HOTEL_BASE_RATE',
      )
    )
      throw new UnprocessableEntityException({
        code: 'SOURCE_RATE_UNAVAILABLE',
        message:
          'قرارداد عمومی نرخ پایه همه اجزای پکیج هنوز در دسترس نیست؛ نسخه قیمت ساخته نشد.',
      });
    const rows = await this.hotelRates.resolveRateReferences(
      references,
      branchId,
      outputCurrencyCode,
    );
    return {
      sources: rows.map((row) => ({
        ...row,
        capacity: null,
        approved: true as const,
      })),
      fxSnapshot: null,
    };
  }

  async recheck(
    sources: readonly PackagePricingResolvedSource[],
    branchId: string,
  ) {
    if (
      sources.some(
        ({ reference }) =>
          reference.owner !== 'MASTER_DATA' ||
          reference.kind !== 'HOTEL_BASE_RATE',
      )
    )
      throw new UnprocessableEntityException({
        code: 'CAPACITY_RECHECK_FAILED',
      });
    await this.hotelRates.recheckRateReferences(
      sources.map(({ reference }) => reference.id),
      branchId,
    );
  }
}
