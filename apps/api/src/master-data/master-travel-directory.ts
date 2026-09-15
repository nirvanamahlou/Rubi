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

  /** Public non-sensitive validation for a broker selected on a service purchase. */
  async brokerReference(brokerId: string) {
    const { data: broker } = await this.master.detail(
      'organizations',
      brokerId,
    );
    if (
      broker.status !== 'active' ||
      !String(broker.attributes.roleCodes ?? '')
        .split(',')
        .includes('BROKER')
    )
      throw new BadRequestException(
        'کارگزار باید فعال و دارای نقش کارگزار باشد.',
      );
    return { id: broker.id, name: broker.name };
  }

  async cityReference(cityId: string) {
    const { data } = await this.master.detail('cities', cityId);
    if (data.status !== 'active')
      throw new BadRequestException('شهر مقصد فعال نیست.');
    return {
      id: data.id,
      name: data.name,
      englishName: String(data.attributes.englishName ?? ''),
    };
  }

  /** Public operational lookup; callers receive only the approved template reference. */
  async manifestTemplate(
    carrierName: string,
    destinationCityId: string,
    travelDay: string,
  ) {
    const normalize = (value: unknown) =>
      String(value ?? '')
        .normalize('NFKC')
        .replace(/[يى]/g, 'ی')
        .replace(/ك/g, 'ک')
        .replace(/[^A-Za-z0-9آ-ی]/g, '')
        .toUpperCase();
    const carrier = normalize(carrierName);
    const rows = [];
    let page = 1;
    for (;;) {
      const result = await this.master.list('manifest-templates', {
        page,
        pageSize: 100,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        search: '',
        status: 'active',
      });
      rows.push(...result.data);
      if (rows.length >= result.meta.total) break;
      page += 1;
    }
    const record = rows.find((row) => {
      const attributes = row.attributes;
      const validFrom = String(attributes.validFrom ?? '');
      const validTo = String(attributes.validTo ?? '');
      const airlineMatches = [
        attributes.airlineName,
        attributes.airlineCode,
      ].some((value) => {
        const candidate = normalize(value);
        return (
          candidate.length > 0 &&
          (carrier === candidate ||
            carrier.includes(candidate) ||
            candidate.includes(carrier))
        );
      });
      return (
        String(attributes.publicationStatus).toUpperCase() === 'ACTIVE' &&
        String(attributes.fileFormat).toUpperCase() === 'XLSX' &&
        String(attributes.destinationCityId) === destinationCityId &&
        typeof attributes.fileReferenceId === 'string' &&
        attributes.fileReferenceId.length > 0 &&
        airlineMatches &&
        (!validFrom || validFrom <= travelDay) &&
        (!validTo || validTo >= travelDay)
      );
    });
    if (!record) return null;
    return {
      id: record.id,
      name: record.name,
      versionNumber: Number(record.attributes.versionNumber ?? 1),
      fileReferenceId: String(record.attributes.fileReferenceId),
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
