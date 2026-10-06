import { createHash } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  CustomerAffairsMarketingIntakeInputV1,
  CustomerAffairsMarketingIntakeViewV1,
  MarketingSourceCountsResponseV1,
} from '@nora/contracts';
import {
  CUSTOMER_AFFAIRS_MARKETING_INTAKE_CONTRACT_VERSION,
  MARKETING_RECORDS_CONTRACT_VERSION,
} from '@nora/contracts';
import type { Prisma } from '@nora/database';

import { CustomerContactCrypto } from '../customers/customer-contact.crypto';
import { DatabaseService } from '../database/database.service';
import { MarketingRecordsService } from '../marketing/marketing-records.service';

const SCORE_RULES = {
  PHONE_VALID: 10,
  CAMPAIGN_ATTRIBUTED: 25,
  ASSIGNED: 20,
  FOLLOWED_UP: 25,
  STATUS_QUALIFIED: 40,
} as const;

type IntakeRow = Prisma.CustomerAffairsMarketingIntakeGetPayload<
  Record<string, never>
>;

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function requiredKey(value?: string): string {
  const key = value?.trim();
  if (!key || key.length > 160)
    throw new BadRequestException('Idempotency-Key معتبر الزامی است.');
  return key;
}

function branchScope(actor: AuthenticatedActor, requested?: string): string {
  const branchId = requested ?? actor.branchIds[0];
  if (!branchId || !actor.branchIds.includes(branchId))
    throw new ForbiddenException('شعبه خارج از دامنه دسترسی است.');
  return branchId;
}

function strictDate(
  value: string | null | undefined,
  label: string,
): Date | null {
  if (!value) return null;
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new BadRequestException(
      `${label} باید زمان ISO دارای منطقه زمانی باشد.`,
    );
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new BadRequestException(`${label} معتبر نیست.`);
  return date;
}

function normalizePhone(value: string): string {
  const compact = value.replace(/[\s-]/g, '');
  if (!/^\+?\d{10,15}$/.test(compact))
    throw new BadRequestException('شماره تلفن معتبر نیست.');
  return compact;
}

function maskPhone(value: string): string {
  const visible = value.slice(-4);
  return `${value.startsWith('+') ? '+' : ''}${'*'.repeat(Math.max(6, value.replace('+', '').length - 4))}${visible}`;
}

function present(row: IntakeRow): CustomerAffairsMarketingIntakeViewV1 {
  return {
    contractVersion: CUSTOMER_AFFAIRS_MARKETING_INTAKE_CONTRACT_VERSION,
    id: row.id,
    branchId: row.branchId,
    maskedPhone: row.phoneMasked,
    sourceCategory: row.sourceCategory,
    campaignId: row.campaignId,
    status: row.status as CustomerAffairsMarketingIntakeViewV1['status'],
    assigneeUserId: row.assigneeUserId,
    lastFollowUpAt: row.lastFollowUpAt?.toISOString() ?? null,
    score: row.score,
    scoreRuleIds: row.scoreRuleIds,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class CustomerAffairsMarketingIntakeService {
  constructor(
    @Inject(DatabaseService)
    private readonly database: DatabaseService,
    @Inject(CustomerContactCrypto)
    private readonly contactCrypto: CustomerContactCrypto,
    @Inject(MarketingRecordsService)
    private readonly marketing: MarketingRecordsService,
  ) {}

  async list(actor: AuthenticatedActor) {
    this.assertPermissions(
      actor,
      'customer_affairs.lead.read',
      'marketing.audience.read',
    );
    const rows =
      await this.database.client.customerAffairsMarketingIntake.findMany({
        where: { branchId: { in: actor.branchIds } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
    return { data: rows.map(present) };
  }

  async create(
    input: CustomerAffairsMarketingIntakeInputV1,
    actor: AuthenticatedActor,
    requestedBranch: string | undefined,
    keyValue: string | undefined,
    traceId?: string,
  ) {
    this.assertPermissions(
      actor,
      'customer_affairs.lead.create',
      'marketing.audience.manage',
    );
    const branchId = branchScope(actor, requestedBranch);
    const key = requiredKey(keyValue);
    const phone = normalizePhone(input.phone);
    const protectedPhone = this.contactCrypto.protect(
      'phone',
      phone,
      maskPhone(phone),
    );
    const lastFollowUpAt = strictDate(input.lastFollowUpAt, 'آخرین پیگیری');
    if (lastFollowUpAt && lastFollowUpAt > new Date())
      throw new BadRequestException('آخرین پیگیری نمی‌تواند در آینده باشد.');
    if (input.campaignId)
      await this.marketing.validateCampaignReference(
        input.campaignId,
        branchId,
        actor,
      );
    if (input.assigneeUserId && input.assigneeUserId !== actor.userId)
      throw new ForbiddenException(
        'کارشناس فروش باید کاربر جاری باشد؛ تخصیص به کاربر دیگر به قرارداد عمومی IAM نیاز دارد.',
      );
    const safePayload = {
      phoneFingerprint: protectedPhone.valueFingerprint,
      sourceCategory: input.sourceCategory.trim(),
      campaignId: input.campaignId ?? null,
      status: input.status,
      assigneeUserId: input.assigneeUserId ?? null,
      lastFollowUpAt: lastFollowUpAt?.toISOString() ?? null,
    };
    const hash = fingerprint(safePayload);
    const row = await this.database.client.$transaction(async (tx) => {
      const scope = `MARKETING_INTAKE_CREATE:${branchId}`;
      const replay = await tx.customerAffairsCommand.findUnique({
        where: {
          actorUserId_scope_idempotencyKey: {
            actorUserId: actor.userId,
            scope,
            idempotencyKey: key,
          },
        },
      });
      if (replay) {
        if (replay.requestFingerprint !== hash)
          throw new ConflictException({
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'کلید تکرار برای درخواست دیگری استفاده شده است.',
          });
        const prior = await tx.customerAffairsMarketingIntake.findFirst({
          where: { id: replay.resultEntityId, branchId },
        });
        if (!prior)
          throw new ConflictException('نتیجه درخواست تکراری دیگر موجود نیست.');
        return prior;
      }
      const duplicate = await tx.customerAffairsMarketingIntake.findUnique({
        where: {
          branchId_phoneFingerprint: {
            branchId,
            phoneFingerprint: protectedPhone.valueFingerprint,
          },
        },
      });
      if (duplicate)
        throw new ConflictException({
          code: 'INTAKE_IDENTITY_EXISTS',
          message: 'برای این شماره در شعبه یک ورودی اولیه وجود دارد.',
        });
      const created = await tx.customerAffairsMarketingIntake.create({
        data: {
          branchId,
          phoneEncrypted: protectedPhone.encryptedValue,
          phoneIv: protectedPhone.encryptionIv,
          phoneAuthTag: protectedPhone.encryptionAuthTag,
          phoneKeyVersion: protectedPhone.encryptionKeyVersion,
          phoneFingerprint: protectedPhone.valueFingerprint,
          phoneMasked: protectedPhone.maskedValue,
          sourceCategory: safePayload.sourceCategory,
          campaignId: safePayload.campaignId,
          status: safePayload.status,
          assigneeUserId: safePayload.assigneeUserId,
          lastFollowUpAt,
          createdByUserId: actor.userId,
          updatedByUserId: actor.userId,
        },
      });
      await tx.customerAffairsCommand.create({
        data: {
          actorUserId: actor.userId,
          scope,
          idempotencyKey: key,
          requestFingerprint: hash,
          resultEntityId: created.id,
        },
      });
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId,
          actorUserId: actor.userId,
          entityType: 'MARKETING_INTAKE',
          entityId: created.id,
          action: 'CREATE_FIRST_CONTACT',
          traceId: traceId ?? null,
          version: created.version,
          afterSnapshot: json(present(created)),
        },
      });
      return created;
    });
    return { data: present(row) };
  }

  async score(
    id: string,
    ruleIdsInput: string[],
    expectedVersion: number,
    actor: AuthenticatedActor,
    keyValue: string | undefined,
    traceId?: string,
  ) {
    this.assertPermissions(
      actor,
      'customer_affairs.lead.update',
      'marketing.audience.manage',
    );
    const key = requiredKey(keyValue);
    const ruleIds = [...new Set(ruleIdsInput)].sort();
    const row = await this.database.client.$transaction(async (tx) => {
      const current = await tx.customerAffairsMarketingIntake.findFirst({
        where: { id, branchId: { in: actor.branchIds } },
      });
      if (!current) throw new NotFoundException('ورودی اولیه پیدا نشد.');
      const satisfied = this.satisfiedRules(current);
      if (
        ruleIds.some((rule) => !(rule in SCORE_RULES) || !satisfied.has(rule))
      )
        throw new BadRequestException(
          'یک یا چند قاعده انتخاب‌شده برای این سرنخ برقرار نیست.',
        );
      const score = Math.min(
        100,
        ruleIds.reduce(
          (total, rule) =>
            total + SCORE_RULES[rule as keyof typeof SCORE_RULES],
          0,
        ),
      );
      const safePayload = { id, ruleIds, expectedVersion, score };
      const hash = fingerprint(safePayload);
      const scope = `MARKETING_INTAKE_SCORE:${current.branchId}:${id}`;
      const replay = await tx.customerAffairsCommand.findUnique({
        where: {
          actorUserId_scope_idempotencyKey: {
            actorUserId: actor.userId,
            scope,
            idempotencyKey: key,
          },
        },
      });
      if (replay) {
        if (replay.requestFingerprint !== hash)
          throw new ConflictException(
            'کلید تکرار با درخواست قبلی هم‌خوان نیست.',
          );
        return tx.customerAffairsMarketingIntake.findUniqueOrThrow({
          where: { id },
        });
      }
      const changed = await tx.customerAffairsMarketingIntake.updateMany({
        where: { id, branchId: current.branchId, version: expectedVersion },
        data: {
          score,
          scoreRuleIds: ruleIds,
          updatedByUserId: actor.userId,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException('رکورد هم‌زمان تغییر کرده است.');
      const updated = await tx.customerAffairsMarketingIntake.findUniqueOrThrow(
        { where: { id } },
      );
      await tx.customerAffairsCommand.create({
        data: {
          actorUserId: actor.userId,
          scope,
          idempotencyKey: key,
          requestFingerprint: hash,
          resultEntityId: id,
        },
      });
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId: current.branchId,
          actorUserId: actor.userId,
          entityType: 'MARKETING_INTAKE',
          entityId: id,
          action: 'CALCULATE_SCORE',
          traceId: traceId ?? null,
          version: updated.version,
          beforeSnapshot: json(present(current)),
          afterSnapshot: json(present(updated)),
        },
      });
      return updated;
    });
    return { data: present(row) };
  }

  async sourceCounts(
    startsAtValue: string,
    endsAtValue: string,
    actor: AuthenticatedActor,
  ): Promise<MarketingSourceCountsResponseV1> {
    this.assertPermissions(
      actor,
      'customer_affairs.lead.read',
      'marketing.audience.read',
    );
    const startsAt = strictDate(startsAtValue, 'شروع بازه')!;
    const endsAt = strictDate(endsAtValue, 'پایان بازه')!;
    if (endsAt <= startsAt)
      throw new BadRequestException('پایان بازه باید بعد از شروع باشد.');
    if (endsAt.getTime() - startsAt.getTime() > 366 * 86_400_000)
      throw new BadRequestException(
        'بازه گزارش نمی‌تواند بیشتر از ۳۶۶ روز باشد.',
      );
    const grouped =
      await this.database.client.customerAffairsMarketingIntake.groupBy({
        by: ['sourceCategory'],
        where: {
          branchId: { in: actor.branchIds },
          createdAt: { gte: startsAt, lt: endsAt },
        },
        _count: { _all: true },
        orderBy: { sourceCategory: 'asc' },
      });
    const counts = grouped.map((item) => ({
      sourceCategory: item.sourceCategory,
      count: item._count._all,
    }));
    return {
      contractVersion: MARKETING_RECORDS_CONTRACT_VERSION,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      total: counts.reduce((sum, item) => sum + item.count, 0),
      counts,
      containsRawPii: false,
    };
  }

  private satisfiedRules(row: IntakeRow): Set<string> {
    const rules = new Set<string>(['PHONE_VALID']);
    if (row.campaignId) rules.add('CAMPAIGN_ATTRIBUTED');
    if (row.assigneeUserId) rules.add('ASSIGNED');
    if (row.lastFollowUpAt) rules.add('FOLLOWED_UP');
    if (row.status === 'QUALIFIED') rules.add('STATUS_QUALIFIED');
    return rules;
  }

  private assertPermissions(
    actor: AuthenticatedActor,
    ...permissions: string[]
  ) {
    if (
      permissions.some(
        (permission) => !actor.permissions.includes(permission as never),
      )
    )
      throw new ForbiddenException(
        'مجوز مالک و مارکتینگ برای این عملیات کامل نیست.',
      );
  }
}
