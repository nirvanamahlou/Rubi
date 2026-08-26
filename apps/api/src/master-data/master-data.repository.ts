import { Inject, Injectable } from '@nestjs/common';
import type {
  MasterDataListQuery,
  MasterDataRecord,
  MasterDataResource,
} from '@rubi/contracts';
import { AuditOutcome } from '@rubi/database';

import { DatabaseService } from '../database/database.service';

type Row = Record<string, unknown> & {
  id: string;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

interface Delegate {
  findFirst(args: object): Promise<Row | null>;
  findMany(args: object): Promise<Row[]>;
  findUnique(args: object): Promise<Row | null>;
  count(args: object): Promise<number>;
  create(args: object): Promise<Row>;
  update(args: object): Promise<Row>;
  updateMany(args: object): Promise<{ count: number }>;
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

function json(value: unknown): Exclude<JsonValue, null> {
  return JSON.parse(JSON.stringify(value)) as Exclude<JsonValue, null>;
}

const delegateNames: Record<MasterDataResource, string> = {
  countries: 'masterCountry',
  cities: 'masterCity',
  currencies: 'masterCurrency',
  'exchange-rates': 'masterDraftExchangeRate',
  banks: 'masterBank',
  insurers: 'masterInsurer',
  airlines: 'masterAirline',
  hotels: 'masterHotel',
  organizations: 'masterOrganization',
  brokers: 'masterBroker',
  leaders: 'masterLeader',
  'acquaintance-methods': 'masterAcquaintanceMethod',
};

const nameFields: Record<MasterDataResource, string> = {
  countries: 'name',
  cities: 'name',
  currencies: 'name',
  'exchange-rates': 'source',
  banks: 'name',
  insurers: 'name',
  airlines: 'name',
  hotels: 'name',
  organizations: 'displayName',
  brokers: 'name',
  leaders: 'name',
  'acquaintance-methods': 'name',
};

function delegate(client: unknown, resource: MasterDataResource): Delegate {
  return (client as Record<string, Delegate>)[
    delegateNames[resource]
  ] as Delegate;
}

function relations(resource: MasterDataResource): object | undefined {
  if (resource === 'exchange-rates')
    return { fromCurrency: true, toCurrency: true };
  if (resource === 'organizations') return { roles: true };
  return undefined;
}

function scalar(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(String).join(',');
  if (typeof value === 'object' && 'toString' in value) return String(value);
  return null;
}

export function toMasterDataRecord(
  resource: MasterDataResource,
  row: Row,
): MasterDataRecord {
  const from = row.fromCurrency as Record<string, unknown> | undefined;
  const to = row.toCurrency as Record<string, unknown> | undefined;
  const roles = row.roles as { roleCode: string }[] | undefined;
  const code =
    resource === 'exchange-rates'
      ? `${String(from?.code ?? '')}/${String(to?.code ?? '')}`
      : String(row.code ?? '');
  const name =
    resource === 'organizations'
      ? String(row.displayName ?? '')
      : resource === 'exchange-rates'
        ? `${code} · ${String(row.source ?? '')}`
        : String(row.name ?? '');
  const omitted = new Set([
    'id',
    'code',
    'name',
    'displayName',
    'isActive',
    'version',
    'createdAt',
    'updatedAt',
    'createdByUserId',
    'updatedByUserId',
    'deactivatedByUserId',
    'deactivatedAt',
    'fromCurrency',
    'toCurrency',
    'roles',
  ]);
  const attributes = Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !omitted.has(key))
      .map(([key, value]) => [key, scalar(value)]),
  );
  if (resource === 'exchange-rates') {
    attributes.fromCurrencyCode = String(from?.code ?? '');
    attributes.toCurrencyCode = String(to?.code ?? '');
  }
  if (resource === 'organizations') attributes.displayName = name;
  if (roles)
    attributes.roleCodes = roles.map(({ roleCode }) => roleCode).join(',');
  return {
    id: row.id,
    resource,
    code,
    name,
    status: row.isActive ? 'active' : 'inactive',
    attributes,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class MasterDataRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async list(resource: MasterDataResource, query: MasterDataListQuery) {
    const model = delegate(this.database.client, resource);
    const nameField = nameFields[resource];
    const where: Record<string, unknown> = {};
    if (query.status !== 'all') where.isActive = query.status === 'active';
    if (query.search) {
      where.OR =
        resource === 'exchange-rates'
          ? [{ source: { contains: query.search, mode: 'insensitive' } }]
          : [
              { [nameField]: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ];
    }
    const sortField =
      query.sortBy === 'name'
        ? nameField
        : resource === 'exchange-rates' && query.sortBy === 'code'
          ? 'observedAt'
          : query.sortBy;
    const args: Record<string, unknown> = {
      where,
      orderBy: { [sortField]: query.sortDirection },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    };
    const include = relations(resource);
    if (include) args.include = include;
    const [rows, total] = await Promise.all([
      model.findMany(args),
      model.count({ where }),
    ]);
    return { rows, total };
  }

  async find(resource: MasterDataResource, id: string) {
    const args: Record<string, unknown> = { where: { id } };
    const include = relations(resource);
    if (include) args.include = include;
    return delegate(this.database.client, resource).findUnique(args);
  }

  async codeExists(resource: MasterDataResource, code: string) {
    if (resource === 'exchange-rates') return false;
    return Boolean(
      await delegate(this.database.client, resource).findFirst({
        where: { code },
      }),
    );
  }

  async create(
    resource: MasterDataResource,
    data: Record<string, unknown>,
    actorUserId: string,
    actorBranchId: string,
  ) {
    return this.database.client.$transaction(async (transaction) => {
      const row = await delegate(transaction, resource).create({
        data: {
          ...data,
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId,
        },
        ...(relations(resource) ? { include: relations(resource) } : {}),
      });
      await transaction.masterDataAuditEvent.create({
        data: {
          actorUserId,
          actorBranchId,
          action: 'master_data.create',
          resource,
          entityId: row.id,
          outcome: AuditOutcome.SUCCESS,
          afterSnapshot: json(row),
        },
      });
      return row;
    });
  }

  async update(
    resource: MasterDataResource,
    id: string,
    data: Record<string, unknown>,
    expectedVersion: number,
    actorUserId: string,
    actorBranchId: string,
  ) {
    return this.database.client.$transaction(async (transaction) => {
      const model = delegate(transaction, resource);
      const before = await model.findUnique({ where: { id } });
      if (!before || before.version !== expectedVersion) return null;
      const claimed = await model.updateMany({
        where: { id, version: expectedVersion },
        data: { updatedByUserId: actorUserId, version: { increment: 1 } },
      });
      if (claimed.count !== 1) return null;

      const row = await model.update({
        where: { id },
        data: {
          ...data,
        },
        ...(relations(resource) ? { include: relations(resource) } : {}),
      });
      await transaction.masterDataAuditEvent.create({
        data: {
          actorUserId,
          actorBranchId,
          action: 'master_data.update',
          resource,
          entityId: id,
          outcome: AuditOutcome.SUCCESS,
          beforeSnapshot: json(before),
          afterSnapshot: json(row),
        },
      });
      return row;
    });
  }

  async setStatus(
    resource: MasterDataResource,
    id: string,
    isActive: boolean,
    expectedVersion: number,
    actorUserId: string,
    actorBranchId: string,
  ) {
    const now = new Date();
    return this.update(
      resource,
      id,
      {
        isActive,
        deactivatedAt: isActive ? null : now,
        deactivatedByUserId: isActive ? null : actorUserId,
      },
      expectedVersion,
      actorUserId,
      actorBranchId,
    );
  }

  async createExport(data: {
    resource: MasterDataResource;
    format: 'XLSX' | 'PDF';
    filterSnapshot: Record<string, unknown>;
    columns: string[];
    permissionSnapshot: string[];
    actorUserId: string;
    actorBranchId: string;
    locale: string;
    timezone: string;
  }) {
    return this.database.client.$transaction(async (transaction) => {
      const request = await transaction.masterDataExportRequest.create({
        data: { ...data, filterSnapshot: json(data.filterSnapshot) },
      });
      await transaction.masterDataAuditEvent.create({
        data: {
          actorUserId: data.actorUserId,
          actorBranchId: data.actorBranchId,
          action: 'master_data.export.requested',
          resource: data.resource,
          entityId: request.id,
          outcome: AuditOutcome.SUCCESS,
          afterSnapshot: json({
            format: data.format,
            filters: data.filterSnapshot,
            columns: data.columns,
            status: request.status,
          }),
        },
      });
      return request;
    });
  }

  findExport(id: string, actorUserId: string) {
    return this.database.client.masterDataExportRequest.findFirst({
      where: { id, actorUserId },
    });
  }
}
