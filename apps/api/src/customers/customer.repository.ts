import { Inject, Injectable } from '@nestjs/common';
import type {
  CustomerAddressRequest,
  CustomerContactRequest,
  CustomerDetail,
  CustomerListQuery,
  CustomerSummary,
} from '@rubi/contracts';
import type { Prisma } from '@rubi/database';
import {
  AuditOutcome,
  CustomerAddressType,
  CustomerConsentChannel,
  CustomerConsentPurpose,
  CustomerConsentStatus,
  CustomerContactType,
  CustomerDuplicateReviewStatus,
  CustomerKind,
  CustomerRelationshipType,
} from '@rubi/database';

import { DatabaseService } from '../database/database.service';

interface CustomerRow {
  id: string;
  kind: CustomerKind;
  organizationId: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  birthDate: Date | null;
  isActive: boolean;
  isCustomer: boolean;
  isPassenger: boolean;
  acquaintanceMethodId: string | null;
  ownerBranchId: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  contacts?: Array<{
    id: string;
    type: CustomerContactType;
    label: string | null;
    maskedValue: string;
    valueHash: string;
    isPrimary: boolean;
    verifiedAt: Date | null;
    createdAt: Date;
  }>;
  addresses?: Array<{
    id: string;
    type: CustomerAddressType;
    label: string;
    cityId: string | null;
    isPrimary: boolean;
    createdAt: Date;
  }>;
  consents?: Array<{
    id: string;
    purpose: CustomerConsentPurpose;
    channel: CustomerConsentChannel;
    status: CustomerConsentStatus;
    source: string;
    reason: string;
    occurredAt: Date;
    createdAt: Date;
  }>;
  relationships?: Array<{
    id: string;
    relatedCustomerId: string;
    relationshipType: CustomerRelationshipType;
    createdAt: Date;
    relatedCustomer: { displayName: string };
  }>;
  _count?: { relationships: number };
}

const detailInclude: Prisma.CustomerInclude = {
  contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
  addresses: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
  consents: { orderBy: { occurredAt: 'desc' } },
  relationships: {
    include: { relatedCustomer: { select: { displayName: true } } },
    orderBy: { createdAt: 'asc' },
  },
  _count: { select: { relationships: true } },
};

function json(value: unknown): object {
  return JSON.parse(JSON.stringify(value)) as object;
}

const lower = (value: string) => value.toLowerCase().replaceAll('_', '-');

export function toCustomerSummary(row: CustomerRow): CustomerSummary {
  const primary =
    row.contacts?.find(({ isPrimary }) => isPrimary) ?? row.contacts?.[0];
  const latestConsent = row.consents?.[0];
  return {
    id: row.id,
    kind: lower(row.kind) as CustomerSummary['kind'],
    organizationId: row.organizationId,
    displayName: row.displayName,
    status: row.isActive ? 'active' : 'inactive',
    roles: [
      ...(row.isCustomer ? (['customer'] as const) : []),
      ...(row.isPassenger ? (['passenger'] as const) : []),
    ],
    maskedPrimaryContact: primary?.maskedValue ?? null,
    currentConsentStatus: latestConsent
      ? (lower(latestConsent.status) as 'granted' | 'revoked')
      : 'not-recorded',
    companionCount: row._count?.relationships ?? row.relationships?.length ?? 0,
    ownerBranchId: row.ownerBranchId,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCustomerDetail(
  row: CustomerRow,
  sensitive: boolean,
): CustomerDetail {
  return {
    ...toCustomerSummary(row),
    firstName: row.firstName,
    lastName: row.lastName,
    birthDate:
      sensitive && row.birthDate
        ? row.birthDate.toISOString().slice(0, 10)
        : null,
    birthDateMasked: Boolean(row.birthDate) && !sensitive,
    acquaintanceMethodId: row.acquaintanceMethodId,
    contacts: (row.contacts ?? []).map((contact) => ({
      id: contact.id,
      type: lower(contact.type) as 'phone' | 'email',
      label: contact.label,
      maskedValue: contact.maskedValue,
      isPrimary: contact.isPrimary,
      verifiedAt: contact.verifiedAt?.toISOString() ?? null,
      createdAt: contact.createdAt.toISOString(),
    })),
    addresses: (row.addresses ?? []).map((address) => ({
      id: address.id,
      type: lower(address.type) as CustomerDetail['addresses'][number]['type'],
      label: address.label,
      cityId: address.cityId,
      isPrimary: address.isPrimary,
      createdAt: address.createdAt.toISOString(),
    })),
    consents: (row.consents ?? []).map((consent) => ({
      id: consent.id,
      purpose: lower(consent.purpose) as 'marketing',
      channel: lower(
        consent.channel,
      ) as CustomerDetail['consents'][number]['channel'],
      status: lower(consent.status) as 'granted' | 'revoked',
      source: consent.source,
      reason: consent.reason,
      occurredAt: consent.occurredAt.toISOString(),
      createdAt: consent.createdAt.toISOString(),
    })),
    companions: (row.relationships ?? []).map((relationship) => ({
      id: relationship.id,
      relatedCustomerId: relationship.relatedCustomerId,
      relatedDisplayName: relationship.relatedCustomer.displayName,
      relationshipType: lower(
        relationship.relationshipType,
      ) as CustomerDetail['companions'][number]['relationshipType'],
      createdAt: relationship.createdAt.toISOString(),
    })),
    mergeAvailability: 'blocked-by-open-decision',
  };
}

@Injectable()
export class CustomerRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async list(branchIds: readonly string[], query: CustomerListQuery) {
    const where: Record<string, unknown> = {
      ownerBranchId: { in: [...branchIds] },
      mergedIntoId: null,
    };
    if (query.status !== 'all') where.isActive = query.status === 'active';
    if (query.role === 'customer') where.isCustomer = true;
    if (query.role === 'passenger') where.isPassenger = true;
    if (query.search) {
      where.OR = [
        { displayName: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        {
          contacts: {
            some: {
              maskedValue: { contains: query.search, mode: 'insensitive' },
            },
          },
        },
      ];
    }
    const [rows, total] = await Promise.all([
      this.database.client.customer.findMany({
        where,
        include: {
          contacts: { where: { isPrimary: true }, take: 1 },
          consents: { orderBy: { occurredAt: 'desc' }, take: 1 },
          _count: { select: { relationships: true } },
        },
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.database.client.customer.count({ where }),
    ]);
    return { rows: rows as unknown as CustomerRow[], total };
  }

  async find(id: string, branchIds: readonly string[]) {
    return this.database.client.customer.findFirst({
      where: { id, ownerBranchId: { in: [...branchIds] }, mergedIntoId: null },
      include: detailInclude,
    }) as unknown as Promise<CustomerRow | null>;
  }

  async create(
    data: Record<string, unknown>,
    actorUserId: string,
    actorBranchId: string,
    traceId?: string,
  ) {
    return this.database.client.$transaction(async (transaction) => {
      const row = await transaction.customer.create({
        data: {
          ...data,
          ownerBranchId: actorBranchId,
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId,
        } as Prisma.CustomerUncheckedCreateInput,
        include: detailInclude,
      });
      await transaction.customerStatusHistory.create({
        data: {
          customerId: row.id,
          fromStatus: 'none',
          toStatus: 'active',
          reason: 'customer-created',
          changedByUserId: actorUserId,
          actorBranchId,
        },
      });
      await transaction.customerAuditEvent.create({
        data: {
          actorUserId,
          actorBranchId,
          action: 'customers.create',
          entityType: 'customer',
          entityId: row.id,
          outcome: AuditOutcome.SUCCESS,
          afterSnapshot: json(row),
          traceId: traceId ?? null,
        },
      });
      return row as unknown as CustomerRow;
    });
  }

  async update(
    id: string,
    branchIds: readonly string[],
    data: Record<string, unknown>,
    expectedVersion: number,
    actorUserId: string,
    actorBranchId: string,
    traceId?: string,
  ) {
    return this.database.client.$transaction(async (transaction) => {
      const before = await transaction.customer.findFirst({
        where: {
          id,
          ownerBranchId: { in: [...branchIds] },
          mergedIntoId: null,
        },
      });
      if (!before || before.version !== expectedVersion) return null;
      const claim = await transaction.customer.updateMany({
        where: { id, version: expectedVersion },
        data: { version: { increment: 1 }, updatedByUserId: actorUserId },
      });
      if (claim.count !== 1) return null;
      const row = await transaction.customer.update({
        where: { id },
        data,
        include: detailInclude,
      });
      await transaction.customerAuditEvent.create({
        data: {
          actorUserId,
          actorBranchId,
          action: 'customers.update',
          entityType: 'customer',
          entityId: id,
          outcome: AuditOutcome.SUCCESS,
          beforeSnapshot: json(before),
          afterSnapshot: json(row),
          traceId: traceId ?? null,
        },
      });
      return row as unknown as CustomerRow;
    });
  }

  async setStatus(
    id: string,
    branchIds: readonly string[],
    isActive: boolean,
    expectedVersion: number,
    reason: string,
    actorUserId: string,
    actorBranchId: string,
    traceId?: string,
  ) {
    return this.database.client.$transaction(async (transaction) => {
      const before = await transaction.customer.findFirst({
        where: {
          id,
          ownerBranchId: { in: [...branchIds] },
          mergedIntoId: null,
        },
      });
      if (!before || before.version !== expectedVersion) return null;
      const claim = await transaction.customer.updateMany({
        where: { id, version: expectedVersion },
        data: {
          version: { increment: 1 },
          updatedByUserId: actorUserId,
          isActive,
          deactivatedAt: isActive ? null : new Date(),
          deactivatedByUserId: isActive ? null : actorUserId,
        },
      });
      if (claim.count !== 1) return null;
      await transaction.customerStatusHistory.create({
        data: {
          customerId: id,
          fromStatus: before.isActive ? 'active' : 'inactive',
          toStatus: isActive ? 'active' : 'inactive',
          reason,
          changedByUserId: actorUserId,
          actorBranchId,
        },
      });
      const row = await transaction.customer.findUniqueOrThrow({
        where: { id },
        include: detailInclude,
      });
      await transaction.customerAuditEvent.create({
        data: {
          actorUserId,
          actorBranchId,
          action: 'customers.status',
          entityType: 'customer',
          entityId: id,
          outcome: AuditOutcome.SUCCESS,
          reason,
          beforeSnapshot: json({
            isActive: before.isActive,
            version: before.version,
          }),
          afterSnapshot: json({ isActive, version: row.version }),
          traceId: traceId ?? null,
        },
      });
      return row as unknown as CustomerRow;
    });
  }

  async addContact(
    id: string,
    branchIds: readonly string[],
    input: Omit<CustomerContactRequest, 'value'> & {
      maskedValue: string;
      valueHash: string;
    },
    actorUserId: string,
    actorBranchId: string,
    traceId?: string,
  ) {
    return this.childMutation(
      id,
      branchIds,
      input.version,
      actorUserId,
      actorBranchId,
      'customers.contact.create',
      traceId,
      async (transaction) => {
        if (input.isPrimary)
          await transaction.customerContact.updateMany({
            where: {
              customerId: id,
              type: input.type.toUpperCase() as CustomerContactType,
            },
            data: { isPrimary: false },
          });
        return transaction.customerContact.create({
          data: {
            customerId: id,
            type: input.type.toUpperCase() as CustomerContactType,
            label: input.label ?? null,
            maskedValue: input.maskedValue,
            valueHash: input.valueHash,
            isPrimary: input.isPrimary ?? false,
            createdByUserId: actorUserId,
          },
        });
      },
    );
  }

  async addAddress(
    id: string,
    branchIds: readonly string[],
    input: CustomerAddressRequest,
    actorUserId: string,
    actorBranchId: string,
    traceId?: string,
  ) {
    return this.childMutation(
      id,
      branchIds,
      input.version,
      actorUserId,
      actorBranchId,
      'customers.address.create',
      traceId,
      async (transaction) => {
        if (input.isPrimary)
          await transaction.customerAddress.updateMany({
            where: { customerId: id },
            data: { isPrimary: false },
          });
        return transaction.customerAddress.create({
          data: {
            customerId: id,
            type: input.type.toUpperCase() as CustomerAddressType,
            label: input.label.trim(),
            cityId: input.cityId ?? null,
            isPrimary: input.isPrimary ?? false,
            createdByUserId: actorUserId,
          },
        });
      },
    );
  }

  async addConsent(
    id: string,
    branchIds: readonly string[],
    input: {
      purpose: 'marketing';
      channel: 'sms' | 'email' | 'phone' | 'all';
      status: 'granted' | 'revoked';
      source: string;
      reason: string;
      occurredAt?: string;
      version: number;
    },
    actorUserId: string,
    actorBranchId: string,
    traceId?: string,
  ) {
    return this.childMutation(
      id,
      branchIds,
      input.version,
      actorUserId,
      actorBranchId,
      'customers.consent.create',
      traceId,
      (transaction) =>
        transaction.customerConsent.create({
          data: {
            customerId: id,
            purpose: input.purpose.toUpperCase() as CustomerConsentPurpose,
            channel: input.channel.toUpperCase() as CustomerConsentChannel,
            status: input.status.toUpperCase() as CustomerConsentStatus,
            source: input.source.trim(),
            reason: input.reason.trim(),
            occurredAt: input.occurredAt
              ? new Date(input.occurredAt)
              : new Date(),
            recordedByUserId: actorUserId,
          },
        }),
    );
  }

  async addCompanion(
    id: string,
    branchIds: readonly string[],
    input: {
      relatedCustomerId: string;
      relationshipType: 'family' | 'companion' | 'guardian' | 'dependent';
      version: number;
    },
    actorUserId: string,
    actorBranchId: string,
    traceId?: string,
  ) {
    return this.childMutation(
      id,
      branchIds,
      input.version,
      actorUserId,
      actorBranchId,
      'customers.companion.create',
      traceId,
      async (transaction) => {
        const related = await transaction.customer.findFirst({
          where: {
            id: input.relatedCustomerId,
            ownerBranchId: { in: [...branchIds] },
            mergedIntoId: null,
          },
        });
        if (!related) return null;
        return transaction.customerRelationship.create({
          data: {
            customerId: id,
            relatedCustomerId: input.relatedCustomerId,
            relationshipType:
              input.relationshipType.toUpperCase() as CustomerRelationshipType,
            createdByUserId: actorUserId,
          },
        });
      },
    );
  }

  async duplicateInputs(
    sourceCustomerId: string,
    branchIds: readonly string[],
  ) {
    const source = await this.database.client.customer.findFirst({
      where: {
        id: sourceCustomerId,
        ownerBranchId: { in: [...branchIds] },
        mergedIntoId: null,
      },
      include: { contacts: true },
    });
    if (!source) return null;
    const candidates = await this.database.client.customer.findMany({
      where: {
        id: { not: sourceCustomerId },
        ownerBranchId: { in: [...branchIds] },
        mergedIntoId: null,
      },
      include: { contacts: true },
    });
    return { source, candidates };
  }

  async saveDuplicateCandidate(
    input: {
      sourceCustomerId: string;
      candidateCustomerId: string;
      score: number;
      reasons: string[];
    },
    actorUserId: string,
    actorBranchId: string,
    traceId?: string,
  ) {
    return this.database.client.$transaction(async (transaction) => {
      const candidate = await transaction.customerDuplicateCandidate.upsert({
        where: {
          sourceCustomerId_candidateCustomerId: {
            sourceCustomerId: input.sourceCustomerId,
            candidateCustomerId: input.candidateCustomerId,
          },
        },
        create: { ...input, createdByUserId: actorUserId },
        update: { score: input.score, reasons: input.reasons },
        include: { candidateCustomer: { select: { displayName: true } } },
      });
      await transaction.customerAuditEvent.create({
        data: {
          actorUserId,
          actorBranchId,
          action: 'customers.duplicate.detected',
          entityType: 'customer_duplicate_candidate',
          entityId: candidate.id,
          outcome: AuditOutcome.SUCCESS,
          afterSnapshot: json({
            score: candidate.score,
            reasons: candidate.reasons,
            autoMerged: false,
          }),
          traceId: traceId ?? null,
        },
      });
      return candidate;
    });
  }

  async reviewDuplicate(
    id: string,
    branchIds: readonly string[],
    status: 'confirmed-distinct' | 'merge-proposed',
    reason: string,
    expectedVersion: number,
    actorUserId: string,
    actorBranchId: string,
    traceId?: string,
  ) {
    return this.database.client.$transaction(async (transaction) => {
      const before = await transaction.customerDuplicateCandidate.findFirst({
        where: {
          id,
          sourceCustomer: { ownerBranchId: { in: [...branchIds] } },
        },
      });
      if (!before || before.version !== expectedVersion) return null;
      const claim = await transaction.customerDuplicateCandidate.updateMany({
        where: { id, version: expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (claim.count !== 1) return null;
      const row = await transaction.customerDuplicateCandidate.update({
        where: { id },
        data: {
          reviewStatus:
            status === 'confirmed-distinct'
              ? CustomerDuplicateReviewStatus.CONFIRMED_DISTINCT
              : CustomerDuplicateReviewStatus.MERGE_PROPOSED,
          reviewReason: reason,
          reviewedByUserId: actorUserId,
          reviewedAt: new Date(),
        },
        include: { candidateCustomer: { select: { displayName: true } } },
      });
      await transaction.customerAuditEvent.create({
        data: {
          actorUserId,
          actorBranchId,
          action: 'customers.duplicate.review',
          entityType: 'customer_duplicate_candidate',
          entityId: id,
          outcome: AuditOutcome.SUCCESS,
          reason,
          beforeSnapshot: json(before),
          afterSnapshot: json({
            reviewStatus: row.reviewStatus,
            version: row.version,
            mergeExecuted: false,
          }),
          traceId: traceId ?? null,
        },
      });
      return row;
    });
  }
  private async childMutation(
    id: string,
    branchIds: readonly string[],
    version: number,
    actorUserId: string,
    actorBranchId: string,
    action: string,
    traceId: string | undefined,
    mutate: (transaction: Prisma.TransactionClient) => Promise<unknown>,
  ) {
    return this.database.client.$transaction(async (transaction) => {
      const customer = await transaction.customer.findFirst({
        where: {
          id,
          ownerBranchId: { in: [...branchIds] },
          mergedIntoId: null,
        },
      });
      if (!customer || customer.version !== version) return null;
      const claim = await transaction.customer.updateMany({
        where: { id, version },
        data: { version: { increment: 1 }, updatedByUserId: actorUserId },
      });
      if (claim.count !== 1) return null;
      const child = await mutate(transaction);
      await transaction.customerAuditEvent.create({
        data: {
          actorUserId,
          actorBranchId,
          action,
          entityType: 'customer',
          entityId: id,
          outcome: AuditOutcome.SUCCESS,
          afterSnapshot: json(child),
          traceId: traceId ?? null,
        },
      });
      return transaction.customer.findUniqueOrThrow({
        where: { id },
        include: detailInclude,
      }) as unknown as CustomerRow;
    });
  }
}
