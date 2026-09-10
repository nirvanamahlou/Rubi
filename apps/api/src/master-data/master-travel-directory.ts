import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { MasterDataService } from './master-data.service';

/** Public, non-PII reference validation for Ticket Catalog consumers. */
@Injectable()
export class MasterTravelDirectory {
  constructor(
    @Inject(MasterDataService) private readonly master: MasterDataService,
  ) {}

  /** Public non-sensitive choices for Reservations purchase rate capture. */
  async hotelRateChoices(
    kind: 'hotels' | 'organizations',
    search: string,
    page: number,
  ) {
    const result = await this.master.list(kind, {
      page,
      pageSize: 50,
      sortBy: 'name',
      sortDirection: 'asc',
      search,
      status: 'active',
      ...(kind === 'organizations'
        ? { organizationRole: 'BROKER' as const }
        : {}),
    });
    return {
      data: result.data.map((row) => ({
        id: row.id,
        name:
          kind === 'hotels'
            ? String(row.attributes.englishName || row.name)
            : row.name,
      })),
      meta: result.meta,
    };
  }

  async hotelRateReference(hotelId: string, brokerId: string) {
    const [{ data: hotel }, { data: broker }] = await Promise.all([
      this.master.detail('hotels', hotelId),
      this.master.detail('organizations', brokerId),
    ]);
    if (
      hotel.status !== 'active' ||
      broker.status !== 'active' ||
      !String(broker.attributes.roleCodes ?? '')
        .split(',')
        .includes('BROKER')
    )
      throw new BadRequestException(
        'هتل و کارگزار باید فعال و کارگزار دارای نقش مربوط باشد.',
      );
    return {
      hotelName: String(hotel.attributes.englishName || hotel.name),
      brokerName: broker.name,
    };
  }

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
