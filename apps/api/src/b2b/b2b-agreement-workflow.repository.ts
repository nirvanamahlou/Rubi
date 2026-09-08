import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@rubi/database';
import type { B2bAgreementTermsV1, B2bCooperationRole } from '@rubi/contracts';
import { DatabaseService } from '../database/database.service';

export const agreementCaseInclude = {
  profile: true,
  revisions: {
    orderBy: { number: 'desc' },
    include: {
      creditPolicies: true,
      guarantees: true,
    },
  },
} satisfies Prisma.B2bAgencyAgreementInclude;
export type AgreementCaseRow = Prisma.B2bAgencyAgreementGetPayload<{
  include: typeof agreementCaseInclude;
}>;
type Scope = {
  organizationId: string;
  branchId: string;
  role: B2bCooperationRole;
};
type Command = Scope & {
  requestId: string;
  actorUserId: string;
  agreementId?: string | undefined;
  version?: number | undefined;
};
type Tx = Prisma.TransactionClient;
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const fail = (code: string, message: string): never => {
  throw new ConflictException({ code, message });
};
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

@Injectable()
export class B2bAgreementWorkflowRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async list(scope: Scope, page: number, pageSize: number) {
    const where = {
      profile: {
        organizationId: scope.organizationId,
        branchId: scope.branchId,
        role: scope.role,
      },
    };
    const [data, total] = await this.database.client.$transaction([
      this.database.client.b2bAgencyAgreement.findMany({
        where,
        include: agreementCaseInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.database.client.b2bAgencyAgreement.count({ where }),
    ]);
    return { data, total };
  }
  async find(scope: Scope, agreementId: string, tx: Tx = this.database.client) {
    const row = await tx.b2bAgencyAgreement.findFirst({
      where: {
        id: agreementId,
        profile: {
          organizationId: scope.organizationId,
          branchId: scope.branchId,
          role: scope.role,
        },
      },
      include: agreementCaseInclude,
    });
    if (!row)
      throw new NotFoundException('قرارداد این سازمان و شعبه یافت نشد.');
    return row;
  }
  private async run(
    command: Command,
    payload: unknown,
    operation: (tx: Tx) => Promise<AgreementCaseRow>,
  ) {
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(canonical(payload)))
      .digest('hex');
    return this.database.client.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`b2b-command:${command.actorUserId}:${command.requestId}`},0))::text`;
        const prior = await tx.b2bAgreementCommand.findUnique({
          where: {
            actorUserId_requestId: {
              actorUserId: command.actorUserId,
              requestId: command.requestId,
            },
          },
        });
        if (prior) {
          if (prior.fingerprint !== fingerprint)
            fail(
              'B2B_COMMAND_CONFLICT',
              'این شناسه درخواست قبلاً با اطلاعات متفاوت استفاده شده است.',
            );
          return this.find(command, prior.agreementId, tx);
        }
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`b2b-profile:${command.organizationId}:${command.branchId}`},0))::text`;
        const row = await operation(tx);
        await tx.b2bAgreementCommand.create({
          data: {
            actorUserId: command.actorUserId,
            requestId: command.requestId,
            fingerprint,
            agreementId: row.id,
            resultVersion: row.version,
          },
        });
        return row;
      },
      { timeout: 15000 },
    );
  }
  private async audit(
    tx: Tx,
    command: Command,
    action: string,
    entityType: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ) {
    await tx.b2bAuditEvent.create({
      data: {
        actorUserId: command.actorUserId,
        branchId: command.branchId,
        action,
        entityType,
        entityId,
        beforeSnapshot: before ? json(before) : Prisma.JsonNull,
        afterSnapshot: json(after),
      },
    });
  }
  async save(
    command: Command,
    terms: B2bAgreementTermsV1,
    prepare: (
      before: AgreementCaseRow | null,
    ) => Promise<B2bAgreementTermsV1> = async () => terms,
  ) {
    return this.run(
      command,
      { action: 'save', ...command, terms },
      async (tx) => {
        let before: AgreementCaseRow | null = null;
        let agreementId = command.agreementId;
        let profileId: string;
        if (agreementId) {
          before = await this.find(command, agreementId, tx);
          if (before.version !== command.version)
            fail(
              'B2B_VERSION_CONFLICT',
              'قرارداد هم‌زمان تغییر کرده است؛ دوباره بارگذاری کنید.',
            );
          if (before.revisions[0]?.status === 'PENDING')
            fail(
              'B2B_REVIEW_PENDING',
              'نسخه ارسال‌شده تا تعیین نتیجه تأیید قابل ویرایش نیست.',
            );
          profileId = before.profileId;
          if (
            !before.profile.isActive ||
            ['SUSPENDED', 'ENDED'].includes(before.profile.status)
          )
            fail(
              'B2B_PROFILE_INACTIVE',
              'همکاری این شعبه تعلیق یا خاتمه یافته است.',
            );
          terms = await prepare(before);
        } else {
          terms = await prepare(null);
          if (command.version !== undefined)
            fail('B2B_VERSION_CONFLICT', 'نسخه قرارداد جدید نباید ارسال شود.');
          const profile = await tx.agencyOperationalProfile.upsert({
            where: {
              organizationId_branchId_role: {
                organizationId: command.organizationId,
                branchId: command.branchId,
                role: command.role,
              },
            },
            create: {
              organizationId: command.organizationId,
              branchId: command.branchId,
              role: command.role,
              status: 'UNDER_REVIEW',
              createdByUserId: command.actorUserId,
              updatedByUserId: command.actorUserId,
            },
            update: {},
          });
          if (
            !profile.isActive ||
            ['SUSPENDED', 'ENDED'].includes(profile.status)
          )
            fail(
              'B2B_PROFILE_INACTIVE',
              'همکاری این شعبه تعلیق یا خاتمه یافته است.',
            );
          profileId = profile.id;
          const agreement = await tx.b2bAgencyAgreement.create({
            data: {
              profileId,
              code: `AGR-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`,
              title: terms.title,
              startsAt: date(terms.startsAt),
              endsAt: terms.endsAt ? date(terms.endsAt) : null,
              status: 'DRAFT',
              createdByUserId: command.actorUserId,
              updatedByUserId: command.actorUserId,
            },
          });
          agreementId = agreement.id;
        }
        const latest = before?.revisions[0];
        const content = {
          title: terms.title.trim(),
          agreementType: terms.agreementType,
          startsAt: date(terms.startsAt),
          endsAt: terms.endsAt ? date(terms.endsAt) : null,
          currencyCodes: terms.currencyCodes,
          services: terms.services,
          paymentMethod: terms.paymentMethod,
          settlementCycle: terms.settlementCycle,
          settlementDays: terms.settlementDays,
          cutoffDay: terms.cutoffDay,
          slaHours: terms.slaHours,
          cancellationTerms: terms.cancellationTerms,
          refundTerms: terms.refundTerms,
          notes: terms.notes,
          changeReason: terms.changeReason,
          documentVersionId: terms.documentVersionId ?? null,
        };
        let revisionId: string;
        if (latest?.status === 'DRAFT') {
          await tx.b2bAgencyCreditPolicy.deleteMany({
            where: { revisionId: latest.id },
          });
          await tx.b2bAgreementGuarantee.deleteMany({
            where: { revisionId: latest.id },
          });
          revisionId = (
            await tx.b2bAgreementRevision.update({
              where: { id: latest.id },
              data: content,
            })
          ).id;
        } else {
          revisionId = (
            await tx.b2bAgreementRevision.create({
              data: {
                ...content,
                agreementId,
                number: (latest?.number ?? 0) + 1,
                createdByUserId: command.actorUserId,
              },
            })
          ).id;
        }
        for (const policy of terms.creditPolicies)
          await tx.b2bAgencyCreditPolicy.create({
            data: {
              profileId,
              revisionId,
              currencyCode: policy.currencyCode,
              creditLimit: new Prisma.Decimal(policy.creditLimit),
              limitType: policy.limitType,
              dueDays: policy.dueDays,
              overdueAction: policy.overdueAction,
              effectiveFrom: date(policy.effectiveFrom),
              expiresAt: policy.expiresAt ? date(policy.expiresAt) : null,
              isActive: true,
              createdByUserId: command.actorUserId,
              updatedByUserId: command.actorUserId,
            },
          });
        for (const guarantee of terms.guarantees)
          await tx.b2bAgreementGuarantee.create({
            data: {
              revisionId,
              kind: guarantee.kind,
              reference: guarantee.reference,
              amount: new Prisma.Decimal(guarantee.amount),
              currencyCode: guarantee.currencyCode,
              issuer: guarantee.issuer,
              receivedAt: date(guarantee.receivedAt),
              expiresAt: guarantee.expiresAt ? date(guarantee.expiresAt) : null,
              status: guarantee.status,
              documentVersionId: guarantee.documentVersionId ?? null,
            },
          });
        if (before)
          await tx.b2bAgencyAgreement.update({
            where: { id: agreementId },
            data: {
              version: { increment: 1 },
              updatedByUserId: command.actorUserId,
              ...(!before.activeRevisionId
                ? {
                    title: terms.title,
                    startsAt: date(terms.startsAt),
                    endsAt: terms.endsAt ? date(terms.endsAt) : null,
                  }
                : {}),
            },
          });
        const row = await this.find(command, agreementId, tx);
        await this.audit(
          tx,
          command,
          'b2b.agreement.draft_saved',
          'B2bAgreementRevision',
          revisionId,
          before?.revisions[0],
          row.revisions[0],
        );
        return row;
      },
    );
  }
  async transition(
    command: Command & { agreementId: string; version: number },
    action: 'SUBMIT' | 'APPROVE' | 'REJECT',
    reason: string,
    validate: (row: AgreementCaseRow) => Promise<void> = async () => {},
  ) {
    return this.run(command, { ...command, action, reason }, async (tx) => {
      const before = await this.find(command, command.agreementId, tx);
      if (before.version !== command.version)
        fail(
          'B2B_VERSION_CONFLICT',
          'قرارداد هم‌زمان تغییر کرده است؛ دوباره بارگذاری کنید.',
        );
      const revision = before.revisions[0];
      if (!revision) throw new ConflictException('نسخه قرارداد یافت نشد.');
      if (revision.status !== (action === 'SUBMIT' ? 'DRAFT' : 'PENDING'))
        fail(
          'B2B_INVALID_TRANSITION',
          'وضعیت این نسخه برای عملیات انتخاب‌شده مناسب نیست.',
        );
      if (
        !before.profile.isActive ||
        ['SUSPENDED', 'ENDED'].includes(before.profile.status)
      )
        fail('B2B_PROFILE_INACTIVE', 'همکاری این شعبه فعال نیست.');
      await validate(before);
      if (action !== 'SUBMIT') {
        const contribution = await tx.b2bAuditEvent.findFirst({
          where: {
            entityType: 'B2bAgreementRevision',
            entityId: revision.id,
            actorUserId: command.actorUserId,
            action: 'b2b.agreement.draft_saved',
          },
          select: { id: true },
        });
        if (
          revision.createdByUserId === command.actorUserId ||
          revision.submittedByUserId === command.actorUserId ||
          contribution
        )
          throw new ForbiddenException({
            code: 'B2B_SELF_REVIEW_FORBIDDEN',
            message:
              'ثبت‌کننده یا ویرایش‌کننده این نسخه نمی‌تواند آن را تأیید یا رد کند.',
          });
      }
      if (action !== 'REJECT') {
        const conflict = await tx.b2bAgencyAgreement.findFirst({
          where: {
            id: { not: before.id },
            profileId: before.profileId,
            status: 'ACTIVE',
            ...(revision.endsAt ? { startsAt: { lte: revision.endsAt } } : {}),
            AND: [
              {
                OR: [{ endsAt: null }, { endsAt: { gte: revision.startsAt } }],
              },
              {
                OR: [
                  { activeRevisionId: null },
                  {
                    activeRevision: {
                      currencyCodes: { hasSome: revision.currencyCodes },
                    },
                  },
                ],
              },
            ],
          },
          select: { code: true },
        });
        if (conflict)
          fail(
            'B2B_AGREEMENT_OVERLAP',
            `بازه و ارزهای این قرارداد با قرارداد فعال ${conflict.code} تداخل دارد؛ قرارداد قبلی را اصلاح کنید.`,
          );
      }
      await tx.b2bAgreementRevision.update({
        where: { id: revision.id },
        data:
          action === 'SUBMIT'
            ? {
                status: 'PENDING',
                submittedByUserId: command.actorUserId,
                submittedAt: new Date(),
              }
            : {
                status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
                reviewedByUserId: command.actorUserId,
                reviewedAt: new Date(),
                reviewReason: reason,
              },
      });
      await tx.b2bAgencyAgreement.update({
        where: { id: before.id },
        data: {
          version: { increment: 1 },
          updatedByUserId: command.actorUserId,
          ...(action === 'APPROVE'
            ? {
                activeRevisionId: revision.id,
                status: 'ACTIVE',
                isActive: true,
                title: revision.title,
                startsAt: revision.startsAt,
                endsAt: revision.endsAt,
              }
            : {}),
        },
      });
      if (action === 'APPROVE' && before.profile.status === 'UNDER_REVIEW') {
        const profile = await tx.agencyOperationalProfile.update({
          where: { id: before.profileId },
          data: {
            status: 'ACTIVE',
            version: { increment: 1 },
            updatedByUserId: command.actorUserId,
          },
        });
        await this.audit(
          tx,
          command,
          'b2b.agency.approved',
          'AgencyOperationalProfile',
          profile.id,
          before.profile,
          profile,
        );
      }
      const row = await this.find(command, before.id, tx);
      await this.audit(
        tx,
        command,
        `b2b.agreement.${action.toLowerCase()}`,
        'B2bAgreementRevision',
        revision.id,
        before.revisions[0],
        { ...row.revisions[0], reason },
      );
      return row;
    });
  }
}
