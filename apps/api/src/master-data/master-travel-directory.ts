import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { MasterDataService } from './master-data.service';

/** Public, non-PII reference validation for Ticket Catalog consumers. */
@Injectable()
export class MasterTravelDirectory {
  constructor(
    @Inject(MasterDataService) private readonly master: MasterDataService,
  ) {}

  async assertTourReferences(input: {
    originId: string;
    destinationId: string;
    hotelIds: readonly string[];
    insuranceId?: string;
  }) {
    for (const cityId of [input.originId, input.destinationId]) {
      const { data } = await this.master.detail('cities', cityId);
      if (data.status !== 'active')
        throw new BadRequestException('شهر تور غیرفعال است.');
    }
    for (const hotelId of input.hotelIds) {
      const { data } = await this.master.detail('hotels', hotelId);
      if (
        data.status !== 'active' ||
        data.attributes.cityId !== input.destinationId
      )
        throw new BadRequestException(
          'هتل باید فعال و متعلق به شهر مقصد تور باشد.',
        );
    }
    if (input.insuranceId) {
      const { data } = await this.master.detail(
        'insurance-plans',
        input.insuranceId,
      );
      if (data.status !== 'active')
        throw new BadRequestException('بیمه انتخاب‌شده فعال نیست.');
    }
  }
}
