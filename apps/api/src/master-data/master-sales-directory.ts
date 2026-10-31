import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  MasterDataRecord,
  MasterDataResource,
} from '@nora/contracts';
import { MasterDataService } from './master-data.service';
import { MasterOrganizationDirectory } from './master-organization-directory';

/** Public contract picker projection, not a Master Data administration API. */
const fields: Partial<Record<MasterDataResource, readonly string[]>> = {
  countries: ['englishName', 'iso2Code'],
  cities: ['englishName', 'countryId'],
  hotels: ['englishName', 'cityId', 'roomTypeIds', 'starRating', 'website'],
  'composite-hotels': ['memberHotels', 'memberHotelIds'],
  'room-types': ['englishName'],
  'visa-services': ['countryId'],
  banks: [],
  currencies: ['englishName', 'symbol', 'decimalPlaces'],
  airlines: ['englishName'],
  'insurance-plans': ['insurerId', 'insurerName'],
  'acquaintance-methods': [],
  organizations: [],
};

@Injectable()
export class MasterSalesDirectory {
  constructor(
    @Inject(MasterDataService) private readonly master: MasterDataService,
    @Inject(MasterOrganizationDirectory)
    private readonly organizations: MasterOrganizationDirectory,
  ) {}

  private resource(value: string): MasterDataResource {
    if (!Object.hasOwn(fields, value))
      throw new BadRequestException('Unsupported contract reference');
    return value as MasterDataResource;
  }

  private project(row: MasterDataRecord): MasterDataRecord {
    return {
      id: row.id,
      resource: row.resource,
      code: row.code,
      name: row.name,
      status: row.status,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      attributes: Object.fromEntries(
        (fields[row.resource] ?? [])
          .filter((key) => Object.hasOwn(row.attributes, key))
          .map((key) => [key, row.attributes[key]!]),
      ),
    };
  }

  async list(value: string, search: string, page: number, pageSize: number) {
    const resource = this.resource(value);
    const result = await this.master.list(resource, {
      search,
      page,
      pageSize,
      status: 'active',
      sortBy: 'name',
      sortDirection: 'asc',
    });
    return {
      data: result.data
        .filter((row) => row.status === 'active' && row.resource === resource)
        .map((row) => this.project(row)),
      meta: result.meta,
    };
  }

  async detail(value: string, id: string) {
    const resource = this.resource(value);
    const { data } = await this.master.detail(resource, id);
    if (data.status !== 'active' || data.resource !== resource)
      throw new NotFoundException();
    return { data: this.project(data) };
  }

  async agencyBuyerContact(
    id: string,
    actor: AuthenticatedActor,
    branchId?: string,
  ) {
    const { data: organization } = await this.detail('organizations', id);
    const [values, addresses] = await Promise.all([
      this.master.salesOrganizationPhones(id, actor, branchId),
      this.organizations.addresses(id),
    ]);
    const phones = values.filter((value): value is string =>
      Boolean(value && !value.includes('*')),
    );
    const mobile = phones.find((value) => /^(\+98|0)?9/.test(value));
    const office = phones.find((value) => !/^(\+98|0)?9/.test(value));
    const active = addresses.filter((address) => address.isActive);
    const address = active.find((value) => value.isPrimary) ?? active[0];
    return {
      data: {
        name: organization.name,
        phone: mobile ?? office ?? '',
        landline: office ?? '',
        address: address?.addressLine ?? '',
        postalCode: address?.postalCode ?? '',
      },
    };
  }
}
