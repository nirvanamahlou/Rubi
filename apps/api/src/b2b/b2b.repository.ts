import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AgencyOperationalStatus,
  B2bAgreementStatus,
  B2bAgreedRateKind,
} from '@rubi/contracts';
import { Prisma } from '@rubi/database';

import { DatabaseService } from '../database/database.service';

type RateWrite = {
  profileId: string;
  branchId: string;
  serviceReference: string;
  title: string;
  kind: B2bAgreedRateKind;
  value: Prisma.Decimal;
  currencyCode: string | null;
  validFrom: Date;
  validTo: Date | null;
  isActive?: boolean;
  actorUserId: string;
};

const profileInclude = {
  agreements: { orderBy: { startsAt: 'desc' } },
  creditPolicies: {
    where: {
      OR: [
        { revisionId: null },
        { revision: { status: 'APPROVED', activeFor: { isNot: null } } },
      ],
    },
    orderBy: { currencyCode: 'asc' },
  },
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
      where: {
        organizationId_branchId_role: {
          organizationId,
          branchId,
          role: 'AGENCY',
        },
      },
      include: profileInclude,
    });
  }

  listRates(organizationId: string, branchId: string) {
    return this.database.client.b2bAgencyAgreedRate.findMany({
      where: { profile: { organizationId, branchId, role: 'AGENCY' } },
      orderBy: [{ validFrom: 'desc' }, { title: 'asc' }],
    });
  }

  async upsertProfile(input: {
    organizationId: string;
    branchId: string;
    accountManagerUserId?: string | null;
    status: AgencyOperationalStatus;
    displayOrder: number;
    expectedVersion?: number;
    actorUserId: string;
  }) {
    return this.database.client.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`b2b-profile:${input.organizationId}:${input.branchId}`}, 0))::text`;
      const before = await transaction.agencyOperationalProfile.findUnique({
        where: {
          organizationId_branchId_role: {
            organizationId: input.organizationId,
            branchId: input.branchId,
            role: 'AGENCY',
          },
        },
      });
      let row;
      if (
        (!before && input.status !== 'UNDER_REVIEW') ||
        (before && before.status !== input.status)
      )
        throw new ConflictException({
          code: 'B2B_PROFILE_APPROVAL_REQUIRED',
          message:
            'ثبت پروفایل فقط در وضعیت در حال بررسی مجاز است؛ تغییر وضعیت نیازمند گردش تأیید و ثبت دلیل است.',
        });
      if (!before) {
        if (input.expectedVersion)
          throw new ConflictException({
            code: 'B2B_PROFILE_VERSION_CONFLICT',
            message: 'پروفایل مورد انتظار یافت نشد؛ دوباره بارگذاری کنید.',
          });
        row = await transaction.agencyOperationalProfile.create({
          data: {
            organizationId: input.organizationId,
            branchId: input.branchId,
            accountManagerUserId: input.accountManagerUserId ?? null,
            status: input.status,
            isActive: input.status !== 'ENDED',
            deactivatedAt: input.status === 'ENDED' ? new Date() : null,
            deactivatedByUserId:
              input.status === 'ENDED' ? input.actorUserId : null,
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
            ...(input.accountManagerUserId !== undefined
              ? { accountManagerUserId: input.accountManagerUserId }
              : {}),
            displayOrder: input.displayOrder,
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
      const before = await transaction.b2bAgencyCreditPolicy.findFirst({
        where: { profileId: input.profileId, revisionId: null },
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

  async createRate(input: RateWrite & { code: string }) {
    return this.database.client.$transaction(async (transaction) => {
      // Serialize checks and writes for this profile without touching another module.
      // Transaction-scoped PostgreSQL advisory locks are released on rollback too.
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`b2b-rate:${input.profileId}`}, 0))::text`;
      const overlapping = await transaction.b2bAgencyAgreedRate.findFirst({
        where: {
          profileId: input.profileId,
          serviceReference: {
            equals: input.serviceReference,
            mode: 'insensitive',
          },
          kind: input.kind,
          currencyCode: input.currencyCode,
          isActive: true,
          ...(input.validTo ? { validFrom: { lte: input.validTo } } : {}),
          OR: [{ validTo: null }, { validTo: { gte: input.validFrom } }],
        },
        select: { id: true },
      });
      if ((input.isActive ?? true) && overlapping)
        throw new ConflictException({
          code: 'B2B_RATE_OVERLAP',
          message:
            'نرخ فعال این خدمت و نوع محاسبه با بازه انتخاب‌شده هم‌پوشانی دارد.',
        });
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
          isActive: input.isActive ?? true,
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

  async updateRate(input: RateWrite & { id: string; expectedVersion: number }) {
    return this.database.client.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`b2b-rate:${input.profileId}`}, 0))::text`;
      const before = await transaction.b2bAgencyAgreedRate.findFirst({
        where: { id: input.id, profileId: input.profileId },
      });
      if (!before)
        throw new NotFoundException('شرایط تجاری در این پرونده یافت نشد.');
      if (before.version !== input.expectedVersion)
        throw new ConflictException('شرایط تجاری هم‌زمان تغییر کرده است.');
      if (input.isActive ?? true) {
        const overlap = await transaction.b2bAgencyAgreedRate.findFirst({
          where: {
            id: { not: input.id },
            profileId: input.profileId,
            isActive: true,
            serviceReference: {
              equals: input.serviceReference,
              mode: 'insensitive',
            },
            kind: input.kind,
            currencyCode: input.currencyCode,
            ...(input.validTo ? { validFrom: { lte: input.validTo } } : {}),
            OR: [{ validTo: null }, { validTo: { gte: input.validFrom } }],
          },
          select: { id: true },
        });
        if (overlap)
          throw new ConflictException(
            'بازه این شرایط با نرخ فعال دیگری هم‌پوشانی دارد.',
          );
      }
      const claimed = await transaction.b2bAgencyAgreedRate.updateMany({
        where: {
          id: input.id,
          profileId: input.profileId,
          version: input.expectedVersion,
        },
        data: {
          serviceReference: input.serviceReference,
          title: input.title,
          kind: input.kind,
          value: input.value,
          currencyCode: input.currencyCode,
          validFrom: input.validFrom,
          validTo: input.validTo,
          isActive: input.isActive ?? true,
          updatedByUserId: input.actorUserId,
          version: { increment: 1 },
        },
      });
      if (claimed.count !== 1)
        throw new ConflictException('شرایط تجاری هم‌زمان تغییر کرده است.');
      const row = await transaction.b2bAgencyAgreedRate.findUniqueOrThrow({
        where: { id: input.id },
      });
      await transaction.b2bAuditEvent.create({
        data: {
          actorUserId: input.actorUserId,
          branchId: input.branchId,
          action: 'b2b.rate.update',
          entityType: 'B2bAgencyAgreedRate',
          entityId: row.id,
          beforeSnapshot: snapshot(before),
          afterSnapshot: snapshot(row),
        },
      });
      return row;
    });
  }

  async deleteRate(input: {
    organizationId: string;
    branchId: string;
    id: string;
    expectedVersion: number;
    actorUserId: string;
    reason: string;
  }) {
    return this.database.client.$transaction(async (transaction) => {
      const before = await transaction.b2bAgencyAgreedRate.findFirst({
        where: {
          id: input.id,
          profile: {
            organizationId: input.organizationId,
            branchId: input.branchId,
            role: 'AGENCY',
          },
        },
      });
      if (!before)
        throw new NotFoundException('شرایط تجاری در این پرونده یافت نشد.');
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`b2b-rate:${before.profileId}`}, 0))::text`;
      if (before.version !== input.expectedVersion)
        throw new ConflictException('شرایط تجاری هم‌زمان تغییر کرده است.');
      const result = await transaction.b2bAgencyAgreedRate.deleteMany({
        where: {
          id: before.id,
          profileId: before.profileId,
          version: input.expectedVersion,
        },
      });
      if (result.count !== 1)
        throw new ConflictException('شرایط تجاری هم‌زمان تغییر کرده است.');
      await transaction.b2bAuditEvent.create({
        data: {
          actorUserId: input.actorUserId,
          branchId: input.branchId,
          action: 'b2b.rate.delete',
          entityType: 'B2bAgencyAgreedRate',
          entityId: before.id,
          beforeSnapshot: snapshot(before),
          afterSnapshot: { deleted: true, reason: input.reason },
        },
      });
    });
  }
}
