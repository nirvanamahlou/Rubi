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
  SystemBackupRequestV1,
  SystemFeatureFlagV1,
  SystemHealthComponentV1,
  SystemJobRetryInputV1,
  SystemNumberingSchemeV1,
  SystemNumberingSchemeWriteV1,
  SystemNumberIssueInputV1,
  SystemNumberIssueV1,
  SystemOverviewV1,
  SystemScope,
  SystemSessionRevokeInputV1,
  SystemSessionV1,
  SystemSettingResolveQueryV1,
  SystemSettingV1,
  SystemSettingWriteV1,
  SystemUserSessionsRevokeInputV1,
} from '@nora/contracts';
import { Prisma, SystemBackupStatus, SystemRecordStatus } from '@nora/database';
import type {
  SystemScope as DbSystemScope,
  SystemValueType as DbSystemValueType,
} from '@nora/database';

import { DatabaseService } from '../database/database.service';
import {
  DOCUMENTS_STORAGE_HEALTH_PORT,
  type DocumentsStorageHealthPort,
} from '../documents/documents-storage-health.port';
import { IamService } from '../iam/iam.service';
import { ReportingService } from '../reporting/reporting.service';
import {
  assertSafeJson,
  maskIp,
  sanitizeText,
  scopeKey,
  validIdentifier,
  validReason,
  validUuid,
  validateSetting,
} from './system-management.validation';

interface AuditMetadata {
  requestId?: string;
  ipAddress?: string;
}

interface NotificationChannelWrite {
  channel: string;
  enabled: boolean;
  templateRef?: string | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  retryPolicy?: unknown;
  providerStatus?: string;
  expectedVersion?: number;
  reason: string;
}

interface MessageTemplateWrite {
  key: string;
  kind: 'MESSAGE' | 'EMAIL' | 'SMS' | 'NOTIFICATION';
  language: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  subject?: string | null;
  body: string;
  allowedVariables?: string[];
  reason: string;
}

interface FeatureFlagWrite {
  key: string;
  title: string;
  description?: string | null;
  scope: SystemScope;
  scopeId?: string | null;
  enabled: boolean;
  rolloutPercent?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  expectedVersion?: number;
  reason: string;
}

interface BackupRequestWrite {
  type: 'FULL' | 'DATABASE' | 'FILES';
  reason: string;
  retentionUntil?: string | null;
}

@Injectable()
export class SystemManagementService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(IamService) private readonly iam: IamService,
    @Inject(ReportingService) private readonly reporting: ReportingService,
    @Inject(DOCUMENTS_STORAGE_HEALTH_PORT)
    private readonly documentsStorage: DocumentsStorageHealthPort,
  ) {}

  listSessions(
    actor: AuthenticatedActor,
    userId?: string,
  ): Promise<SystemSessionV1[]> {
    return this.iam.listAdministrativeSessions(
      actor,
      userId ? validUuid(userId, 'شناسه کاربر') : undefined,
    );
  }

  revokeSession(
    sessionId: string,
    input: SystemSessionRevokeInputV1,
    actor: AuthenticatedActor,
    metadata: AuditMetadata,
  ) {
    return this.iam.revokeAdministrativeSession(
      validUuid(sessionId, 'شناسه نشست'),
      actor,
      input?.reason,
      input?.confirmCurrentSession === true,
      metadata,
    );
  }

  revokeUserSessions(
    userId: string,
    input: SystemUserSessionsRevokeInputV1,
    actor: AuthenticatedActor,
    metadata: AuditMetadata,
  ) {
    return this.iam.revokeAdministrativeUserSessions(
      validUuid(userId, 'شناسه کاربر'),
      actor,
      input?.reason,
      input?.includeCurrentSession === true,
      input?.confirmCurrentSession === true,
      metadata,
    );
  }

  async retryReportingExport(
    exportId: string,
    input: SystemJobRetryInputV1,
    actor: AuthenticatedActor,
    metadata: AuditMetadata,
  ) {
    const id = validUuid(exportId, 'شناسه خروجی گزارش');
    const reason = validReason(input?.reason);
    const result = await this.reporting.retryExport(id, actor);
    await this.audit(
      actor,
      metadata,
      'system.job.retry.reporting_export',
      'ReportingExportArtifact',
      id,
      reason,
      null,
      { retried: true },
    );
    return result;
  }

  async listSettings(): Promise<SystemSettingV1[]> {
    const rows = await this.database.client.systemSetting.findMany({
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      orderBy: [{ namespace: 'asc' }, { key: 'asc' }, { scopeKey: 'asc' }],
      take: 500,
    });
    return rows.map((row) => this.presentSetting(row, row.versions[0]));
  }

  async writeSetting(
    input: SystemSettingWriteV1,
    actor: AuthenticatedActor,
    metadata: AuditMetadata,
  ): Promise<SystemSettingV1> {
    const value = validateSetting(input);
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`system-setting:${value.namespace}:${value.key}:${value.scopeKey}`}, 0))`,
      );
      const current = await tx.systemSetting.findUnique({
        where: {
          namespace_key_scopeKey: {
            namespace: value.namespace,
            key: value.key,
            scopeKey: value.scopeKey,
          },
        },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      });
      if (
        current &&
        value.expectedVersion !== undefined &&
        current.activeVersion !== value.expectedVersion
      )
        throw new ConflictException('تنظیم توسط کاربر دیگری تغییر کرده است.');
      if (current && value.expectedVersion === undefined)
        throw new ConflictException('نسخه مورد انتظار برای ویرایش الزامی است.');
      const nextVersion = (current?.activeVersion ?? 0) + 1;
      const setting = current
        ? await tx.systemSetting.update({
            where: { id: current.id },
            data: {
              valueType: value.valueType as DbSystemValueType,
              status: value.status as SystemRecordStatus,
              activeVersion: nextVersion,
            },
          })
        : await tx.systemSetting.create({
            data: {
              namespace: value.namespace,
              key: value.key,
              valueType: value.valueType as DbSystemValueType,
              scope: value.scope as DbSystemScope,
              scopeId: value.scopeId,
              scopeKey: value.scopeKey,
              status: value.status as SystemRecordStatus,
              activeVersion: nextVersion,
            },
          });
      const version = await tx.systemSettingVersion.create({
        data: {
          settingId: setting.id,
          version: nextVersion,
          value: value.value as Prisma.InputJsonValue,
          reason: value.reason,
          createdByUserId: actor.userId,
        },
      });
      await this.auditTx(tx, actor, metadata, {
        action: 'system.setting.write',
        entityType: 'SystemSetting',
        entityId: setting.id,
        reason: value.reason,
        before: current?.versions[0]
          ? { version: current.activeVersion, value: current.versions[0].value }
          : null,
        after: { version: nextVersion, value: version.value },
      });
      return this.presentSetting(setting, version);
    });
  }

  async resolveSetting(
    query: SystemSettingResolveQueryV1,
  ): Promise<SystemSettingV1 | null> {
    const namespace = validIdentifier(query.namespace, 'Namespace');
    const key = validIdentifier(query.key, 'Key');
    const orderedKeys = [
      query.userId ? scopeKey('USER', query.userId) : null,
      query.branchId ? scopeKey('BRANCH', query.branchId) : null,
      query.legalEntityId
        ? scopeKey('LEGAL_ENTITY', query.legalEntityId)
        : null,
      'GLOBAL',
    ].filter((value): value is string => Boolean(value));
    const rows = await this.database.client.systemSetting.findMany({
      where: {
        namespace,
        key,
        scopeKey: { in: orderedKeys },
        status: SystemRecordStatus.ACTIVE,
      },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    const selected = [...rows].sort(
      (left, right) =>
        orderedKeys.indexOf(left.scopeKey) -
        orderedKeys.indexOf(right.scopeKey),
    )[0];
    return selected
      ? this.presentSetting(selected, selected.versions[0])
      : null;
  }

  async listNumberingSchemes(): Promise<SystemNumberingSchemeV1[]> {
    const rows = await this.database.client.systemNumberingScheme.findMany({
      orderBy: [{ code: 'asc' }, { scopeKey: 'asc' }],
      take: 300,
    });
    return rows.map((row) => this.presentScheme(row));
  }

  async writeNumberingScheme(
    input: SystemNumberingSchemeWriteV1,
    actor: AuthenticatedActor,
    metadata: AuditMetadata,
  ): Promise<SystemNumberingSchemeV1> {
    const code = validIdentifier(input?.code, 'کد طرح').toUpperCase();
    const reason = validReason(input?.reason);
    const key = scopeKey(input.scope, input.scopeId);
    const prefix = input.prefix?.trim().toUpperCase();
    if (!prefix || !/^[A-Z0-9-]{1,40}$/.test(prefix))
      throw new BadRequestException('پیشوند شماره‌گذاری معتبر نیست.');
    if (!['JALALI', 'GREGORIAN'].includes(input.calendar))
      throw new BadRequestException('تقویم شماره‌گذاری معتبر نیست.');
    if (!['NEVER', 'YEARLY', 'MONTHLY'].includes(input.resetPolicy))
      throw new BadRequestException('سیاست بازنشانی معتبر نیست.');
    if (
      !Number.isSafeInteger(input.padding) ||
      input.padding < 1 ||
      input.padding > 16
    )
      throw new BadRequestException('Padding باید بین ۱ تا ۱۶ باشد.');
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`system-numbering:${code}:${key}`}, 0))`,
      );
      const current = await tx.systemNumberingScheme.findUnique({
        where: { code_scopeKey: { code, scopeKey: key } },
      });
      if (current && input.expectedVersion !== current.version)
        throw new ConflictException('طرح شماره‌گذاری تغییر کرده است.');
      const data = {
        scope: input.scope as DbSystemScope,
        scopeId: input.scopeId ?? null,
        prefix,
        calendar: input.calendar,
        includeFiscalYear: input.includeFiscalYear,
        includeLegalEntity: input.includeLegalEntity,
        includeBranch: input.includeBranch,
        padding: input.padding,
        resetPolicy: input.resetPolicy,
        isActive: input.isActive,
        reason,
        createdByUserId: actor.userId,
      };
      const row = current
        ? await tx.systemNumberingScheme.update({
            where: { id: current.id },
            data: { ...data, version: { increment: 1 } },
          })
        : await tx.systemNumberingScheme.create({
            data: { ...data, code, scopeKey: key },
          });
      await this.auditTx(tx, actor, metadata, {
        action: 'system.numbering.write',
        entityType: 'SystemNumberingScheme',
        entityId: row.id,
        reason,
        before: current,
        after: row,
      });
      return this.presentScheme(row);
    });
  }

  async previewNumber(
    schemeId: string,
    input: Omit<SystemNumberIssueInputV1, 'idempotencyKey'>,
  ): Promise<SystemNumberIssueV1> {
    const scheme = await this.findScheme(schemeId);
    const date = this.parseDate(input.now);
    const periodKey = this.periodKey(scheme, date);
    const sequence =
      await this.database.client.systemNumberingSequence.findUnique({
        where: { schemeId_periodKey: { schemeId, periodKey } },
      });
    const next = (sequence?.lastValue ?? 0n) + 1n;
    return this.presentIssued(
      scheme,
      next,
      periodKey,
      date,
      input.legalEntityCode,
      input.branchCode,
    );
  }

  async issueNumber(
    schemeId: string,
    input: SystemNumberIssueInputV1,
    actor: AuthenticatedActor,
    metadata: AuditMetadata,
  ): Promise<SystemNumberIssueV1> {
    validUuid(schemeId, 'شناسه طرح');
    const idempotencyKey = sanitizeText(input?.idempotencyKey, 160);
    if (!idempotencyKey || idempotencyKey.length < 8)
      throw new BadRequestException('Idempotency Key معتبر نیست.');
    const date = this.parseDate(input.now);
    try {
      return await this.database.client.$transaction(async (tx) => {
        const existing = await tx.systemIssuedNumber.findUnique({
          where: { schemeId_idempotencyKey: { schemeId, idempotencyKey } },
          include: { scheme: true },
        });
        if (existing)
          return {
            contract: 'system.number-issued.v1',
            schemeId,
            value: existing.issuedValue,
            sequence: existing.sequenceValue.toString(),
            periodKey: existing.periodKey,
          };
        const scheme = await tx.systemNumberingScheme.findUnique({
          where: { id: schemeId },
        });
        if (!scheme || !scheme.isActive)
          throw new NotFoundException('طرح شماره‌گذاری فعال یافت نشد.');
        const periodKey = this.periodKey(scheme, date);
        const sequence = await tx.systemNumberingSequence.upsert({
          where: { schemeId_periodKey: { schemeId, periodKey } },
          create: { schemeId, periodKey, lastValue: 1n },
          update: { lastValue: { increment: 1 }, version: { increment: 1 } },
        });
        const projection = this.presentIssued(
          scheme,
          sequence.lastValue,
          periodKey,
          date,
          input.legalEntityCode,
          input.branchCode,
        );
        await tx.systemIssuedNumber.create({
          data: {
            schemeId,
            idempotencyKey,
            issuedValue: projection.value,
            sequenceValue: sequence.lastValue,
            periodKey,
            actorUserId: actor.userId,
          },
        });
        await this.auditTx(tx, actor, metadata, {
          action: 'system.numbering.issue',
          entityType: 'SystemNumberingScheme',
          entityId: schemeId,
          reason: 'صدور اتمیک شماره با Idempotency Key',
          before: null,
          after: { value: projection.value, periodKey },
        });
        return projection;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing =
          await this.database.client.systemIssuedNumber.findUnique({
            where: { schemeId_idempotencyKey: { schemeId, idempotencyKey } },
          });
        if (existing)
          return {
            contract: 'system.number-issued.v1',
            schemeId,
            value: existing.issuedValue,
            sequence: existing.sequenceValue.toString(),
            periodKey: existing.periodKey,
          };
      }
      throw error;
    }
  }

  listNotificationChannels() {
    return this.database.client.systemNotificationChannel.findMany({
      orderBy: { channel: 'asc' },
    });
  }

  async writeNotificationChannel(
    input: NotificationChannelWrite,
    actor: AuthenticatedActor,
    metadata: AuditMetadata,
  ) {
    const channel = validIdentifier(input?.channel, 'کانال').toUpperCase();
    if (!['IN_APP', 'EMAIL', 'SMS'].includes(channel))
      throw new BadRequestException('کانال اعلان معتبر نیست.');
    const reason = validReason(input.reason);
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (
      (input.quietHoursStart && !timePattern.test(input.quietHoursStart)) ||
      (input.quietHoursEnd && !timePattern.test(input.quietHoursEnd))
    )
      throw new BadRequestException('Quiet Hours معتبر نیست.');
    assertSafeJson(input.retryPolicy ?? {});
    const current =
      await this.database.client.systemNotificationChannel.findUnique({
        where: { channel },
      });
    if (current && input.expectedVersion !== current.version)
      throw new ConflictException('تنظیم کانال اعلان تغییر کرده است.');
    const row = await this.database.client.systemNotificationChannel.upsert({
      where: { channel },
      create: {
        channel,
        enabled: Boolean(input.enabled),
        templateRef: sanitizeText(input.templateRef, 160),
        quietHoursStart: input.quietHoursStart ?? null,
        quietHoursEnd: input.quietHoursEnd ?? null,
        retryPolicy: (input.retryPolicy ?? {}) as Prisma.InputJsonValue,
        providerStatus:
          sanitizeText(input.providerStatus, 40) ?? 'NOT_CONFIGURED',
        reason,
        updatedByUserId: actor.userId,
      },
      update: {
        enabled: Boolean(input.enabled),
        templateRef: sanitizeText(input.templateRef, 160),
        quietHoursStart: input.quietHoursStart ?? null,
        quietHoursEnd: input.quietHoursEnd ?? null,
        retryPolicy: (input.retryPolicy ?? {}) as Prisma.InputJsonValue,
        providerStatus:
          sanitizeText(input.providerStatus, 40) ?? 'NOT_CONFIGURED',
        reason,
        updatedByUserId: actor.userId,
        version: { increment: 1 },
      },
    });
    await this.audit(
      actor,
      metadata,
      'system.notification.write',
      'SystemNotificationChannel',
      row.id,
      reason,
      current,
      row,
    );
    return row;
  }

  listTemplates() {
    return this.database.client.systemMessageTemplate.findMany({
      orderBy: [{ key: 'asc' }, { language: 'asc' }, { version: 'desc' }],
      take: 500,
    });
  }

  async createTemplate(
    input: MessageTemplateWrite,
    actor: AuthenticatedActor,
    metadata: AuditMetadata,
  ) {
    const key = validIdentifier(input?.key, 'کلید قالب');
    const reason = validReason(input.reason);
    const language = input.language?.trim().toLowerCase();
    if (!/^[a-z]{2}(?:-[a-z]{2})?$/.test(language))
      throw new BadRequestException('زبان قالب معتبر نیست.');
    if (!['MESSAGE', 'EMAIL', 'SMS', 'NOTIFICATION'].includes(input.kind))
      throw new BadRequestException('نوع قالب معتبر نیست.');
    if (!['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(input.status))
      throw new BadRequestException('وضعیت قالب معتبر نیست.');
    const body = input.body?.trim();
    if (
      !body ||
      body.length > 20_000 ||
      /<%|\$\{|__proto__|constructor/i.test(body)
    )
      throw new BadRequestException('متن قالب معتبر یا امن نیست.');
    const variables = [...new Set(input.allowedVariables ?? [])];
    if (variables.some((item) => !/^[a-z][a-z0-9_]{0,63}$/.test(item)))
      throw new BadRequestException('متغیر مجاز قالب معتبر نیست.');
    const used = [...body.matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g)].map(
      (match) => match[1]!,
    );
    if (used.some((item) => !variables.includes(item)))
      throw new BadRequestException('قالب از متغیر ثبت‌نشده استفاده می‌کند.');
    const current = await this.database.client.systemMessageTemplate.findFirst({
      where: { key, language },
      orderBy: { version: 'desc' },
    });
    const row = await this.database.client.systemMessageTemplate.create({
      data: {
        key,
        kind: input.kind,
        language,
        version: (current?.version ?? 0) + 1,
        status: input.status as SystemRecordStatus,
        subject: sanitizeText(input.subject, 300),
        body,
        allowedVariables: variables,
        reason,
        createdByUserId: actor.userId,
        publishedAt: input.status === 'ACTIVE' ? new Date() : null,
      },
    });
    await this.audit(
      actor,
      metadata,
      'system.template.create',
      'SystemMessageTemplate',
      row.id,
      reason,
      null,
      { key, language, version: row.version, status: row.status },
    );
    return row;
  }

  async listFeatureFlags(): Promise<SystemFeatureFlagV1[]> {
    const rows = await this.database.client.systemFeatureFlag.findMany({
      orderBy: [{ key: 'asc' }, { scopeKey: 'asc' }],
      take: 500,
    });
    return rows.map((row) => this.presentFlag(row));
  }

  async writeFeatureFlag(
    input: FeatureFlagWrite,
    actor: AuthenticatedActor,
    metadata: AuditMetadata,
  ): Promise<SystemFeatureFlagV1> {
    const key = validIdentifier(input?.key, 'کلید Flag');
    const title = sanitizeText(input.title, 160);
    if (!title) throw new BadRequestException('عنوان Flag الزامی است.');
    const reason = validReason(input.reason);
    const keyScope = scopeKey(input.scope, input.scopeId);
    const rollout = input.rolloutPercent ?? null;
    if (
      rollout !== null &&
      (!Number.isInteger(rollout) || rollout < 0 || rollout > 100)
    )
      throw new BadRequestException('درصد Rollout معتبر نیست.');
    const startsAt = input.startsAt ? new Date(input.startsAt) : null;
    const endsAt = input.endsAt ? new Date(input.endsAt) : null;
    if (
      (startsAt && Number.isNaN(startsAt.valueOf())) ||
      (endsAt && Number.isNaN(endsAt.valueOf())) ||
      (startsAt && endsAt && startsAt >= endsAt)
    )
      throw new BadRequestException('بازه زمانی Feature Flag معتبر نیست.');
    const current = await this.database.client.systemFeatureFlag.findUnique({
      where: { key_scopeKey: { key, scopeKey: keyScope } },
    });
    if (current && input.expectedVersion !== current.version)
      throw new ConflictException('Feature Flag تغییر کرده است.');
    const data = {
      title,
      description: sanitizeText(input.description, 500),
      scope: input.scope as DbSystemScope,
      scopeId: input.scopeId ?? null,
      enabled: Boolean(input.enabled),
      rolloutPercent: rollout,
      startsAt,
      endsAt,
      reason,
      updatedByUserId: actor.userId,
    };
    const row = current
      ? await this.database.client.systemFeatureFlag.update({
          where: { id: current.id },
          data: { ...data, version: { increment: 1 } },
        })
      : await this.database.client.systemFeatureFlag.create({
          data: { ...data, key, scopeKey: keyScope },
        });
    await this.audit(
      actor,
      metadata,
      'system.feature-flag.write',
      'SystemFeatureFlag',
      row.id,
      reason,
      current,
      row,
    );
    return this.presentFlag(row);
  }

  async listBackupRequests(): Promise<SystemBackupRequestV1[]> {
    const rows = await this.database.client.systemBackupRequest.findMany({
      orderBy: { requestedAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => this.presentBackup(row));
  }

  async requestBackup(
    input: BackupRequestWrite,
    actor: AuthenticatedActor,
    metadata: AuditMetadata,
  ): Promise<SystemBackupRequestV1> {
    if (!['FULL', 'DATABASE', 'FILES'].includes(input?.type))
      throw new BadRequestException('نوع درخواست پشتیبان معتبر نیست.');
    const reason = validReason(input.reason);
    const retentionUntil = input.retentionUntil
      ? new Date(input.retentionUntil)
      : null;
    if (
      retentionUntil &&
      (Number.isNaN(retentionUntil.valueOf()) || retentionUntil <= new Date())
    )
      throw new BadRequestException('زمان نگهداری معتبر نیست.');
    const row = await this.database.client.systemBackupRequest.create({
      data: {
        type: input.type,
        reason,
        retentionUntil,
        requestedByUserId: actor.userId,
        status: SystemBackupStatus.REQUESTED,
      },
    });
    await this.audit(
      actor,
      metadata,
      'system.backup.request',
      'SystemBackupRequest',
      row.id,
      reason,
      null,
      { type: row.type, status: row.status },
    );
    return this.presentBackup(row);
  }

  async health(): Promise<SystemHealthComponentV1[]> {
    const checkedAt = new Date().toISOString();
    const started = performance.now();
    let database: SystemHealthComponentV1;
    try {
      await this.database.client.$queryRaw(Prisma.sql`SELECT 1 AS healthy`);
      database = {
        component: 'POSTGRESQL',
        status: 'HEALTHY',
        checkedAt,
        latencyMs: Math.round(performance.now() - started),
        detail: 'اتصال پایگاه‌داده با Query فقط‌خواندنی تأیید شد.',
      };
    } catch {
      database = {
        component: 'POSTGRESQL',
        status: 'UNAVAILABLE',
        checkedAt,
        latencyMs: null,
        detail: 'پایگاه‌داده در بررسی فعلی پاسخ نداد.',
      };
    }
    let storageProbe: { healthy: boolean; latencyMs: number | null };
    try {
      storageProbe = await this.documentsStorage.probe();
    } catch {
      storageProbe = { healthy: false, latencyMs: null };
    }
    const storage: SystemHealthComponentV1 = {
      component: 'STORAGE',
      status: storageProbe.healthy ? 'HEALTHY' : 'UNAVAILABLE',
      checkedAt,
      latencyMs: storageProbe.latencyMs,
      detail: storageProbe.healthy
        ? 'Probe عمومی مالک Documents با موفقیت اجرا شد.'
        : 'Probe عمومی مالک Documents در بررسی فعلی پاسخ نداد.',
    };
    return [
      {
        component: 'API',
        status: 'HEALTHY',
        checkedAt,
        latencyMs: 0,
        detail: `API فعال است؛ uptime=${Math.floor(process.uptime())}s`,
      },
      database,
      ...(['REDIS', 'WORKER', 'QUEUE'] as const).map(
        (component): SystemHealthComponentV1 => ({
          component,
          status: 'UNKNOWN',
          checkedAt,
          latencyMs: null,
          detail: 'Probe عمومی مالک این سرویس هنوز منتشر نشده است.',
        }),
      ),
      storage,
    ];
  }

  async overview(): Promise<SystemOverviewV1> {
    const [
      settings,
      featureFlags,
      pendingBackupRequests,
      failedAdminOperations,
      health,
    ] = await Promise.all([
      this.database.client.systemSetting.count({
        where: { status: SystemRecordStatus.ACTIVE },
      }),
      this.database.client.systemFeatureFlag.count({
        where: { enabled: true },
      }),
      this.database.client.systemBackupRequest.count({
        where: {
          status: {
            in: [SystemBackupStatus.REQUESTED, SystemBackupStatus.RUNNING],
          },
        },
      }),
      this.database.client.systemAdminOperation.count({
        where: { status: 'FAILED' },
      }),
      this.health(),
    ]);
    return {
      contract: 'system.overview.v1',
      generatedAt: new Date().toISOString(),
      settings,
      featureFlags,
      pendingBackupRequests,
      failedAdminOperations,
      health,
    };
  }

  async listAudit(
    actor: AuthenticatedActor,
    includeSensitive: boolean,
    reason: string | undefined,
    metadata: AuditMetadata,
  ) {
    if (includeSensitive) {
      if (!actor.permissions.includes('system.audit.sensitive'))
        throw new ForbiddenException('مجوز مشاهده Audit حساس وجود ندارد.');
      const viewReason = validReason(reason);
      await this.audit(
        actor,
        metadata,
        'system.audit.sensitive.view',
        'SystemAuditEvent',
        'collection',
        viewReason,
        null,
        { includeSensitive: true },
      );
    }
    const rows = await this.database.client.systemAuditEvent.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });
    return rows.map((row) => ({
      id: row.id,
      actorUserId: row.actorUserId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      outcome: row.outcome,
      reason: row.reason,
      requestId: row.requestId,
      ipAddressMasked: row.ipAddressMasked,
      createdAt: row.createdAt.toISOString(),
      ...(includeSensitive ? { before: row.before, after: row.after } : {}),
    }));
  }

  private async findScheme(id: string) {
    validUuid(id, 'شناسه طرح');
    const scheme = await this.database.client.systemNumberingScheme.findUnique({
      where: { id },
    });
    if (!scheme || !scheme.isActive)
      throw new NotFoundException('طرح شماره‌گذاری فعال یافت نشد.');
    return scheme;
  }

  private parseDate(input?: string | null): Date {
    const date = input ? new Date(input) : new Date();
    if (Number.isNaN(date.valueOf()))
      throw new BadRequestException('زمان معتبر نیست.');
    return date;
  }

  private calendarParts(calendar: string, date: Date) {
    if (calendar === 'GREGORIAN')
      return {
        year: String(date.getUTCFullYear()),
        month: String(date.getUTCMonth() + 1).padStart(2, '0'),
      };
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    return {
      year: parts.find((part) => part.type === 'year')?.value ?? '',
      month: parts.find((part) => part.type === 'month')?.value ?? '',
    };
  }

  private periodKey(
    scheme: { calendar: string; resetPolicy: string },
    date: Date,
  ) {
    if (scheme.resetPolicy === 'NEVER') return 'ALL';
    const parts = this.calendarParts(scheme.calendar, date);
    return scheme.resetPolicy === 'MONTHLY'
      ? `${parts.year}-${parts.month}`
      : parts.year;
  }

  private presentIssued(
    scheme: {
      id: string;
      prefix: string;
      calendar: string;
      includeFiscalYear: boolean;
      includeLegalEntity: boolean;
      includeBranch: boolean;
      padding: number;
    },
    sequence: bigint,
    periodKey: string,
    date: Date,
    legalEntityCode?: string,
    branchCode?: string,
  ): SystemNumberIssueV1 {
    const legal = legalEntityCode?.trim().toUpperCase();
    const branch = branchCode?.trim().toUpperCase();
    if (
      scheme.includeLegalEntity &&
      (!legal || !/^[A-Z0-9-]{1,20}$/.test(legal))
    )
      throw new BadRequestException('کد شرکت برای شماره‌گذاری الزامی است.');
    if (scheme.includeBranch && (!branch || !/^[A-Z0-9-]{1,20}$/.test(branch)))
      throw new BadRequestException('کد شعبه برای شماره‌گذاری الزامی است.');
    const segments = [scheme.prefix];
    if (scheme.includeLegalEntity) segments.push(legal as string);
    if (scheme.includeBranch) segments.push(branch as string);
    if (scheme.includeFiscalYear)
      segments.push(this.calendarParts(scheme.calendar, date).year);
    segments.push(sequence.toString().padStart(scheme.padding, '0'));
    return {
      contract: 'system.number-issued.v1',
      schemeId: scheme.id,
      value: segments.join('-'),
      sequence: sequence.toString(),
      periodKey,
    };
  }

  private presentSetting(
    row: {
      id: string;
      namespace: string;
      key: string;
      valueType: string;
      scope: string;
      scopeId: string | null;
      activeVersion: number;
      status: string;
      updatedAt: Date;
    },
    version:
      | {
          value: unknown;
          reason: string;
          createdByUserId: string;
          createdAt: Date;
        }
      | undefined,
  ): SystemSettingV1 {
    if (!version) throw new ConflictException('نسخه فعال تنظیم یافت نشد.');
    return {
      contract: 'system.setting.v1',
      id: row.id,
      namespace: row.namespace,
      key: row.key,
      valueType: row.valueType as SystemSettingV1['valueType'],
      value: version.value,
      scope: row.scope as SystemScope,
      scopeId: row.scopeId,
      version: row.activeVersion,
      status: row.status as SystemSettingV1['status'],
      reason: version.reason,
      updatedByUserId: version.createdByUserId,
      updatedAt: version.createdAt.toISOString(),
    };
  }

  private presentScheme(row: {
    id: string;
    code: string;
    scope: string;
    scopeId: string | null;
    prefix: string;
    calendar: string;
    includeFiscalYear: boolean;
    includeLegalEntity: boolean;
    includeBranch: boolean;
    padding: number;
    resetPolicy: string;
    version: number;
    isActive: boolean;
  }): SystemNumberingSchemeV1 {
    return {
      contract: 'system.numbering-scheme.v1',
      ...row,
      scope: row.scope as SystemScope,
      calendar: row.calendar as 'JALALI' | 'GREGORIAN',
      resetPolicy: row.resetPolicy as 'NEVER' | 'YEARLY' | 'MONTHLY',
    };
  }

  private presentFlag(row: {
    id: string;
    key: string;
    title: string;
    description: string | null;
    scope: string;
    scopeId: string | null;
    enabled: boolean;
    rolloutPercent: number | null;
    startsAt: Date | null;
    endsAt: Date | null;
    version: number;
    reason: string;
  }): SystemFeatureFlagV1 {
    return {
      contract: 'system.feature-flag.v1',
      ...row,
      scope: row.scope as SystemScope,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null,
    };
  }

  private presentBackup(row: {
    id: string;
    type: string;
    status: string;
    requestedByUserId: string;
    requestedAt: Date;
    retentionUntil: Date | null;
    sanitizedResult: string | null;
    sanitizedError: string | null;
  }): SystemBackupRequestV1 {
    return {
      contract: 'system.backup-request.v1',
      id: row.id,
      type: row.type as SystemBackupRequestV1['type'],
      status: row.status as SystemBackupRequestV1['status'],
      requestedByUserId: row.requestedByUserId,
      requestedAt: row.requestedAt.toISOString(),
      retentionUntil: row.retentionUntil?.toISOString() ?? null,
      sanitizedResult: row.sanitizedResult,
      sanitizedError: row.sanitizedError,
    };
  }

  private audit(
    actor: AuthenticatedActor,
    metadata: AuditMetadata,
    action: string,
    entityType: string,
    entityId: string,
    reason: string,
    before: unknown,
    after: unknown,
  ) {
    assertSafeJson(before ?? {});
    assertSafeJson(after ?? {});
    return this.database.client.systemAuditEvent.create({
      data: {
        actorUserId: actor.userId,
        action,
        entityType,
        entityId,
        outcome: 'SUCCESS',
        reason,
        before:
          before === null ? Prisma.JsonNull : (before as Prisma.InputJsonValue),
        after:
          after === null ? Prisma.JsonNull : (after as Prisma.InputJsonValue),
        requestId: metadata.requestId ?? null,
        ipAddressMasked: maskIp(metadata.ipAddress),
      },
    });
  }

  private auditTx(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    metadata: AuditMetadata,
    input: {
      action: string;
      entityType: string;
      entityId: string;
      reason: string;
      before: unknown;
      after: unknown;
    },
  ) {
    assertSafeJson(input.before ?? {});
    assertSafeJson(input.after ?? {});
    return tx.systemAuditEvent.create({
      data: {
        actorUserId: actor.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        outcome: 'SUCCESS',
        reason: input.reason,
        before:
          input.before === null
            ? Prisma.JsonNull
            : (input.before as Prisma.InputJsonValue),
        after:
          input.after === null
            ? Prisma.JsonNull
            : (input.after as Prisma.InputJsonValue),
        requestId: metadata.requestId ?? null,
        ipAddressMasked: maskIp(metadata.ipAddress),
      },
    });
  }
}
