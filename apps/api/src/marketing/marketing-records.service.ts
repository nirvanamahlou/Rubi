import { createHash } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  MarketingAssetInputV1,
  MarketingAssetKind,
  MarketingAssetViewV1,
  MarketingCampaignInputV1,
  MarketingCampaignViewV1,
} from '@nora/contracts';
import { MARKETING_RECORDS_CONTRACT_VERSION } from '@nora/contracts';
import { Prisma } from '@nora/database';

import { DatabaseService } from '../database/database.service';
import { CustomerService } from '../customers/customer.service';
import { MasterOrganizationDirectory } from '../master-data/master-organization-directory';

const ASSET_KINDS = new Set<MarketingAssetKind>([
  'SEGMENT',
  'MESSAGE',
  'SCHEDULE',
  'FORM',
  'LANDING_PAGE',
  'SHORT_LINK',
  'AUTOMATION',
  'COUPON',
  'OFFER',
]);
const PORTS = new Set(['top', 'right', 'bottom', 'left']);
const CHANNELS = new Set(['SMS', 'EMAIL', 'WHATSAPP', 'PUSH_NOTIFICATION']);
const ASSET_STATUSES: Record<MarketingAssetKind, ReadonlySet<string>> = {
  SEGMENT: new Set(['DRAFT', 'ACTIVE', 'PAUSED']),
  MESSAGE: new Set(['DRAFT', 'READY', 'ARCHIVED']),
  SCHEDULE: new Set(['DRAFT', 'SCHEDULED', 'PAUSED', 'CANCELLED']),
  FORM: new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']),
  LANDING_PAGE: new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']),
  SHORT_LINK: new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']),
  AUTOMATION: new Set(['DRAFT', 'ACTIVE', 'PAUSED']),
  COUPON: new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']),
  OFFER: new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']),
};

type CampaignRow = Prisma.MarketingCampaignGetPayload<{
  include: { spendLines: true };
}>;
type AssetRow = Prisma.MarketingAssetGetPayload<Record<string, never>>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function branchScope(actor: AuthenticatedActor, requested?: string): string {
  const branchId = requested ?? actor.branchIds[0];
  if (!branchId || !actor.branchIds.includes(branchId))
    throw new ForbiddenException({
      code: 'MARKETING_BRANCH_FORBIDDEN',
      message: 'شعبه خارج از دامنه دسترسی است.',
    });
  return branchId;
}

function requiredKey(value?: string): string {
  const key = value?.trim();
  if (!key || key.length > 160)
    throw new BadRequestException({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'Idempotency-Key معتبر الزامی است.',
    });
  return key;
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: 'MARKETING_RECORD_NOT_FOUND',
    message: 'رکورد پیدا نشد.',
  });
}

function conflict(code = 'CONCURRENT_MODIFICATION'): ConflictException {
  return new ConflictException({
    code,
    message: 'رکورد هم‌زمان تغییر کرده یا کلید تکرار برای درخواست دیگری است.',
  });
}

function decimal(value: string, label: string): Prisma.Decimal {
  if (!/^\d{1,20}(?:\.\d{1,4})?$/.test(value))
    throw new BadRequestException(`${label} معتبر نیست.`);
  return new Prisma.Decimal(value);
}

function optionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function assertUtcDate(
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

function assertHttpUrl(value: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new BadRequestException(`${label} باید نشانی کامل HTTP(S) باشد.`);
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    throw new BadRequestException(`${label} ناامن است.`);
  return parsed.toString();
}

function validatePayloadUrls(value: unknown, path = 'payload'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      validatePayloadUrls(item, `${path}[${index}]`),
    );
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'string' && /(url|link)$/i.test(key))
      assertHttpUrl(item, `${path}.${key}`);
    else validatePayloadUrls(item, `${path}.${key}`);
  }
}

function payloadObject(
  value: unknown,
  label = 'payload',
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException(`${label} باید شیء باشد.`);
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length)
    throw new BadRequestException(`${label} شامل فیلد ناشناخته است.`);
}

function requiredString(value: unknown, label: string, max = 2_000): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new BadRequestException(`${label} معتبر نیست.`);
  return value.trim();
}

function numericString(
  value: unknown,
  label: string,
  options: { integer?: boolean; maximum?: number } = {},
): string {
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new BadRequestException(`${label} باید عدد باشد.`);
  const text = String(value).trim();
  if (!/^\d+(?:\.\d+)?$/.test(text))
    throw new BadRequestException(`${label} معتبر نیست.`);
  const number = Number(text);
  if (
    !Number.isFinite(number) ||
    number < 0 ||
    (options.integer && !Number.isInteger(number))
  )
    throw new BadRequestException(`${label} معتبر نیست.`);
  if (options.maximum !== undefined && number > options.maximum)
    throw new BadRequestException(`${label} بیشتر از حد مجاز است.`);
  return text;
}

function rejectRawPii(value: unknown, path = 'payload'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectRawPii(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (/(?:phone|mobile|email|contact|customer.?name|full.?name)/i.test(key))
        throw new BadRequestException(
          `${path}.${key} شامل داده هویتی ممنوع است.`,
        );
      rejectRawPii(item, `${path}.${key}`);
    }
    return;
  }
  if (
    typeof value === 'string' &&
    (/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(value) ||
      /(?:\+98|0098|0)?9\d{9}/.test(value))
  )
    throw new BadRequestException(`${path} شامل اطلاعات تماس خام است.`);
}

function presentCampaign(row: CampaignRow): MarketingCampaignViewV1 {
  return {
    contractVersion: MARKETING_RECORDS_CONTRACT_VERSION,
    id: row.id,
    branchId: row.branchId,
    internalCode: row.internalCode,
    name: row.name,
    campaignType: row.campaignType,
    objective: row.objective,
    executionCompany: row.executionCompany,
    channels: row.channels,
    ownerUserId: row.ownerUserId,
    segmentId: row.segmentId,
    salesTarget: row.salesTarget.toFixed(),
    targetCurrencyCode: row.targetCurrencyCode,
    budgetAmount: row.budgetAmount.toFixed(),
    budgetCurrencyCode: row.budgetCurrencyCode,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign,
    utmTerm: row.utmTerm,
    utmContent: row.utmContent,
    frequencyCap: row.frequencyCap,
    progressPercent: row.progressPercent.toFixed(),
    spendLines: row.spendLines.map((line) => ({
      id: line.id,
      label: line.label,
      amount: line.amount.toFixed(),
      currencyCode: line.currencyCode,
    })),
    links: Array.isArray(row.links) ? (row.links as string[]) : [],
    status: row.status as MarketingCampaignViewV1['status'],
    publicationRequestedAt: row.publicationRequestedAt?.toISOString() ?? null,
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    declaredByUserId: row.declaredByUserId,
    declaredAt: row.declaredAt.toISOString(),
    externalPublicationStatus: 'UNAVAILABLE',
  };
}

function presentAsset(row: AssetRow): MarketingAssetViewV1 {
  return {
    contractVersion: MARKETING_RECORDS_CONTRACT_VERSION,
    id: row.id,
    branchId: row.branchId,
    kind: row.kind as MarketingAssetKind,
    name: row.name,
    status: row.status,
    campaignId: row.campaignId,
    relatedAssetId: row.relatedAssetId,
    targetCustomerId: row.targetCustomerId ?? null,
    targetAgencyId: row.targetAgencyId ?? null,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    payload:
      row.kind === 'COUPON' || row.kind === 'OFFER'
        ? {
            ...(row.payload as Record<string, unknown>),
            value: row.promotionValue?.toFixed(),
            minimumPurchase: row.minimumPurchase?.toFixed(),
            currencyCode: row.promotionCurrencyCode,
          }
        : (row.payload as Record<string, unknown>),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    externalExecutionStatus: 'UNAVAILABLE',
  };
}

@Injectable()
export class MarketingRecordsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Optional()
    @Inject(CustomerService)
    private readonly customers?: CustomerService,
    @Optional()
    @Inject(MasterOrganizationDirectory)
    private readonly directory?: MasterOrganizationDirectory,
  ) {}

  async listCampaigns(actor: AuthenticatedActor) {
    this.assertPermissions(actor, 'marketing.read');
    const rows = await this.database.client.marketingCampaign.findMany({
      where: { branchId: { in: actor.branchIds } },
      include: { spendLines: true },
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
    });
    return { data: rows.map(presentCampaign) };
  }

  async campaign(id: string, actor: AuthenticatedActor) {
    this.assertPermissions(actor, 'marketing.read');
    const row = await this.database.client.marketingCampaign.findFirst({
      where: { id, branchId: { in: actor.branchIds } },
      include: { spendLines: true },
    });
    if (!row) throw notFound();
    return { data: presentCampaign(row) };
  }

  async validateCampaignReference(
    id: string,
    branchId: string,
    actor: AuthenticatedActor,
  ): Promise<void> {
    this.assertPermissions(
      actor,
      'marketing.read',
      'marketing.attribution.read',
    );
    if (!actor.branchIds.includes(branchId))
      throw new ForbiddenException('شعبه خارج از دامنه دسترسی است.');
    const row = await this.database.client.marketingCampaign.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!row) throw notFound();
  }

  async createCampaign(
    input: MarketingCampaignInputV1,
    actor: AuthenticatedActor,
    requestedBranch: string | undefined,
    keyValue: string | undefined,
    traceId?: string,
  ) {
    this.assertPermissions(actor, 'marketing.campaign.create');
    const branchId = branchScope(actor, requestedBranch);
    const key = requiredKey(keyValue);
    const normalized = this.normalizeCampaign(input);
    this.assertSelfOwner(normalized.ownerUserId, actor);
    const hash = fingerprint(normalized);
    const row = await this.database.client.$transaction(async (tx) => {
      const replay = await tx.marketingCommand.findUnique({
        where: {
          actorUserId_branchId_operation_idempotencyKey: {
            actorUserId: actor.userId,
            branchId,
            operation: 'CAMPAIGN_CREATE',
            idempotencyKey: key,
          },
        },
      });
      if (replay) {
        if (replay.requestFingerprint !== hash)
          throw conflict('IDEMPOTENCY_CONFLICT');
        const prior = await tx.marketingCampaign.findFirst({
          where: { id: replay.resultEntityId, branchId },
          include: { spendLines: true },
        });
        if (!prior) throw conflict('IDEMPOTENCY_RESULT_MISSING');
        return prior;
      }
      await this.validateCampaignReferences(tx, branchId, normalized.segmentId);
      const created = await tx.marketingCampaign.create({
        data: {
          ...this.campaignData(normalized),
          branchId,
          status: 'DRAFT',
          declaredByUserId: actor.userId,
          createdByUserId: actor.userId,
          updatedByUserId: actor.userId,
          spendLines: { create: this.spendData(normalized) },
        },
        include: { spendLines: true },
      });
      await tx.marketingCommand.create({
        data: {
          actorUserId: actor.userId,
          branchId,
          operation: 'CAMPAIGN_CREATE',
          idempotencyKey: key,
          requestFingerprint: hash,
          entityType: 'CAMPAIGN',
          resultEntityId: created.id,
          resultVersion: created.version,
          payloadSnapshot: json(normalized),
        },
      });
      await tx.marketingAuditEvent.create({
        data: {
          branchId,
          actorUserId: actor.userId,
          entityType: 'CAMPAIGN',
          entityId: created.id,
          action: 'CREATE_DRAFT',
          traceId: traceId ?? null,
          version: created.version,
          afterSnapshot: json(presentCampaign(created)),
        },
      });
      return created;
    });
    return { data: presentCampaign(row) };
  }

  async updateCampaign(
    id: string,
    input: MarketingCampaignInputV1,
    actor: AuthenticatedActor,
    keyValue: string | undefined,
    traceId?: string,
  ) {
    this.assertPermissions(actor, 'marketing.campaign.update');
    const key = requiredKey(keyValue);
    const expectedVersion = input.expectedVersion;
    if (!expectedVersion)
      throw new BadRequestException('expectedVersion الزامی است.');
    const normalized = this.normalizeCampaign(input);
    this.assertSelfOwner(normalized.ownerUserId, actor);
    const hash = fingerprint({ id, expectedVersion, ...normalized });
    const row = await this.database.client.$transaction(async (tx) => {
      const current = await tx.marketingCampaign.findFirst({
        where: { id, branchId: { in: actor.branchIds } },
        include: { spendLines: true },
      });
      if (!current) throw notFound();
      const replay = await tx.marketingCommand.findUnique({
        where: {
          actorUserId_branchId_operation_idempotencyKey: {
            actorUserId: actor.userId,
            branchId: current.branchId,
            operation: 'CAMPAIGN_UPDATE',
            idempotencyKey: key,
          },
        },
      });
      if (replay) {
        if (replay.requestFingerprint !== hash)
          throw conflict('IDEMPOTENCY_CONFLICT');
        const prior = await tx.marketingCampaign.findFirst({
          where: { id: replay.resultEntityId, branchId: current.branchId },
          include: { spendLines: true },
        });
        if (!prior) throw conflict('IDEMPOTENCY_RESULT_MISSING');
        return prior;
      }
      await this.validateCampaignReferences(
        tx,
        current.branchId,
        normalized.segmentId,
      );
      const changed = await tx.marketingCampaign.updateMany({
        where: { id, branchId: current.branchId, version: expectedVersion },
        data: {
          ...this.campaignData(normalized),
          declaredByUserId: actor.userId,
          declaredAt: new Date(),
          updatedByUserId: actor.userId,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw conflict();
      await tx.marketingCampaignSpendLine.deleteMany({
        where: { campaignId: id },
      });
      if (normalized.spendLines?.length)
        await tx.marketingCampaignSpendLine.createMany({
          data: this.spendData(normalized).map((line) => ({
            ...line,
            campaignId: id,
          })),
        });
      const updated = await tx.marketingCampaign.findUniqueOrThrow({
        where: { id },
        include: { spendLines: true },
      });
      await tx.marketingCommand.create({
        data: {
          actorUserId: actor.userId,
          branchId: current.branchId,
          operation: 'CAMPAIGN_UPDATE',
          idempotencyKey: key,
          requestFingerprint: hash,
          entityType: 'CAMPAIGN',
          resultEntityId: id,
          resultVersion: updated.version,
          payloadSnapshot: json(normalized),
        },
      });
      await tx.marketingAuditEvent.create({
        data: {
          branchId: current.branchId,
          actorUserId: actor.userId,
          entityType: 'CAMPAIGN',
          entityId: id,
          action: 'UPDATE_DECLARATIONS',
          traceId: traceId ?? null,
          version: updated.version,
          beforeSnapshot: json(presentCampaign(current)),
          afterSnapshot: json(presentCampaign(updated)),
        },
      });
      return updated;
    });
    return { data: presentCampaign(row) };
  }

  async publishCampaign(
    id: string,
    expectedVersion: number,
    scheduledForValue: string | null | undefined,
    actor: AuthenticatedActor,
    keyValue: string | undefined,
    traceId?: string,
  ) {
    this.assertPermissions(actor, 'marketing.read');
    const key = requiredKey(keyValue);
    const scheduledFor = assertUtcDate(scheduledForValue, 'زمان انتشار');
    const operation = scheduledFor ? 'CAMPAIGN_SCHEDULE' : 'CAMPAIGN_PUBLISH';
    const hash = fingerprint({
      id,
      expectedVersion,
      scheduledFor: scheduledFor?.toISOString() ?? null,
    });
    const row = await this.database.client.$transaction(async (tx) => {
      const current = await tx.marketingCampaign.findFirst({
        where: { id, branchId: { in: actor.branchIds } },
        include: { spendLines: true },
      });
      if (!current) throw notFound();
      const requiredPermission = scheduledFor
        ? 'marketing.campaign.schedule'
        : 'marketing.campaign.execute';
      if (!actor.permissions.includes(requiredPermission))
        throw new ForbiddenException('مجوز انتشار کمپین وجود ندارد.');
      if (
        scheduledFor &&
        (scheduledFor < current.startsAt || scheduledFor > current.endsAt)
      )
        throw new BadRequestException('زمان‌بندی باید داخل بازه کمپین باشد.');
      const replay = await tx.marketingCommand.findUnique({
        where: {
          actorUserId_branchId_operation_idempotencyKey: {
            actorUserId: actor.userId,
            branchId: current.branchId,
            operation,
            idempotencyKey: key,
          },
        },
      });
      if (replay) {
        if (replay.requestFingerprint !== hash)
          throw conflict('IDEMPOTENCY_CONFLICT');
        return tx.marketingCampaign.findUniqueOrThrow({
          where: { id },
          include: { spendLines: true },
        });
      }
      const changed = await tx.marketingCampaign.updateMany({
        where: { id, branchId: current.branchId, version: expectedVersion },
        data: {
          status: scheduledFor ? 'SCHEDULED' : 'ACTIVE',
          publicationRequestedAt: new Date(),
          scheduledFor,
          updatedByUserId: actor.userId,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw conflict();
      const updated = await tx.marketingCampaign.findUniqueOrThrow({
        where: { id },
        include: { spendLines: true },
      });
      await tx.marketingCommand.create({
        data: {
          actorUserId: actor.userId,
          branchId: current.branchId,
          operation,
          idempotencyKey: key,
          requestFingerprint: hash,
          entityType: 'CAMPAIGN',
          resultEntityId: id,
          resultVersion: updated.version,
          payloadSnapshot: json({
            id,
            expectedVersion,
            scheduledFor: scheduledFor?.toISOString() ?? null,
          }),
        },
      });
      await tx.marketingAuditEvent.create({
        data: {
          branchId: current.branchId,
          actorUserId: actor.userId,
          entityType: 'CAMPAIGN',
          entityId: id,
          action: operation,
          traceId: traceId ?? null,
          version: updated.version,
          beforeSnapshot: json(presentCampaign(current)),
          afterSnapshot: json(presentCampaign(updated)),
        },
      });
      return updated;
    });
    return { data: presentCampaign(row) };
  }

  async listAssets(
    kind: MarketingAssetKind | undefined,
    actor: AuthenticatedActor,
  ) {
    this.assertPermissions(actor, 'marketing.read');
    const rows = await this.database.client.marketingAsset.findMany({
      where: {
        branchId: { in: actor.branchIds },
        ...(kind ? { kind } : {}),
        status: { not: 'DELETED' },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    return { data: rows.map(presentAsset) };
  }

  async saveAsset(
    id: string | null,
    input: MarketingAssetInputV1,
    actor: AuthenticatedActor,
    requestedBranch: string | undefined,
    keyValue: string | undefined,
    traceId?: string,
  ) {
    this.assertPermissions(actor, 'marketing.read');
    const branchId = id ? undefined : branchScope(actor, requestedBranch);
    const key = requiredKey(keyValue);
    const normalized = await this.normalizeAsset(input);
    if (!id) this.assertAssetPermission(normalized.kind, actor);
    const expectedVersion = input.expectedVersion;
    if (id && !expectedVersion)
      throw new BadRequestException('expectedVersion الزامی است.');
    const row = await this.database.client
      .$transaction(async (tx) => {
        const current = id
          ? await tx.marketingAsset.findFirst({
              where: { id, branchId: { in: actor.branchIds } },
            })
          : null;
        if (id && !current) throw notFound();
        if (current) {
          this.assertAssetPermission(current.kind as MarketingAssetKind, actor);
          if (current.kind !== normalized.kind)
            throw new BadRequestException(
              'نوع رکورد پس از ایجاد قابل تغییر نیست.',
            );
        }
        const selectedBranch = current?.branchId ?? branchId!;
        const persistedKind = (current?.kind ??
          normalized.kind) as MarketingAssetKind;
        const operation = id
          ? `ASSET_${persistedKind}_UPDATE`
          : `ASSET_${persistedKind}_CREATE`;
        const hash = fingerprint({ id, expectedVersion, ...normalized });
        const replay = await tx.marketingCommand.findUnique({
          where: {
            actorUserId_branchId_operation_idempotencyKey: {
              actorUserId: actor.userId,
              branchId: selectedBranch,
              operation,
              idempotencyKey: key,
            },
          },
        });
        if (replay) {
          if (replay.requestFingerprint !== hash)
            throw conflict('IDEMPOTENCY_CONFLICT');
          return tx.marketingAsset.findUniqueOrThrow({
            where: { id: replay.resultEntityId },
          });
        }
        await this.validateAssetReferences(tx, selectedBranch, normalized);
        if (normalized.kind === 'COUPON' || normalized.kind === 'OFFER') {
          if (
            !this.directory ||
            !(
              await this.directory.activeCurrencyCodes([
                String(normalized.payload.currencyCode),
              ])
            ).length
          )
            throw new BadRequestException('ارز فعال معتبر نیست.');
          if (normalized.targetCustomerId) {
            if (!this.customers)
              throw new BadRequestException('مرجع مشتری در دسترس نیست.');
            await this.customers.marketingTargetReference(
              normalized.targetCustomerId,
              selectedBranch,
              actor,
            );
          }
          if (normalized.targetAgencyId) {
            this.assertPermissions(actor, 'master_data.read');
            const agency = await this.directory.agencyReference(
              normalized.targetAgencyId,
            );
            if (!agency?.isActive)
              throw new BadRequestException('آژانس فعال معتبر نیست.');
          }
        }
        const saved = current
          ? await (async () => {
              const changed = await tx.marketingAsset.updateMany({
                where: {
                  id: current.id,
                  branchId: selectedBranch,
                  version: expectedVersion!,
                },
                data: {
                  ...this.assetData(normalized),
                  updatedByUserId: actor.userId,
                  version: { increment: 1 },
                },
              });
              if (changed.count !== 1) throw conflict();
              return tx.marketingAsset.findUniqueOrThrow({
                where: { id: current.id },
              });
            })()
          : await tx.marketingAsset.create({
              data: {
                ...this.assetData(normalized),
                branchId: selectedBranch,
                createdByUserId: actor.userId,
                updatedByUserId: actor.userId,
              },
            });
        await tx.marketingCommand.create({
          data: {
            actorUserId: actor.userId,
            branchId: selectedBranch,
            operation,
            idempotencyKey: key,
            requestFingerprint: hash,
            entityType: persistedKind,
            resultEntityId: saved.id,
            resultVersion: saved.version,
            payloadSnapshot: json(normalized),
          },
        });
        await tx.marketingAuditEvent.create({
          data: {
            branchId: selectedBranch,
            actorUserId: actor.userId,
            entityType: persistedKind,
            entityId: saved.id,
            action: current ? 'UPDATE' : 'CREATE',
            traceId: traceId ?? null,
            version: saved.version,
            ...(current ? { beforeSnapshot: json(presentAsset(current)) } : {}),
            afterSnapshot: json(presentAsset(saved)),
          },
        });
        return saved;
      })
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
          throw new ConflictException('نام یا کد تخفیف تکراری است.');
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2003'
        )
          throw new BadRequestException('مرجع پیشنهاد معتبر نیست.');
        throw error;
      });
    return { data: presentAsset(row) };
  }

  async deleteAsset(
    id: string,
    expectedVersion: number,
    actor: AuthenticatedActor,
    keyValue: string | undefined,
    traceId?: string,
  ) {
    this.assertPermissions(actor, 'marketing.read');
    const key = requiredKey(keyValue);
    const row = await this.database.client.$transaction(async (tx) => {
      const current = await tx.marketingAsset.findFirst({
        where: { id, branchId: { in: actor.branchIds } },
      });
      if (!current) throw notFound();
      this.assertAssetPermission(current.kind as MarketingAssetKind, actor);
      const operation = `ASSET_${current.kind}_DELETE`;
      const hash = fingerprint({ id, expectedVersion });
      const replay = await tx.marketingCommand.findUnique({
        where: {
          actorUserId_branchId_operation_idempotencyKey: {
            actorUserId: actor.userId,
            branchId: current.branchId,
            operation,
            idempotencyKey: key,
          },
        },
      });
      if (replay) {
        if (replay.requestFingerprint !== hash)
          throw conflict('IDEMPOTENCY_CONFLICT');
        return tx.marketingAsset.findUniqueOrThrow({ where: { id } });
      }
      const changed = await tx.marketingAsset.updateMany({
        where: { id, branchId: current.branchId, version: expectedVersion },
        data: {
          status: 'DELETED',
          updatedByUserId: actor.userId,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw conflict();
      const deleted = await tx.marketingAsset.findUniqueOrThrow({
        where: { id },
      });
      await tx.marketingCommand.create({
        data: {
          actorUserId: actor.userId,
          branchId: current.branchId,
          operation,
          idempotencyKey: key,
          requestFingerprint: hash,
          entityType: current.kind,
          resultEntityId: id,
          resultVersion: deleted.version,
          payloadSnapshot: json({ id, expectedVersion }),
        },
      });
      await tx.marketingAuditEvent.create({
        data: {
          branchId: current.branchId,
          actorUserId: actor.userId,
          entityType: current.kind,
          entityId: id,
          action: 'DELETE',
          traceId: traceId ?? null,
          version: deleted.version,
          beforeSnapshot: json(presentAsset(current)),
          afterSnapshot: json(presentAsset(deleted)),
        },
      });
      return deleted;
    });
    return { data: presentAsset(row) };
  }

  private normalizeCampaign(
    input: MarketingCampaignInputV1,
  ): MarketingCampaignInputV1 {
    const startsAt = assertUtcDate(input.startsAt, 'زمان شروع')!;
    const endsAt = assertUtcDate(input.endsAt, 'زمان پایان')!;
    if (endsAt <= startsAt)
      throw new BadRequestException('پایان کمپین باید بعد از شروع باشد.');
    const progress = decimal(input.progressPercent ?? '0', 'درصد پیشرفت');
    if (progress.greaterThan(100))
      throw new BadRequestException('درصد پیشرفت نمی‌تواند بیشتر از ۱۰۰ باشد.');
    const links = (input.links ?? []).map((link, index) =>
      assertHttpUrl(link, `لینک ${index + 1}`),
    );
    return {
      ...input,
      internalCode: input.internalCode.trim().toUpperCase(),
      name: input.name.trim(),
      campaignType: input.campaignType.trim(),
      objective: input.objective.trim(),
      executionCompany: input.executionCompany.trim(),
      channels: [
        ...new Set(input.channels.map((item) => item.trim()).filter(Boolean)),
      ],
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      utmSource: optionalText(input.utmSource),
      utmMedium: optionalText(input.utmMedium),
      utmCampaign: optionalText(input.utmCampaign),
      utmTerm: optionalText(input.utmTerm),
      utmContent: optionalText(input.utmContent),
      salesTarget: decimal(input.salesTarget, 'هدف فروش').toFixed(),
      budgetAmount: decimal(input.budgetAmount, 'بودجه').toFixed(),
      progressPercent: progress.toFixed(),
      links,
      spendLines: (input.spendLines ?? []).map((line) => ({
        label: line.label.trim(),
        amount: decimal(line.amount, 'ریز هزینه').toFixed(),
        currencyCode: line.currencyCode,
      })),
    };
  }

  private campaignData(input: MarketingCampaignInputV1) {
    return {
      internalCode: input.internalCode,
      name: input.name,
      campaignType: input.campaignType,
      objective: input.objective,
      executionCompany: input.executionCompany,
      channels: input.channels,
      ownerUserId: input.ownerUserId,
      segmentId: input.segmentId ?? null,
      salesTarget: new Prisma.Decimal(input.salesTarget),
      targetCurrencyCode: input.targetCurrencyCode,
      budgetAmount: new Prisma.Decimal(input.budgetAmount),
      budgetCurrencyCode: input.budgetCurrencyCode,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      utmTerm: input.utmTerm ?? null,
      utmContent: input.utmContent ?? null,
      frequencyCap: input.frequencyCap,
      progressPercent: new Prisma.Decimal(input.progressPercent ?? '0'),
      links: json(input.links ?? []),
    };
  }

  private spendData(input: MarketingCampaignInputV1) {
    return (input.spendLines ?? []).map((line) => ({
      label: line.label,
      amount: new Prisma.Decimal(line.amount),
      currencyCode: line.currencyCode,
    }));
  }

  private async validateCampaignReferences(
    tx: Prisma.TransactionClient,
    branchId: string,
    segmentId: string | null | undefined,
  ) {
    if (segmentId) {
      const segment = await tx.marketingAsset.findFirst({
        where: {
          id: segmentId,
          branchId,
          kind: 'SEGMENT',
          status: { not: 'DELETED' },
        },
      });
      if (!segment)
        throw new BadRequestException('سگمنت معتبر و هم‌شعبه پیدا نشد.');
    }
  }

  private assertSelfOwner(ownerUserId: string, actor: AuthenticatedActor) {
    if (ownerUserId !== actor.userId)
      throw new ForbiddenException(
        'مالک کمپین باید کاربر جاری باشد؛ تخصیص به کاربر دیگر به قرارداد عمومی IAM نیاز دارد.',
      );
  }

  private async normalizeAsset(
    input: MarketingAssetInputV1,
  ): Promise<MarketingAssetInputV1> {
    if (!ASSET_KINDS.has(input.kind))
      throw new BadRequestException('نوع رکورد مارکتینگ معتبر نیست.');
    const status = input.status.trim().toUpperCase();
    if (!ASSET_STATUSES[input.kind].has(status))
      throw new BadRequestException('وضعیت برای این نوع رکورد معتبر نیست.');
    const payload = this.normalizeAssetPayload(input.kind, input.payload);
    if (input.kind === 'SCHEDULE' && payload.status !== status)
      throw new BadRequestException(
        'وضعیت رکورد و محتوای زمان‌بندی باید یکسان باشد.',
      );
    rejectRawPii(payload);
    validatePayloadUrls(payload);
    const scheduledAt = assertUtcDate(input.scheduledAt, 'زمان ارسال');
    const expiresAt = assertUtcDate(input.expiresAt, 'تاریخ انقضا');
    const promotion = input.kind === 'COUPON' || input.kind === 'OFFER';
    if (input.targetCustomerId && input.targetAgencyId)
      throw new BadRequestException('فقط یک نوع مخاطب هدف مجاز است.');
    if (!promotion && (input.targetCustomerId || input.targetAgencyId))
      throw new BadRequestException('مخاطب هدف فقط برای پیشنهاد مجاز است.');
    if (promotion && (!scheduledAt || !expiresAt || scheduledAt >= expiresAt))
      throw new BadRequestException('بازه اعتبار پیشنهاد معتبر نیست.');
    if (
      input.kind === 'SCHEDULE' &&
      (!input.campaignId || !input.relatedAssetId || !scheduledAt)
    )
      throw new BadRequestException(
        'ارسال زمان‌بندی‌شده به پیام، کمپین و زمان نیاز دارد.',
      );
    if (input.kind === 'AUTOMATION') this.validateGraph(input.payload);
    return {
      ...input,
      name: requiredString(input.name, 'نام رکورد', 200),
      status,
      campaignId: input.campaignId ?? null,
      relatedAssetId: input.relatedAssetId ?? null,
      scheduledAt: scheduledAt?.toISOString() ?? null,
      expiresAt: expiresAt?.toISOString() ?? null,
      payload,
    };
  }

  private normalizeAssetPayload(
    kind: MarketingAssetKind,
    raw: Record<string, unknown>,
  ): Record<string, unknown> {
    const payload = payloadObject(raw);
    if (kind === 'COUPON' || kind === 'OFFER') {
      exactKeys(
        payload,
        [
          'code',
          'discountType',
          'value',
          'currencyCode',
          'minimumPurchase',
          'usageLimit',
          'perCustomerLimit',
          'service',
          'combinability',
          'description',
        ],
        'پیشنهاد',
      );
      const value = decimal(String(payload.value), 'مقدار تخفیف');
      const minimum = decimal(String(payload.minimumPurchase), 'حداقل خرید');
      const discountType = requiredString(
        payload.discountType,
        'نوع تخفیف',
        20,
      );
      if (
        !['PERCENT', 'AMOUNT'].includes(discountType) ||
        value.lte(0) ||
        (discountType === 'PERCENT' && value.gt(100))
      )
        throw new BadRequestException('مقدار تخفیف معتبر نیست.');
      const currencyCode = requiredString(payload.currencyCode, 'ارز', 3);
      if (!/^[A-Z]{3}$/.test(currencyCode))
        throw new BadRequestException('ارز معتبر نیست.');
      const code =
        kind === 'COUPON'
          ? requiredString(payload.code, 'کد تخفیف', 64).toUpperCase()
          : '';
      if (kind === 'COUPON' && !/^[A-Z0-9_-]{3,64}$/.test(code))
        throw new BadRequestException('کد تخفیف معتبر نیست.');
      const usageLimit = Number(payload.usageLimit);
      const perCustomerLimit = Number(payload.perCustomerLimit);
      if (
        ![usageLimit, perCustomerLimit].every(
          (limit) =>
            Number.isSafeInteger(limit) && limit > 0 && limit <= 1000000,
        ) ||
        perCustomerLimit > usageLimit
      )
        throw new BadRequestException('سقف استفاده معتبر نیست.');
      const service = requiredString(payload.service, 'خدمت', 32);
      const combinability = requiredString(
        payload.combinability,
        'ترکیب‌پذیری',
        32,
      );
      if (
        !['ALL', 'TOUR', 'FLIGHT', 'HOTEL'].includes(service) ||
        !['EXCLUSIVE', 'COMBINABLE'].includes(combinability)
      )
        throw new BadRequestException('قانون استفاده معتبر نیست.');
      if (
        payload.description !== undefined &&
        (typeof payload.description !== 'string' ||
          payload.description.length > 2000)
      )
        throw new BadRequestException('توضیحات معتبر نیست.');
      return {
        code,
        discountType,
        value: value.toFixed(),
        currencyCode,
        minimumPurchase: minimum.toFixed(),
        usageLimit,
        perCustomerLimit,
        service,
        combinability,
        description: String(payload.description ?? '').trim(),
      };
    }
    if (kind === 'SEGMENT') {
      exactKeys(payload, ['rules'], 'قاعده سگمنت');
      if (
        !Array.isArray(payload.rules) ||
        payload.rules.length === 0 ||
        payload.rules.length > 50
      )
        throw new BadRequestException(
          'سگمنت باید بین ۱ تا ۵۰ قاعده داشته باشد.',
        );
      return {
        rules: payload.rules.map((rawRule) => {
          const rule = payloadObject(rawRule, 'قاعده سگمنت');
          exactKeys(rule, ['expression'], 'قاعده سگمنت');
          return {
            expression: requiredString(rule.expression, 'عبارت قاعده', 500),
          };
        }),
      };
    }
    if (kind === 'MESSAGE') {
      exactKeys(
        payload,
        ['channels', 'audience', 'body', 'sendMode', 'sendAt'],
        'پیام',
      );
      if (
        !Array.isArray(payload.channels) ||
        payload.channels.length === 0 ||
        payload.channels.length > CHANNELS.size
      )
        throw new BadRequestException('حداقل یک کانال معتبر لازم است.');
      const channels = [
        ...new Set(
          payload.channels.map((value) =>
            requiredString(value, 'کانال', 40).toUpperCase(),
          ),
        ),
      ];
      if (channels.some((channel) => !CHANNELS.has(channel)))
        throw new BadRequestException('کانال پیام معتبر نیست.');
      const sendMode = requiredString(
        payload.sendMode,
        'روش ارسال',
        20,
      ).toUpperCase();
      if (!['NOW', 'SCHEDULED'].includes(sendMode))
        throw new BadRequestException('روش ارسال معتبر نیست.');
      const sendAt = payload.sendAt
        ? assertUtcDate(
            requiredString(payload.sendAt, 'زمان ارسال'),
            'زمان ارسال',
          )?.toISOString()
        : null;
      if (sendMode === 'SCHEDULED' && !sendAt)
        throw new BadRequestException(
          'زمان ارسال برای روش زمان‌بندی الزامی است.',
        );
      return {
        channels,
        audience: requiredString(payload.audience, 'مخاطبان', 300),
        body: requiredString(payload.body, 'متن پیام', 5_000),
        sendMode,
        sendAt,
      };
    }
    if (kind === 'SCHEDULE') {
      exactKeys(payload, ['channel', 'status'], 'ارسال زمان‌بندی‌شده');
      const channel = requiredString(
        payload.channel,
        'کانال',
        40,
      ).toUpperCase();
      if (!CHANNELS.has(channel))
        throw new BadRequestException('کانال ارسال معتبر نیست.');
      const payloadStatus = requiredString(
        payload.status,
        'وضعیت',
        40,
      ).toUpperCase();
      if (!ASSET_STATUSES.SCHEDULE.has(payloadStatus))
        throw new BadRequestException('وضعیت ارسال معتبر نیست.');
      return { channel, status: payloadStatus };
    }
    if (kind === 'FORM') {
      exactKeys(
        payload,
        ['type', 'landingPage', 'completionRate', 'responseCount'],
        'فرم',
      );
      return {
        type: requiredString(payload.type, 'نوع فرم', 80),
        landingPage: assertHttpUrl(
          requiredString(payload.landingPage, 'صفحه فرود', 2_000),
          'صفحه فرود',
        ),
        completionRate: numericString(payload.completionRate, 'نرخ تکمیل', {
          maximum: 100,
        }),
        responseCount: numericString(payload.responseCount, 'تعداد پاسخ', {
          integer: true,
        }),
      };
    }
    if (kind === 'LANDING_PAGE') {
      exactKeys(
        payload,
        ['domainUrl', 'visits', 'conversions', 'lastPublishedAt'],
        'صفحه فرود',
      );
      const lastPublishedAt = payload.lastPublishedAt
        ? assertUtcDate(
            requiredString(payload.lastPublishedAt, 'آخرین انتشار'),
            'آخرین انتشار',
          )?.toISOString()
        : '';
      return {
        domainUrl: assertHttpUrl(
          requiredString(payload.domainUrl, 'دامنه یا سایت', 2_000),
          'دامنه یا سایت',
        ),
        visits: numericString(payload.visits, 'بازدید', { integer: true }),
        conversions: numericString(payload.conversions, 'تبدیل', {
          integer: true,
        }),
        lastPublishedAt,
      };
    }
    if (kind === 'SHORT_LINK') {
      exactKeys(
        payload,
        ['targetUrl', 'shortUrl', 'clicks', 'conversions'],
        'لینک کوتاه',
      );
      return {
        targetUrl: assertHttpUrl(
          requiredString(payload.targetUrl, 'نشانی مقصد', 2_000),
          'نشانی مقصد',
        ),
        shortUrl: assertHttpUrl(
          requiredString(payload.shortUrl, 'لینک کوتاه', 2_000),
          'لینک کوتاه',
        ),
        clicks: numericString(payload.clicks, 'کلیک', { integer: true }),
        conversions: numericString(payload.conversions, 'تبدیل', {
          integer: true,
        }),
      };
    }
    exactKeys(payload, ['nodes', 'edges'], 'اتوماسیون');
    if (!Array.isArray(payload.nodes) || !Array.isArray(payload.edges))
      throw new BadRequestException(
        'گره‌ها و اتصال‌های اتوماسیون باید آرایه باشند.',
      );
    this.validateGraph(payload);
    return {
      nodes: (payload.nodes as unknown[]).map((rawNode) => {
        const node = payloadObject(rawNode, 'گره اتوماسیون');
        exactKeys(node, ['id', 'title'], 'گره اتوماسیون');
        return {
          id: requiredString(node.id, 'شناسه گره', 100),
          title: requiredString(node.title, 'عنوان گره', 200),
        };
      }),
      edges: (payload.edges as unknown[]).map((rawEdge) => {
        const edge = payloadObject(rawEdge, 'اتصال اتوماسیون');
        exactKeys(
          edge,
          ['source', 'target', 'sourcePort', 'targetPort'],
          'اتصال اتوماسیون',
        );
        return Object.fromEntries(
          ['source', 'target', 'sourcePort', 'targetPort'].map((key) => [
            key,
            requiredString(edge[key], `فیلد ${key}`, 100),
          ]),
        );
      }),
    };
  }

  private assetData(input: MarketingAssetInputV1) {
    return {
      kind: input.kind,
      name: input.name,
      status: input.status,
      campaignId: input.campaignId ?? null,
      relatedAssetId: input.relatedAssetId ?? null,
      targetCustomerId: input.targetCustomerId ?? null,
      targetAgencyId: input.targetAgencyId ?? null,
      promotionValue: ['COUPON', 'OFFER'].includes(input.kind)
        ? new Prisma.Decimal(String(input.payload.value))
        : null,
      minimumPurchase: ['COUPON', 'OFFER'].includes(input.kind)
        ? new Prisma.Decimal(String(input.payload.minimumPurchase))
        : null,
      promotionCurrencyCode: ['COUPON', 'OFFER'].includes(input.kind)
        ? String(input.payload.currencyCode)
        : null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      payload: json(input.payload),
    };
  }

  private assertAssetPermission(
    kind: MarketingAssetKind,
    actor: AuthenticatedActor,
  ) {
    const required =
      kind === 'COUPON' || kind === 'OFFER'
        ? 'marketing.offer.manage'
        : kind === 'SEGMENT'
          ? 'marketing.audience.manage'
          : kind === 'SCHEDULE'
            ? 'marketing.campaign.schedule'
            : 'marketing.campaign.update';
    if (!actor.permissions.includes(required))
      throw new ForbiddenException('مجوز عملیات این رکورد وجود ندارد.');
  }

  private async validateAssetReferences(
    tx: Prisma.TransactionClient,
    branchId: string,
    input: MarketingAssetInputV1,
  ) {
    if (input.campaignId) {
      const campaign = await tx.marketingCampaign.findFirst({
        where: { id: input.campaignId, branchId },
      });
      if (!campaign)
        throw new BadRequestException('کمپین معتبر و هم‌شعبه پیدا نشد.');
    }
    if (input.relatedAssetId) {
      const expectedKind =
        input.kind === 'SCHEDULE'
          ? 'MESSAGE'
          : input.kind === 'MESSAGE'
            ? 'SEGMENT'
            : input.kind === 'FORM'
              ? 'LANDING_PAGE'
              : input.kind === 'LANDING_PAGE'
                ? 'FORM'
                : undefined;
      const related = await tx.marketingAsset.findFirst({
        where: {
          id: input.relatedAssetId,
          branchId,
          status: { not: 'DELETED' },
          ...(expectedKind ? { kind: expectedKind } : {}),
        },
      });
      if (!related)
        throw new BadRequestException('رکورد مرتبط معتبر و هم‌شعبه پیدا نشد.');
    }
  }

  private validateGraph(payload: Record<string, unknown>) {
    const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
    const edges = Array.isArray(payload.edges) ? payload.edges : [];
    if (!nodes.length)
      throw new BadRequestException('اتوماسیون حداقل یک مرحله لازم دارد.');
    const nodeIds = new Set<string>();
    for (const raw of nodes) {
      if (!raw || typeof raw !== 'object')
        throw new BadRequestException('گره اتوماسیون معتبر نیست.');
      const id = (raw as { id?: unknown }).id;
      if (typeof id !== 'string' || !id || nodeIds.has(id))
        throw new BadRequestException(
          'شناسه گره اتوماسیون تکراری یا خالی است.',
        );
      nodeIds.add(id);
    }
    for (const raw of edges) {
      if (!raw || typeof raw !== 'object')
        throw new BadRequestException('اتصال اتوماسیون معتبر نیست.');
      const edge = raw as Record<string, unknown>;
      if (
        !nodeIds.has(String(edge.source)) ||
        !nodeIds.has(String(edge.target))
      )
        throw new BadRequestException('اتصال به گره ناشناخته اشاره می‌کند.');
      if (
        !PORTS.has(String(edge.sourcePort)) ||
        !PORTS.has(String(edge.targetPort))
      )
        throw new BadRequestException(
          'اتصال باید یکی از چهار سمت گره را مشخص کند.',
        );
    }
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
      throw new ForbiddenException('مجوز مارکتینگ برای این عملیات وجود ندارد.');
  }
}
