import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
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
import type {
  CreateDocumentIssueDto,
  ReissueDocumentDto,
} from './legal-entities.dto';
import {
  assertLegalEntitySelection,
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
    const context = await this.ensureContext(actor.userId);
    return { data: this.contextResponse(context) };
  }

  async switch(
    selection: LegalEntitySelection,
    expectedVersion: number | undefined,
    actor: AuthenticatedActor,
  ) {
    assertLegalEntitySelection(selection, actor.permissions);
    const current =
      await this.database.client.userLegalEntityContext.findUnique({
        where: { userId: actor.userId },
      });
    if (
      expectedVersion !== undefined &&
      current &&
      current.version !== expectedVersion
    )
      throw new ConflictException({
        code: 'CONCURRENT_MODIFICATION',
        message: 'Context هم‌زمان تغییر کرده است.',
      });
    const selected =
      selection === LEGAL_ENTITY_CONTEXT_ALL
        ? null
        : await this.database.client.legalEntity.findFirst({
            where: { code: selection, isActive: true },
          });
    if (selection !== LEGAL_ENTITY_CONTEXT_ALL && !selected)
      throw new BadRequestException('شرکت صادرکننده فعال نیست.');
    const result = await this.database.client.$transaction(
      async (transaction) => {
        const row = await transaction.userLegalEntityContext.upsert({
          where: { userId: actor.userId },
          create: {
            userId: actor.userId,
            mode:
              selection === LEGAL_ENTITY_CONTEXT_ALL
                ? LegalEntityContextMode.ALL
                : LegalEntityContextMode.SPECIFIC,
            legalEntityId: selected?.id ?? null,
          },
          update: {
            mode:
              selection === LEGAL_ENTITY_CONTEXT_ALL
                ? LegalEntityContextMode.ALL
                : LegalEntityContextMode.SPECIFIC,
            legalEntityId: selected?.id ?? null,
            version: { increment: 1 },
          },
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
                current?.mode === LegalEntityContextMode.ALL
                  ? 'ALL'
                  : (current?.legalEntityId ?? null),
            }),
            afterSnapshot: json({ selection }),
          },
        });
        return row;
      },
    );
    return { data: this.contextResponse(result) };
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
    const context = await this.ensureContext(actor.userId);
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
    const branding = snapshot(issuer);
    const issue = await this.database.client.$transaction(
      async (transaction) => {
        const row = await transaction.legalEntityDocumentIssue.create({
          data: {
            issuerLegalEntityId: issuer.id,
            issuerCode: issuer.code,
            issuerName: issuer.persianName,
            brandingSnapshotVersion: issuer.brandingSnapshotVersion,
            brandingSnapshot: json(branding),
            templateVersion: input.templateVersion,
            actorUserId: actor.userId,
            documentType: input.documentType,
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
              documentType: input.documentType,
              referenceEntityType: input.referenceEntityType,
              referenceEntityId: input.referenceEntityId,
              brandingSnapshotVersion: issuer.brandingSnapshotVersion,
            }),
          },
        });
        return row;
      },
    );
    return { data: this.issueMetadata(issue) };
  }

  async reissue(input: ReissueDocumentDto, actor: AuthenticatedActor) {
    const original =
      await this.database.client.legalEntityDocumentIssue.findUnique({
        where: { id: input.originalIssueId },
      });
    if (!original) throw new NotFoundException('سند اصلی یافت نشد.');
    const issuer = await this.validateIssuer(
      original.issuerLegalEntityId,
      actor,
    );
    const branding = snapshot(issuer);
    const issue = await this.database.client.legalEntityDocumentIssue.create({
      data: {
        issuerLegalEntityId: issuer.id,
        issuerCode: issuer.code,
        issuerName: issuer.persianName,
        brandingSnapshotVersion: issuer.brandingSnapshotVersion,
        brandingSnapshot: json(branding),
        templateVersion: input.templateVersion,
        actorUserId: actor.userId,
        documentType: original.documentType,
        referenceEntityType: original.referenceEntityType,
        referenceEntityId: original.referenceEntityId,
        fileHash: input.fileHash ?? null,
        status: LegalEntityDocumentIssueStatus.ISSUED,
        reissueReason: input.reason,
        originalIssueId: original.id,
      },
    });
    await this.database.client.legalEntityAuditEvent.create({
      data: {
        actorUserId: actor.userId,
        action: 'legal-entity.document.reissue',
        entityId: issuer.id,
        outcome: AuditOutcome.SUCCESS,
        reason: input.reason,
        afterSnapshot: json({
          issueId: issue.id,
          originalIssueId: original.id,
          brandingSnapshotVersion: issuer.brandingSnapshotVersion,
        }),
      },
    });
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
      this.ensureContext(actor.userId),
    ]);
    if (!issuer)
      throw new BadRequestException('شرکت صادرکننده واقعی و فعال نیست.');
    if (
      context.mode === LegalEntityContextMode.SPECIFIC &&
      context.legalEntityId !== id
    )
      throw new ForbiddenException(
        'شرکت صادرکننده با Context فعال کاربر یکسان نیست.',
      );
    if (
      context.mode === LegalEntityContextMode.ALL &&
      !actor.permissions.includes('legal-entity.aggregate.read')
    )
      throw new ForbiddenException('Context تجمیعی غیرمجاز است.');
    return issuer;
  }

  private async ensureContext(userId: string) {
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
    return this.database.client.userLegalEntityContext.upsert({
      where: { userId },
      create: {
        userId,
        mode: LegalEntityContextMode.SPECIFIC,
        legalEntityId: preferred.id,
      },
      update: {
        mode: LegalEntityContextMode.SPECIFIC,
        legalEntityId: preferred.id,
        version: { increment: 1 },
      },
      include: { legalEntity: true },
    });
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
    brandingSnapshotVersion: number;
    templateVersion: string;
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
      brandingSnapshotVersion: issue.brandingSnapshotVersion,
      templateVersion: issue.templateVersion,
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
