import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { b2bAgreementTermsIssue } from '@rubi/contracts';
import type {
  AuthenticatedActor,
  B2bAgreementCaseV1,
  B2bAgreementRevisionV1,
  B2bAgreementTermsV1,
  B2bCooperationRole,
  IamPermissionCode,
} from '@rubi/contracts';
import { MasterOrganizationDirectory } from '../master-data/master-organization-directory';
import { B2bAgreementDocuments } from './b2b-agreement-documents';
import { B2bAgreementWorkflowRepository } from './b2b-agreement-workflow.repository';
import type { AgreementCaseRow } from './b2b-agreement-workflow.repository';
import type {
  B2bAgreementActionDto,
  SaveB2bAgreementDto,
} from './b2b-agreement-workflow.dto';

const day = (date: Date) => date.toISOString().slice(0, 10);
const optionalDay = (date: Date | null) => (date ? day(date) : null);
export function agreementCaseRecord(
  row: AgreementCaseRow,
  documentIds: ReadonlyMap<string, string> = new Map(),
): B2bAgreementCaseV1 {
  return {
    id: row.id,
    organizationId: row.profile.organizationId,
    branchId: row.profile.branchId,
    role: row.profile.role as B2bCooperationRole,
    code: row.code,
    title: row.title,
    startsAt: day(row.startsAt),
    endsAt: optionalDay(row.endsAt),
    status: row.status,
    version: row.version,
    activeRevisionId: row.activeRevisionId,
    revisions: row.revisions.map((revision): B2bAgreementRevisionV1 => ({
      id: revision.id,
      number: revision.number,
      status: revision.status,
      title: revision.title,
      agreementType:
        revision.agreementType as B2bAgreementTermsV1['agreementType'],
      startsAt: day(revision.startsAt),
      endsAt: optionalDay(revision.endsAt),
      currencyCodes: revision.currencyCodes,
      services: revision.services as B2bAgreementTermsV1['services'],
      paymentMethod:
        revision.paymentMethod as B2bAgreementTermsV1['paymentMethod'],
      paymentMethodId: revision.paymentMethodId,
      paymentMethodName: revision.paymentMethodName,
      settlementCycle:
        revision.settlementCycle as B2bAgreementTermsV1['settlementCycle'],
      settlementDays: revision.settlementDays,
      cutoffDay: revision.cutoffDay,
      slaHours: revision.slaHours,
      cancellationTerms: revision.cancellationTerms,
      refundTerms: revision.refundTerms,
      notes: revision.notes,
      changeReason: revision.changeReason,
      documentId: revision.documentVersionId
        ? (documentIds.get(revision.documentVersionId) ?? null)
        : null,
      documentVersionId: revision.documentVersionId,
      creditPolicies: revision.creditPolicies.map((policy) => ({
        currencyCode: policy.currencyCode,
        creditLimit: policy.creditLimit.toString(),
        limitType: policy.limitType as 'HARD' | 'SOFT',
        dueDays: policy.dueDays,
        overdueAction: policy.overdueAction as 'BLOCK' | 'WARN',
        effectiveFrom: day(policy.effectiveFrom),
        expiresAt: optionalDay(policy.expiresAt),
      })),
      guarantees: revision.guarantees.map((guarantee) => ({
        kind: guarantee.kind as B2bAgreementTermsV1['guarantees'][number]['kind'],
        reference: guarantee.reference,
        amount: guarantee.amount.toString(),
        currencyCode: guarantee.currencyCode,
        issuer: guarantee.issuer,
        receivedAt: day(guarantee.receivedAt),
        expiresAt: optionalDay(guarantee.expiresAt),
        status: guarantee.status as 'REQUIRED' | 'RECEIVED',
        documentId: guarantee.documentVersionId
          ? (documentIds.get(guarantee.documentVersionId) ?? null)
          : null,
        documentVersionId: guarantee.documentVersionId,
      })),
      createdByUserId: revision.createdByUserId,
      submittedByUserId: revision.submittedByUserId,
      reviewedByUserId: revision.reviewedByUserId,
      createdAt: revision.createdAt.toISOString(),
      submittedAt: revision.submittedAt?.toISOString() ?? null,
      reviewedAt: revision.reviewedAt?.toISOString() ?? null,
      reviewReason: revision.reviewReason,
    })),
  };
}
function permissions(
  actor: AuthenticatedActor,
  ...required: IamPermissionCode[]
) {
  if (required.some((code) => !actor.permissions.includes(code)))
    throw new ForbiddenException({
      code: 'B2B_PERMISSION_DENIED',
      message: 'مجوز قرارداد یا اعتبار برای این عملیات کافی نیست.',
    });
}
const hasCredit = (terms: B2bAgreementTermsV1 | undefined) =>
  Boolean(terms && (terms.creditPolicies.length || terms.guarantees.length));

@Injectable()
export class B2bAgreementWorkflowService {
  constructor(
    @Inject(B2bAgreementWorkflowRepository)
    private readonly repository: B2bAgreementWorkflowRepository,
    @Inject(MasterOrganizationDirectory)
    private readonly organizations: MasterOrganizationDirectory,
    @Inject(B2bAgreementDocuments)
    private readonly documents: B2bAgreementDocuments,
  ) {}

  private scope(
    organizationId: string,
    branchId: string,
    role: B2bCooperationRole,
    actor: AuthenticatedActor,
  ) {
    if (!actor.branchIds.includes(branchId))
      throw new ForbiddenException(
        'شعبه انتخاب‌شده در دامنه دسترسی کاربر نیست.',
      );
    if (!['AGENCY', 'CORPORATE_CUSTOMER'].includes(role))
      throw new BadRequestException('نقش همکاری معتبر نیست.');
    return { organizationId, branchId, role };
  }
  private async identity(organizationId: string, role: B2bCooperationRole) {
    const org = await this.organizations.cooperationReference(
      organizationId,
      role,
    );
    if (!org)
      throw new NotFoundException('سازمان با نقش همکاری انتخاب‌شده یافت نشد.');
    if (!org.isActive) throw new ConflictException('سازمان غیرفعال است.');
  }
  private async record(row: AgreementCaseRow, actor: AuthenticatedActor) {
    const ids = row.revisions
      .flatMap((r) => [
        r.documentVersionId,
        ...r.guarantees.map((g) => g.documentVersionId),
      ])
      .filter((id): id is string => id !== null);
    const documents = await this.documents.referenceMap(
      ids,
      row.profile.organizationId,
      row.profile.branchId,
      actor,
    );
    return agreementCaseRecord(row, documents);
  }

  async list(
    organizationId: string,
    branchId: string,
    role: B2bCooperationRole,
    actor: AuthenticatedActor,
    page = 1,
    pageSize = 20,
  ) {
    permissions(actor, 'b2b.agreement.read', 'b2b.credit.read');
    const scope = this.scope(organizationId, branchId, role, actor);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    )
      throw new BadRequestException('صفحه‌بندی معتبر نیست.');
    const result = await this.repository.list(scope, page, pageSize);
    return {
      data: await Promise.all(
        result.data.map((row) => this.record(row, actor)),
      ),
      meta: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize),
      },
    };
  }
  async get(
    organizationId: string,
    agreementId: string,
    branchId: string,
    role: B2bCooperationRole,
    actor: AuthenticatedActor,
  ) {
    permissions(actor, 'b2b.agreement.read', 'b2b.credit.read');
    return this.record(
      await this.repository.find(
        this.scope(organizationId, branchId, role, actor),
        agreementId,
      ),
      actor,
    );
  }
  private async prepare(
    terms: B2bAgreementTermsV1,
    organizationId: string,
    branchId: string,
    role: B2bCooperationRole,
    actor: AuthenticatedActor,
    pinned = false,
  ) {
    const issue = b2bAgreementTermsIssue(terms);
    if (issue)
      throw new BadRequestException({
        code: 'B2B_INVALID_TERMS',
        message: issue,
      });
    if (
      (terms.agreementType === 'AGENCY' && role !== 'AGENCY') ||
      (terms.agreementType === 'CORPORATE' && role !== 'CORPORATE_CUSTOMER')
    )
      throw new BadRequestException('نوع قرارداد با نقش همکاری سازگار نیست.');
    await this.identity(organizationId, role);
    const paymentReference = terms.paymentMethodId
      ? await this.organizations.activePaymentMethod(terms.paymentMethodId)
      : null;
    if (terms.paymentMethodId && !paymentReference)
      throw new BadRequestException(
        'روش پرداخت باید از موارد فعال اطلاعات پایه انتخاب شود.',
      );
    const validCodes = await this.organizations.activeCurrencyCodes(
      terms.currencyCodes,
    );
    if (terms.currencyCodes.some((code) => !validCodes.includes(code)))
      throw new BadRequestException(
        'ارز قرارداد باید در اطلاعات پایه فعال باشد.',
      );
    const resolve = async (
      documentId: string | null,
      expected?: string | null,
    ) => {
      if (!documentId) {
        if (expected)
          throw new BadRequestException('نسخه سند بدون سند معتبر نیست.');
        return null;
      }
      const document = await this.documents.assertDraftReference(
        documentId,
        organizationId,
        branchId,
        actor,
        !pinned,
      );
      if ((pinned || expected) && expected !== document.versionId)
        throw new ConflictException({
          code: 'B2B_DOCUMENT_VERSION_CHANGED',
          message:
            'نسخه سند تغییر کرده است؛ پیش‌نویس را با نسخه جدید بازبینی کنید.',
        });
      return document.versionId;
    };
    const documentVersionId = await resolve(
      terms.documentId,
      terms.documentVersionId,
    );
    const guarantees = [];
    for (const guarantee of terms.guarantees)
      guarantees.push({
        ...guarantee,
        documentVersionId: await resolve(
          guarantee.documentId,
          guarantee.documentVersionId,
        ),
      });
    return {
      ...terms,
      ...(terms.paymentMethodId !== undefined
        ? { paymentMethodName: paymentReference?.name ?? null }
        : {}),
      documentVersionId,
      guarantees,
    };
  }
  async save(
    organizationId: string,
    agreementId: string | undefined,
    dto: SaveB2bAgreementDto,
    actor: AuthenticatedActor,
  ) {
    permissions(
      actor,
      'b2b.agreement.manage',
      'b2b.agreement.read',
      'b2b.credit.read',
    );
    const scope = this.scope(organizationId, dto.branchId, dto.role, actor);
    const row = await this.repository.save(
      {
        ...scope,
        agreementId,
        version: dto.version,
        requestId: dto.requestId,
        actorUserId: actor.userId,
      },
      dto.terms,
      async (before) => {
        if (
          hasCredit(dto.terms) ||
          hasCredit(
            before ? agreementCaseRecord(before).revisions[0] : undefined,
          )
        )
          permissions(actor, 'b2b.credit.manage');
        return this.prepare(
          dto.terms,
          organizationId,
          dto.branchId,
          dto.role,
          actor,
        );
      },
    );
    return this.record(row, actor);
  }
  async action(
    organizationId: string,
    agreementId: string,
    dto: B2bAgreementActionDto,
    actor: AuthenticatedActor,
    action: 'SUBMIT' | 'APPROVE' | 'REJECT',
  ) {
    if (dto.reason.trim().length < 3)
      throw new BadRequestException('توضیح تصمیم باید حداقل سه نویسه باشد.');
    permissions(
      actor,
      'b2b.agreement.read',
      'b2b.credit.read',
      action === 'SUBMIT' ? 'b2b.agreement.manage' : 'b2b.agreement.approve',
    );
    const scope = this.scope(organizationId, dto.branchId, dto.role, actor);
    const row = await this.repository.transition(
      {
        ...scope,
        agreementId,
        version: dto.version,
        requestId: dto.requestId,
        actorUserId: actor.userId,
      },
      action,
      dto.reason,
      async (before) => {
        const terms = (await this.record(before, actor)).revisions[0]!;
        if (hasCredit(terms))
          permissions(
            actor,
            action === 'SUBMIT' ? 'b2b.credit.manage' : 'b2b.credit.approve',
          );
        if (action !== 'REJECT') {
          await this.prepare(
            terms,
            organizationId,
            dto.branchId,
            dto.role,
            actor,
            true,
          );
          const today = day(new Date());
          if (
            action === 'APPROVE' &&
            before.activeRevisionId &&
            terms.startsAt > today
          )
            throw new ConflictException(
              'اصلاحیه با تاریخ شروع آینده را در تاریخ شروع تأیید کنید؛ نسخه فعال قبلی تا آن زمان حفظ می‌شود.',
            );
          if (terms.endsAt && terms.endsAt < today)
            throw new ConflictException(
              'قرارداد منقضی قابل ارسال یا تأیید نیست.',
            );
          if (
            terms.guarantees.some(
              (g) =>
                g.status === 'RECEIVED' && g.expiresAt && g.expiresAt < today,
            )
          )
            throw new ConflictException('تضمین دریافت‌شده منقضی است.');
        }
      },
    );
    return this.record(row, actor);
  }
}
