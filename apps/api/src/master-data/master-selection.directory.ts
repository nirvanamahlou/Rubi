import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  MasterDataListQuery,
  MasterDataRecord,
  MasterDataResource,
} from '@nora/contracts';
import { canSelectForWorkflow } from '../common/workflow-selection.policy';
import { MasterDataService } from './master-data.service';
const fields: Partial<Record<MasterDataResource, readonly string[]>> = {
  countries: ['englishName', 'iso2Code'],
  cities: ['englishName', 'countryId'],
  airports: ['englishName', 'cityId', 'iataCode', 'icaoCode', 'ianaTimezone'],
  airlines: ['englishName'],
  hotels: [
    'englishName',
    'cityId',
    'roomTypeIds',
    'starRating',
    'website',
    'mealServiceCodes',
    'mealServiceNames',
  ],
  'room-types': ['englishName', 'referenceCapacity'],
  'meal-services': ['englishName'],
  'visa-services': ['countryId'],
  banks: [],
  currencies: ['englishName', 'symbol', 'decimalPlaces'],
  'insurance-plans': ['insurerId', 'insurerName'],
  'acquaintance-methods': [],
  organizations: ['roleCodes'],
  suppliers: ['organizationId', 'englishName'],
  brokers: ['cityId', 'englishName'],
  'sales-channels': [],
  'aircraft-types': [],
  'cabin-classes': [],
  'baggage-rules': [],
  'rail-companies': [],
  'train-types': [],
  'bus-companies': [],
  'bus-types': [],
};
const geography: MasterDataResource[] = ['countries', 'cities'];
const travel: MasterDataResource[] = [
  ...geography,
  'airlines',
  'airports',
  'hotels',
  'room-types',
  'meal-services',
  'currencies',
  'banks',
  'visa-services',
  'brokers',
  'insurance-plans',
];
const resources: Record<string, readonly MasterDataResource[]> = {
  sales: [...travel, 'organizations', 'acquaintance-methods'],
  reservations: travel,
  customers: [...geography, 'organizations', 'acquaintance-methods'],
  organizations: [...geography, 'currencies', 'organizations'],
  accounting: ['currencies', 'sales-channels'],
  marketing: ['organizations'],
  procurement: ['suppliers', 'brokers', 'currencies', 'organizations'],
  'ticket-catalog': [
    ...geography,
    'airports',
    'airlines',
    'currencies',
    'hotels',
    'insurance-plans',
    'aircraft-types',
    'cabin-classes',
    'baggage-rules',
    'rail-companies',
    'train-types',
    'bus-companies',
    'bus-types',
  ],
};
@Injectable()
export class MasterSelectionDirectory {
  constructor(
    @Inject(MasterDataService) private readonly master: MasterDataService,
  ) {}
  private authorize(
    actor: AuthenticatedActor,
    workflow: string,
    resource: string,
  ): MasterDataResource {
    if (!canSelectForWorkflow(actor, workflow)) throw new ForbiddenException();
    if (
      !resources[workflow]?.includes(resource as MasterDataResource) ||
      !Object.hasOwn(fields, resource)
    )
      throw new BadRequestException('Unsupported workflow reference');
    return resource as MasterDataResource;
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
  async list(
    actor: AuthenticatedActor,
    workflow: string,
    value: string,
    query: Pick<
      MasterDataListQuery,
      | 'search'
      | 'page'
      | 'pageSize'
      | 'countryId'
      | 'cityId'
      | 'organizationRole'
    >,
  ) {
    const resource = this.authorize(actor, workflow, value);
    const result = await this.master.list(
      resource,
      {
        search: query.search,
        page: query.page,
        pageSize: query.pageSize,
        status: 'active',
        sortBy: 'name',
        sortDirection: 'asc',
        ...(query.countryId ? { countryId: query.countryId } : {}),
        ...(query.cityId ? { cityId: query.cityId } : {}),
        ...(query.organizationRole
          ? { organizationRole: query.organizationRole }
          : {}),
      },
      true,
    );
    return {
      data: result.data
        .filter((row) => row.resource === resource && row.status === 'active')
        .map((row) => this.project(row)),
      meta: result.meta,
    };
  }
  async detail(
    actor: AuthenticatedActor,
    workflow: string,
    value: string,
    id: string,
  ) {
    const resource = this.authorize(actor, workflow, value);
    const { data } = await this.master.detail(resource, id);
    return { data: this.project(data) };
  }
}
