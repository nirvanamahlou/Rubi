import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  LEGAL_ENTITY_CODES,
  LEGAL_ENTITY_CONTEXT_ALL,
  type AuthenticatedActor,
  type LegalEntityBrandingSnapshot,
  type LegalEntityCode,
  type LegalEntityDetail,
  type LegalEntitySelection,
  type LegalEntitySummary,
  type LegalEntityUpdateRequest,
} from '@rubi/contracts';
import {
  AuditOutcome,
  LegalEntityContextMode,
  LegalEntityDocumentIssueStatus,
} from '@rubi/database';
import type { Prisma } from '@rubi/database';

import { DatabaseService } from '../database/database.service';
import {
  DOCUMENT_TEMPLATE_POLICY_PORT,
  type DocumentTemplatePolicyPort,
  type ResolvedDocumentTemplatePolicy,
} from './document-template-policy.port';
import type {
  CreateDocumentIssueDto,
  ReissueDocumentDto,
} from './legal-entities.dto';
import {
  assertLegalEntitySelection,
  assertRequiredLetterhead,
  isSensitiveBrandingAllowed,
  resolveIssueTargetIds,
  type IssueTargetStrategy,
} from './legal-entities.policy';

type EntityRow = {
  id: string;
  code: string;
  persianName: string;
  latinName: string | null;
  tradeName: string | null;
  logoFileId: string | null;
  letterheadFileId: string | null;
  footerFileId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  nationalId: string | null;
  registrationNumber: string | null;
  economicCode: string | null;
  paymentText: string | null;
  sealFileId: string | null;
  authorizedSignatureId: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  legalFooterText: string | null;
  isActive: boolean;
  version: number;
  brandingSnapshotVersion: number;
  updatedAt: Date;
};

const brandingFields = new Set([
  'logoFileId',
  'letterheadFileId',
  'footerFileId',
  'sealFileId',
  'authorizedSignatureId',
  'primaryColor',
  'secondaryColor',
  'legalFooterText',
]);

const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const entityCode = (code: string): LegalEntityCode => {
  if (!(LEGAL_ENTITY_CODES as readonly string[]).includes(code))
    throw new BadRequestException('کد شرکت صادرکننده معتبر نیست.');
  return code as LegalEntityCode;
};

function summary(row: EntityRow): LegalEntitySummary {
  return {
    id: row.id,
    code: entityCode(row.code),
    persianName: row.persianName,
    latinName: row.latinName,
    logoFileId: row.logoFileId,
    isActive: row.isActive,
    version: row.version,
    brandingSnapshotVersion: row.brandingSnapshotVersion,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function snapshot(
  row: EntityRow,
  includeSensitive = true,
): LegalEntityBrandingSnapshot {
  return {
    legalEntityId: row.id,
    code: entityCode(row.code),
    persianName: row.persianName,
    latinName: row.latinName,
    tradeName: row.tradeName,
    logoFileId: row.logoFileId,
    letterheadFileId: row.letterheadFileId,
    footerFileId: row.footerFileId,
    address: row.address,
    phone: row.phone,
    email: row.email,
    website: row.website,
    nationalId: row.nationalId,
    registrationNumber: row.registrationNumber,
    economicCode: row.economicCode,
    paymentText: row.paymentText,
    sealFileId: includeSensitive ? row.sealFileId : null,
    authorizedSignatureId: includeSensitive ? row.authorizedSignatureId : null,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    legalFooterText: row.legalFooterText,
    version: row.brandingSnapshotVersion,
  };
}

function detail(row: EntityRow, includeSensitive: boolean): LegalEntityDetail {
  return { ...summary(row), ...snapshot(row, includeSensitive) };
}

const concurrentModification = () =>
  new ConflictException({
    code: 'CONCURRENT_MODIFICATION',
    message: 'Context هم‌زمان تغییر کرده است.',
  });

const hasPrismaCode = (error: unknown, code: string): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === code;

const normalizeReissueReason = (reason: unknown): string => {
  const normalized = typeof reason === 'string' ? reason.trim() : '';
  if (normalized.length < 3 || normalized.length > 500)
    throw new BadRequestException({
      code: 'REISSUE_REASON_REQUIRED',
      message: 'دلیل صدور مجدد باید بین ۳ تا ۵۰۰ نویسه معنادار باشد.',
    });
  return normalized;
};

function safeAudit(row: EntityRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    persianName: row.persianName,
    isActive: row.isActive,
    version: row.version,
    brandingSnapshotVersion: row.brandingSnapshotVersion,
    hasSeal: Boolean(row.sealFileId),
    hasAuthorizedSignature: Boolean(row.authorizedSignatureId),
  };
}

@Injectable()
export class LegalEntitiesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(DOCUMENT_TEMPLATE_POLICY_PORT)
    private readonly templatePolicies: DocumentTemplatePolicyPort,
  ) {}

  async list(actor: AuthenticatedActor) {
    const mayManage = actor.permissions.includes('legal-entity.manage');
    const rows = await this.database.client.legalEntity.findMany({
      where: mayManage ? {} : { isActive: true },
      orderBy: { persianName: 'asc' },
    });
    return {
      data: rows.map((row) =>
        detail(row, isSensitiveBrandingAllowed(actor.permissions)),
      ),
      meta: {
        canAggregate: actor.permissions.includes('legal-entity.aggregate.read'),
        canManage: mayManage,
        canManageBranding: actor.permissions.includes(
          'legal-entity.branding.manage',
        ),
        canReadAudit: actor.permissions.includes('legal-entity.audit.read'),
      },
    };
  }

  async selectable(actor: AuthenticatedActor) {
    const rows = await this.database.client.legalEntity.findMany({
      where: { isActive: true },
      orderBy: { code: 'desc' },
    });
    return {
      data: rows.map(summary),
      meta: {
        canAggregate: actor.permissions.includes('legal-entity.aggregate.read'),
      },
    };
  }

  async current(actor: AuthenticatedActor) {
    const context = await this.resolveContext(actor.userId);
    return { data: this.contextResponse(context) };
  }

  async switch(
    selection: LegalEntitySelection,
    expectedVersion: number,
    actor: AuthenticatedActor,
  ) {
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0)
      throw new BadRequestException(
        'expectedVersion باید عدد صحیح نامنفی باشد.',
      );
    assertLegalEntitySelection(selection, actor.permissions);
    const selected =
      selection === LEGAL_ENTITY_CONTEXT_ALL
        ? null
        : await this.database.client.legalEntity.findFirst({
            where: { code: selection, isActive: true },
          });
    if (selection !== LEGAL_ENTITY_CONTEXT_ALL && !selected)
      throw new BadRequestException('شرکت صادرکننده فعال نیست.');
    const mode =
      selection === LEGAL_ENTITY_CONTEXT_ALL
        ? LegalEntityContextMode.ALL
        : LegalEntityContextMode.SPECIFIC;
    try {
      const result = await this.database.client.$transaction(
        async (transaction) => {
          if (expectedVersion === 0) {
            const existing =
              await transaction.userLegalEntityContext.findUnique({
                where: { userId: actor.userId },
              });
            if (existing) throw concurrentModification();
            const row = await transaction.userLegalEntityContext.create({
              data: {
                userId: actor.userId,
                mode,
                legalEntityId: selected?.id ?? null,
              },
              include: { legalEntity: true },
            });
            await transaction.legalEntityAuditEvent.create({
              data: {
                actorUserId: actor.userId,
                action: 'legal-entity.context.switch',
                entityId: selected?.id ?? null,
                outcome: AuditOutcome.SUCCESS,
                beforeSnapshot: json({ selection: null, version: 0 }),
                afterSnapshot: json({ selection, version: row.version }),
              },
            });
            return row;
          }

          const before = await transaction.userLegalEntityContext.findUnique({
            where: { userId: actor.userId },
          });
          const claimed = await transaction.userLegalEntityContext.updateMany({
            where: { userId: actor.userId, version: expectedVersion },
            data: {
              mode,
              legalEntityId: selected?.id ?? null,
              version: { increment: 1 },
            },
          });
          if (claimed.count !== 1) throw concurrentModification();
          const row =
            await transaction.userLegalEntityContext.findUniqueOrThrow({
              where: { userId: actor.userId },
              include: { legalEntity: true },
            });
          await transaction.legalEntityAuditEvent.create({
            data: {
              actorUserId: actor.userId,
              action: 'legal-entity.context.switch',
              entityId: selected?.id ?? null,
              outcome: AuditOutcome.SUCCESS,
              beforeSnapshot: json({
                selection:
                  before?.mode === LegalEntityContextMode.ALL
                    ? LEGAL_ENTITY_CONTEXT_ALL
                    : (before?.legalEntityId ?? null),
                version: before?.version ?? null,
              }),
              afterSnapshot: json({ selection, version: row.version }),
            },
          });
          return row;
        },
      );
      return { data: this.contextResponse(result) };
    } catch (error) {
      if (hasPrismaCode(error, 'P2002')) throw concurrentModification();
      throw error;
    }
  }
  async find(id: string, actor: AuthenticatedActor) {
    const row = await this.database.client.legalEntity.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('شرکت صادرکننده یافت نشد.');
    return { data: detail(row, isSensitiveBrandingAllowed(actor.permissions)) };
  }

  async update(
    id: string,
    input: LegalEntityUpdateRequest,
    actor: AuthenticatedActor,
  ) {
    const { expectedVersion, ...values } = input;
    const changedFields = Object.keys(values);
    if (!changedFields.length)
      throw new BadRequestException('حداقل یک فیلد برای ویرایش لازم است.');
    const brandingChanged = changedFields.some((field) =>
      brandingFields.has(field),
    );
    if (
      brandingChanged &&
      !actor.permissions.includes('legal-entity.branding.manage')
    )
      throw new ForbiddenException('مجوز مدیریت Branding شرکت وجود ندارد.');
    if (values.persianName !== undefined && !values.persianName.trim())
      throw new BadRequestException('نام فارسی الزامی است.');
    return this.database.client.$transaction(async (transaction) => {
      const before = await transaction.legalEntity.findUnique({
        where: { id },
      });
      if (!before) throw new NotFoundException('شرکت صادرکننده یافت نشد.');
      const claimed = await transaction.legalEntity.updateMany({
        where: { id, version: expectedVersion },
        data: {
          ...values,
          updatedByUserId: actor.userId,
          version: { increment: 1 },
          brandingSnapshotVersion: { increment: 1 },
        },
      });
      if (claimed.count !== 1)
        throw new ConflictException({
          code: 'CONCURRENT_MODIFICATION',
          message: 'شرکت هم‌زمان تغییر کرده است.',
        });
      const row = await transaction.legalEntity.findUniqueOrThrow({
        where: { id },
      });
      const nextSnapshot = snapshot(row);
      await transaction.legalEntityBrandingVersion.create({
        data: {
          legalEntityId: id,
          version: row.brandingSnapshotVersion,
          snapshot: json(nextSnapshot),
          createdByUserId: actor.userId,
        },
      });
      await transaction.legalEntityAuditEvent.create({
        data: {
          actorUserId: actor.userId,
          action: brandingChanged
            ? 'legal-entity.branding.update'
            : 'legal-entity.update',
          entityId: id,
          outcome: AuditOutcome.SUCCESS,
          beforeSnapshot: json(safeAudit(before)),
          afterSnapshot: json(safeAudit(row)),
        },
      });
      return { data: detail(row, true) };
    });
  }

  async setStatus(
    id: string,
    status: 'active' | 'inactive',
    expectedVersion: number,
    confirm: boolean,
    actor: AuthenticatedActor,
  ) {
    if (!confirm)
      throw new BadRequestException('تأیید صریح تغییر وضعیت الزامی است.');
    const before = await this.database.client.legalEntity.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('شرکت صادرکننده یافت نشد.');
    const isActive = status === 'active';
    if (!isActive) {
      const [activeCount, usageCount] = await Promise.all([
        this.database.client.legalEntity.count({ where: { isActive: true } }),
        this.database.client.userLegalEntityContext.count({
          where: { legalEntityId: id },
        }),
      ]);
      if (activeCount <= 1)
        throw new ConflictException('حداقل یک شرکت فعال باید باقی بماند.');
      if (usageCount > 0)
        throw new ConflictException(
          'شرکت در Context کاربران فعال است؛ ابتدا وابستگی‌ها را منتقل کنید.',
        );
    }
    const claimed = await this.database.client.legalEntity.updateMany({
      where: { id, version: expectedVersion },
      data: {
        isActive,
        deactivatedAt: isActive ? null : new Date(),
        updatedByUserId: actor.userId,
        version: { increment: 1 },
      },
    });
    if (claimed.count !== 1)
      throw new ConflictException({
        code: 'CONCURRENT_MODIFICATION',
        message: 'شرکت هم‌زمان تغییر کرده است.',
      });
    const row = await this.database.client.legalEntity.findUniqueOrThrow({
      where: { id },
    });
    await this.database.client.legalEntityAuditEvent.create({
      data: {
        actorUserId: actor.userId,
        action: 'legal-entity.status.update',
        entityId: id,
        outcome: AuditOutcome.SUCCESS,
        reason: status,
        beforeSnapshot: json(safeAudit(before)),
        afterSnapshot: json(safeAudit(row)),
      },
    });
    return { data: detail(row, true) };
  }

  async branding(id: string, actor: AuthenticatedActor) {
    const row = await this.database.client.legalEntity.findFirst({
      where: { id, isActive: true },
    });
    if (!row) throw new NotFoundException('Branding شرکت فعال یافت نشد.');
    return {
      data: snapshot(row, isSensitiveBrandingAllowed(actor.permissions)),
    };
  }

  async audit(id: string) {
    const events = await this.database.client.legalEntityAuditEvent.findMany({
      where: { entityId: id },
      orderBy: { occurredAt: 'desc' },
      take: 100,
      select: {
        id: true,
        actorUserId: true,
        action: true,
        outcome: true,
        reason: true,
        beforeSnapshot: true,
        afterSnapshot: true,
        occurredAt: true,
      },
    });
    return {
      data: events.map((event) => ({
        ...event,
        outcome: event.outcome.toLowerCase(),
        occurredAt: event.occurredAt.toISOString(),
      })),
    };
  }

  async issueTargets(actor: AuthenticatedActor, strategy: IssueTargetStrategy) {
    const context = await this.resolveContext(actor.userId);
    if (context.mode === LegalEntityContextMode.ALL)
      assertLegalEntitySelection('ALL', actor.permissions);
    const rows = await this.database.client.legalEntity.findMany({
      where: { isActive: true },
      orderBy: { code: 'desc' },
    });
    const selection =
      context.mode === LegalEntityContextMode.ALL
        ? 'ALL'
        : entityCode(context.legalEntity?.code ?? '');
    const plan = resolveIssueTargetIds(
      selection,
      context.legalEntityId,
      rows.map(({ id }) => id),
      strategy,
    );
    const targets = rows
      .filter((row) => plan.ids.includes(row.id))
      .map(summary);
    return {
      data: {
        targets,
        requiresExplicitIssuer: plan.requiresExplicitIssuer,
        combinedLetterheadAllowed: false as const,
      },
    };
  }

  async recordIssue(input: CreateDocumentIssueDto, actor: AuthenticatedActor) {
    const issuer = await this.validateIssuer(input.issuerLegalEntityId, actor);
    const policy = await this.resolveTemplatePolicy({
      documentType: input.documentType,
      templateId: input.templateId,
      templateVersion: input.templateVersion,
    });
    assertRequiredLetterhead(
      policy.requiresLetterhead,
      issuer.letterheadFileId,
    );
    const issue = await this.database.client.$transaction(
      async (transaction) => {
        const branding = await this.resolveBrandingVersion(transaction, issuer);
        const row = await transaction.legalEntityDocumentIssue.create({
          data: {
            issuerLegalEntityId: issuer.id,
            issuerCode: issuer.code,
            issuerName: issuer.persianName,
            brandingSnapshotId: branding.id,
            brandingSnapshotVersion: branding.version,
            brandingSnapshot: json(branding.snapshot),
            templateId: policy.templateId,
            templateVersion: policy.templateVersion,
            templatePolicyId: policy.policyId,
            templatePolicyVersion: policy.policyVersion,
            actorUserId: actor.userId,
            documentType: policy.documentType,
            referenceEntityType: input.referenceEntityType,
            referenceEntityId: input.referenceEntityId,
            fileHash: input.fileHash ?? null,
            status: LegalEntityDocumentIssueStatus.ISSUED,
          },
        });
        await transaction.legalEntityAuditEvent.create({
          data: {
            actorUserId: actor.userId,
            action: 'legal-entity.document.issue',
            entityId: issuer.id,
            outcome: AuditOutcome.SUCCESS,
            afterSnapshot: json({
              issueId: row.id,
              documentType: policy.documentType,
              templateId: policy.templateId,
              templateVersion: policy.templateVersion,
              templatePolicyId: policy.policyId,
              templatePolicyVersion: policy.policyVersion,
              referenceEntityType: input.referenceEntityType,
              referenceEntityId: input.referenceEntityId,
              brandingSnapshotId: branding.id,
              brandingSnapshotVersion: branding.version,
            }),
          },
        });
        return row;
      },
    );
    return { data: this.issueMetadata(issue) };
  }

  async reissue(input: ReissueDocumentDto, actor: AuthenticatedActor) {
    const reason = normalizeReissueReason(input.reason);
    const original =
      await this.database.client.legalEntityDocumentIssue.findUnique({
        where: { id: input.originalIssueId },
      });
    if (!original) throw new NotFoundException('سند اصلی یافت نشد.');
    const issuer = await this.validateIssuer(
      original.issuerLegalEntityId,
      actor,
    );
    const policy = await this.resolveTemplatePolicy({
      documentType: original.documentType,
      templateId: original.templateId,
      templateVersion: original.templateVersion,
    });
    assertRequiredLetterhead(
      policy.requiresLetterhead,
      issuer.letterheadFileId,
    );
    const issue = await this.database.client.$transaction(
      async (transaction) => {
        const branding = await this.resolveBrandingVersion(transaction, issuer);
        const row = await transaction.legalEntityDocumentIssue.create({
          data: {
            issuerLegalEntityId: issuer.id,
            issuerCode: issuer.code,
            issuerName: issuer.persianName,
            brandingSnapshotId: branding.id,
            brandingSnapshotVersion: branding.version,
            brandingSnapshot: json(branding.snapshot),
            templateId: policy.templateId,
            templateVersion: policy.templateVersion,
            templatePolicyId: policy.policyId,
            templatePolicyVersion: policy.policyVersion,
            actorUserId: actor.userId,
            documentType: policy.documentType,
            referenceEntityType: original.referenceEntityType,
            referenceEntityId: original.referenceEntityId,
            fileHash: input.fileHash ?? null,
            status: LegalEntityDocumentIssueStatus.ISSUED,
            reissueReason: reason,
            originalIssueId: original.id,
          },
        });
        await transaction.legalEntityAuditEvent.create({
          data: {
            actorUserId: actor.userId,
            action: 'legal-entity.document.reissue',
            entityId: issuer.id,
            outcome: AuditOutcome.SUCCESS,
            reason,
            afterSnapshot: json({
              issueId: row.id,
              originalIssueId: original.id,
              documentType: policy.documentType,
              templateId: policy.templateId,
              templateVersion: policy.templateVersion,
              templatePolicyId: policy.policyId,
              templatePolicyVersion: policy.policyVersion,
              brandingSnapshotId: branding.id,
              brandingSnapshotVersion: branding.version,
            }),
          },
        });
        return row;
      },
    );
    return { data: this.issueMetadata(issue) };
  }
  private async validateIssuer(
    id: string,
    actor: AuthenticatedActor,
  ): Promise<EntityRow> {
    const [issuer, context] = await Promise.all([
      this.database.client.legalEntity.findFirst({
        where: { id, isActive: true },
      }),
      this.resolveContext(actor.userId),
    ]);
    if (!issuer)
      throw new BadRequestException('شرکت صادرکننده واقعی و فعال نیست.');
    if (context.mode === LegalEntityContextMode.ALL)
      throw new UnprocessableEntityException({
        code: 'LEGAL_ENTITY_SPECIFIC_CONTEXT_REQUIRED',
        message: 'صدور و صدور مجدد در حالت هر دو شرکت مجاز نیست.',
      });
    if (context.legalEntityId !== id)
      throw new ForbiddenException(
        'شرکت صادرکننده با Context فعال کاربر یکسان نیست.',
      );
    return issuer;
  }

  private async resolveTemplatePolicy(query: {
    documentType: string;
    templateId: string;
    templateVersion: string;
  }): Promise<ResolvedDocumentTemplatePolicy> {
    const policy = await this.templatePolicies.resolve(query);
    if (
      !policy ||
      policy.documentType !== query.documentType ||
      policy.templateId !== query.templateId ||
      policy.templateVersion !== query.templateVersion
    )
      throw new UnprocessableEntityException({
        code: 'DOCUMENT_TEMPLATE_POLICY_NOT_FOUND',
        message: 'Policy معتبر و قابل اعتماد برای قالب سند یافت نشد.',
      });
    return policy;
  }

  private async resolveBrandingVersion(
    transaction: Prisma.TransactionClient,
    issuer: EntityRow,
  ) {
    const branding = await transaction.legalEntityBrandingVersion.findUnique({
      where: {
        legalEntityId_version: {
          legalEntityId: issuer.id,
          version: issuer.brandingSnapshotVersion,
        },
      },
    });
    if (!branding)
      throw new ConflictException({
        code: 'LEGAL_ENTITY_BRANDING_SNAPSHOT_NOT_FOUND',
        message: 'نسخه Branding شرکت برای صدور سند یافت نشد.',
      });
    return branding;
  }

  private async resolveContext(userId: string) {
    const existing =
      await this.database.client.userLegalEntityContext.findUnique({
        where: { userId },
        include: { legalEntity: true },
      });
    if (
      existing &&
      (existing.mode === LegalEntityContextMode.ALL ||
        existing.legalEntity?.isActive)
    )
      return existing;
    const preferred =
      (await this.database.client.legalEntity.findFirst({
        where: { code: 'NIYAYESH_SEIR_SAHAR', isActive: true },
      })) ??
      (await this.database.client.legalEntity.findFirst({
        where: { isActive: true },
        orderBy: { code: 'asc' },
      }));
    if (!preferred)
      throw new ConflictException('هیچ شرکت صادرکننده فعالی وجود ندارد.');
    return {
      mode: LegalEntityContextMode.SPECIFIC,
      legalEntityId: preferred.id,
      version: existing?.version ?? 0,
      legalEntity: preferred,
    };
  }
  private contextResponse(context: {
    mode: LegalEntityContextMode;
    legalEntityId: string | null;
    version: number;
    legalEntity: EntityRow | null;
  }) {
    const isAggregate = context.mode === LegalEntityContextMode.ALL;
    return {
      selection: isAggregate
        ? LEGAL_ENTITY_CONTEXT_ALL
        : entityCode(context.legalEntity?.code ?? ''),
      legalEntity: context.legalEntity ? summary(context.legalEntity) : null,
      isAggregate,
      version: context.version,
    };
  }

  private issueMetadata(issue: {
    id: string;
    issuerLegalEntityId: string;
    issuerCode: string;
    issuerName: string;
    brandingSnapshotId: string;
    brandingSnapshotVersion: number;
    templateId: string;
    templateVersion: string;
    templatePolicyId: string;
    templatePolicyVersion: string;
    actorUserId: string;
    issuedAt: Date;
    documentType: string;
    referenceEntityType: string;
    referenceEntityId: string;
    fileHash: string | null;
    status: LegalEntityDocumentIssueStatus;
    reissueReason: string | null;
  }) {
    return {
      id: issue.id,
      issuerLegalEntityId: issue.issuerLegalEntityId,
      issuerCode: entityCode(issue.issuerCode),
      issuerName: issue.issuerName,
      brandingSnapshotId: issue.brandingSnapshotId,
      brandingSnapshotVersion: issue.brandingSnapshotVersion,
      templateId: issue.templateId,
      templateVersion: issue.templateVersion,
      templatePolicyId: issue.templatePolicyId,
      templatePolicyVersion: issue.templatePolicyVersion,
      actorUserId: issue.actorUserId,
      issuedAt: issue.issuedAt.toISOString(),
      documentType: issue.documentType,
      referenceEntityType: issue.referenceEntityType,
      referenceEntityId: issue.referenceEntityId,
      fileHash: issue.fileHash,
      status: issue.status.toLowerCase(),
      reissueReason: issue.reissueReason,
    };
  }
}
