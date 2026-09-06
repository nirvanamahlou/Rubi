import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type {
  AgencyOperationalStatus,
  B2bAgreementStatus,
  B2bAgreedRateKind,
} from '@rubi/contracts';
import { Prisma } from '@rubi/database';

import { DatabaseService } from '../database/database.service';

const profileInclude = {
  agreements: { orderBy: { startsAt: 'desc' } },
  creditPolicy: true,
  agreedRates: {
    where: { isActive: true },
    orderBy: [{ validFrom: 'desc' }, { title: 'asc' }],
  },
} satisfies Prisma.AgencyOperationalProfileInclude;

function snapshot(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class B2bRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  findProfile(organizationId: string, branchId: string) {
    return this.database.client.agencyOperationalProfile.findUnique({
      where: { organizationId_branchId: { organizationId, branchId } },
      include: profileInclude,
    });
  }

  async upsertProfile(input: {
    organizationId: string;
    branchId: string;
    accountManagerUserId: string | null;
    status: AgencyOperationalStatus;
    displayOrder: number;
    expectedVersion?: number;
    actorUserId: string;
  }) {
    return this.database.client.$transaction(async (transaction) => {
      const before = await transaction.agencyOperationalProfile.findUnique({
        where: {
          organizationId_branchId: {
            organizationId: input.organizationId,
            branchId: input.branchId,
          },
        },
      });
      let row;
      if (!before) {
        row = await transaction.agencyOperationalProfile.create({
          data: {
            organizationId: input.organizationId,
            branchId: input.branchId,
            accountManagerUserId: input.accountManagerUserId,
            status: input.status,
            displayOrder: input.displayOrder,
            createdByUserId: input.actorUserId,
            updatedByUserId: input.actorUserId,
          },
        });
      } else {
        if (!input.expectedVersion || before.version !== input.expectedVersion)
          throw new ConflictException('پروفایل آژانس هم‌زمان تغییر کرده است.');
        const claimed = await transaction.agencyOperationalProfile.updateMany({
          where: { id: before.id, version: input.expectedVersion },
          data: {
            accountManagerUserId: input.accountManagerUserId,
            status: input.status,
            displayOrder: input.displayOrder,
            isActive: input.status !== 'ENDED',
            deactivatedAt: input.status === 'ENDED' ? new Date() : null,
            deactivatedByUserId:
              input.status === 'ENDED' ? input.actorUserId : null,
            updatedByUserId: input.actorUserId,
            version: { increment: 1 },
          },
        });
        if (claimed.count !== 1)
          throw new ConflictException('پروفایل آژانس هم‌زمان تغییر کرده است.');
        row = await transaction.agencyOperationalProfile.findUniqueOrThrow({
          where: { id: before.id },
        });
      }
      await transaction.b2bAuditEvent.create({
        data: {
          actorUserId: input.actorUserId,
          branchId: input.branchId,
          action: before ? 'b2b.agency.update' : 'b2b.agency.create',
          entityType: 'AgencyOperationalProfile',
          entityId: row.id,
          beforeSnapshot: before ? snapshot(before) : Prisma.JsonNull,
          afterSnapshot: snapshot(row),
        },
      });
      return row;
    });
  }

  async createAgreement(input: {
    profileId: string;
    branchId: string;
    code: string;
    title: string;
    documentReference: string | null;
    startsAt: Date;
    endsAt: Date | null;
    status: B2bAgreementStatus;
    notes: string | null;
    actorUserId: string;
  }) {
    return this.database.client.$transaction(async (transaction) => {
      const row = await transaction.b2bAgencyAgreement.create({
        data: {
          profileId: input.profileId,
          code: input.code,
          title: input.title,
          documentReference: input.documentReference,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          status: input.status,
          isActive: !['EXPIRED', 'TERMINATED'].includes(input.status),
          notes: input.notes,
          createdByUserId: input.actorUserId,
          updatedByUserId: input.actorUserId,
        },
      });
      await transaction.b2bAuditEvent.create({
        data: {
          actorUserId: input.actorUserId,
          branchId: input.branchId,
          action: 'b2b.agreement.create',
          entityType: 'B2bAgencyAgreement',
          entityId: row.id,
          afterSnapshot: snapshot(row),
        },
      });
      return row;
    });
  }

  async upsertCreditPolicy(input: {
    profileId: string;
    branchId: string;
    creditLimit: Prisma.Decimal;
    currencyCode: string;
    effectiveFrom: Date;
    expiresAt: Date | null;
    isActive: boolean;
    expectedVersion?: number;
    actorUserId: string;
  }) {
    return this.database.client.$transaction(async (transaction) => {
      const before = await transaction.b2bAgencyCreditPolicy.findUnique({
        where: { profileId: input.profileId },
      });
      let row;
      if (!before) {
        row = await transaction.b2bAgencyCreditPolicy.create({
          data: {
            profileId: input.profileId,
            creditLimit: input.creditLimit,
            currencyCode: input.currencyCode,
            effectiveFrom: input.effectiveFrom,
            expiresAt: input.expiresAt,
            isActive: input.isActive,
            createdByUserId: input.actorUserId,
            updatedByUserId: input.actorUserId,
          },
        });
      } else {
        if (!input.expectedVersion || before.version !== input.expectedVersion)
          throw new ConflictException('سیاست اعتبار هم‌زمان تغییر کرده است.');
        const claimed = await transaction.b2bAgencyCreditPolicy.updateMany({
          where: { id: before.id, version: input.expectedVersion },
          data: {
            creditLimit: input.creditLimit,
            currencyCode: input.currencyCode,
            effectiveFrom: input.effectiveFrom,
            expiresAt: input.expiresAt,
            isActive: input.isActive,
            updatedByUserId: input.actorUserId,
            version: { increment: 1 },
          },
        });
        if (claimed.count !== 1)
          throw new ConflictException('سیاست اعتبار هم‌زمان تغییر کرده است.');
        row = await transaction.b2bAgencyCreditPolicy.findUniqueOrThrow({
          where: { id: before.id },
        });
      }
      await transaction.b2bAuditEvent.create({
        data: {
          actorUserId: input.actorUserId,
          branchId: input.branchId,
          action: before ? 'b2b.credit.update' : 'b2b.credit.create',
          entityType: 'B2bAgencyCreditPolicy',
          entityId: row.id,
          beforeSnapshot: before ? snapshot(before) : Prisma.JsonNull,
          afterSnapshot: snapshot(row),
        },
      });
      return row;
    });
  }

  async createRate(input: {
    profileId: string;
    branchId: string;
    code: string;
    serviceReference: string;
    title: string;
    kind: B2bAgreedRateKind;
    value: Prisma.Decimal;
    currencyCode: string | null;
    validFrom: Date;
    validTo: Date | null;
    actorUserId: string;
  }) {
    return this.database.client.$transaction(async (transaction) => {
      const row = await transaction.b2bAgencyAgreedRate.create({
        data: {
          profileId: input.profileId,
          code: input.code,
          serviceReference: input.serviceReference,
          title: input.title,
          kind: input.kind,
          value: input.value,
          currencyCode: input.currencyCode,
          validFrom: input.validFrom,
          validTo: input.validTo,
          createdByUserId: input.actorUserId,
          updatedByUserId: input.actorUserId,
        },
      });
      await transaction.b2bAuditEvent.create({
        data: {
          actorUserId: input.actorUserId,
          branchId: input.branchId,
          action: 'b2b.rate.create',
          entityType: 'B2bAgencyAgreedRate',
          entityId: row.id,
          afterSnapshot: snapshot(row),
        },
      });
      return row;
    });
  }
}
