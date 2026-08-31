import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  CustomerActivityEntry,
  CustomerAuditEntry,
  CustomerAddressRequest,
  CustomerCompanionRequest,
  CustomerConsentRequest,
  CustomerContactRequest,
  CustomerListQuery,
  CustomerMutationRequest,
  CustomerStatusRequest,
  DuplicateCandidate,
  DuplicateReviewRequest,
} from '@rubi/contracts';
import { CustomerKind } from '@rubi/database';

import { CustomerContactCrypto } from './customer-contact.crypto';
import {
  type CustomerAuditRow,
  type CustomerRow,
  CustomerRepository,
  toCustomerDetail,
  toCustomerSummary,
} from './customer.repository';

function branchOf(actor: AuthenticatedActor, requested?: string): string {
  const branchId = requested ?? actor.branchIds[0];
  if (!branchId || !actor.branchIds.includes(branchId))
    throw new ForbiddenException('شعبه مجاز برای این عملیات مشخص نشده است.');
  return branchId;
}

function conflict(): ConflictException {
  return new ConflictException({
    code: 'CONCURRENT_MODIFICATION',
    message: 'رکورد هم‌زمان تغییر کرده است. اطلاعات را دوباره دریافت کنید.',
  });
}

function scopedBranches(
  actor: AuthenticatedActor,
  requested: CustomerListQuery['branchId'] = 'all',
) {
  if (requested === 'all') return actor.branchIds;
  if (!actor.branchIds.includes(requested))
    throw new ForbiddenException({
      code: 'CUSTOMER_BRANCH_SCOPE_FORBIDDEN',
      message: 'شعبه انتخاب‌شده در دامنه دسترسی کاربر نیست.',
    });
  return [requested];
}

function validateDateRange(
  from: string | null,
  to: string | null,
  label: string,
) {
  if (from && to && new Date(from).getTime() > new Date(to).getTime())
    throw new BadRequestException(`ابتدای بازه ${label} پس از انتهای آن است.`);
}

const consentReasonEmail = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i;
const consentReasonLongNumber = /(?:\d[\s()-]?){10,}/;
const consentReasonSecret =
  /\b(?:bearer\s+\S+|(?:api[_-]?key|password|secret|token)\s*[:=]\s*\S+)/i;

function consentReason(value: string): string {
  const reason = value.trim();
  if (reason.length < 3 || reason.length > 500)
    throw new BadRequestException({
      code: 'CUSTOMER_CONSENT_REASON_INVALID',
      message: 'دلیل رضایت باید بین ۳ تا ۵۰۰ نویسه باشد.',
    });
  if (
    consentReasonEmail.test(reason) ||
    consentReasonLongNumber.test(reason) ||
    consentReasonSecret.test(reason)
  )
    throw new BadRequestException({
      code: 'CUSTOMER_CONSENT_REASON_SENSITIVE_DATA',
      message:
        'دلیل رضایت نباید شامل اطلاعات تماس، شناسه حساس یا اطلاعات محرمانه باشد.',
    });
  return reason;
}

export const CUSTOMER_SENSITIVE_READ_REASONS = [
  'customer-verification',
  'support-request',
  'data-correction',
] as const;

type CustomerSensitiveReadReason =
  (typeof CUSTOMER_SENSITIVE_READ_REASONS)[number];

function sensitiveReadReason(
  value: string | undefined,
): CustomerSensitiveReadReason | null {
  if (!value?.trim()) return null;
  if (
    !CUSTOMER_SENSITIVE_READ_REASONS.includes(
      value as CustomerSensitiveReadReason,
    )
  )
    throw new BadRequestException({
      code: 'CUSTOMER_SENSITIVE_READ_REASON_INVALID',
      message: 'دلیل مجاز برای مشاهده اطلاعات حساس مشخص نشده است.',
    });
  return value as CustomerSensitiveReadReason;
}

function prismaCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : undefined;
}

function prepareMutation(input: CustomerMutationRequest, update: boolean) {
  const roles = new Set(input.roles);
  if (!roles.size)
    throw new BadRequestException('حداقل نقش مشتری یا مسافر لازم است.');
  if (
    input.kind === 'person' &&
    (!input.firstName?.trim() || !input.lastName?.trim())
  )
    throw new BadRequestException('نام و نام خانوادگی شخص الزامی است.');
  if (input.kind === 'organization' && !input.organizationId)
    throw new BadRequestException(
      'مرجع Organization برای مشتری سازمانی الزامی است.',
    );
  if (input.birthDate) {
    const date = new Date(`${input.birthDate}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date > new Date())
      throw new BadRequestException('تاریخ تولد معتبر نیست.');
  }
  const data: Record<string, unknown> = {
    kind:
      input.kind === 'person' ? CustomerKind.PERSON : CustomerKind.ORGANIZATION,
    organizationId: input.kind === 'organization' ? input.organizationId : null,
    firstName: input.kind === 'person' ? input.firstName?.trim() : null,
    lastName: input.kind === 'person' ? input.lastName?.trim() : null,
    displayName: input.displayName.trim(),
    birthDate: input.birthDate
      ? new Date(`${input.birthDate}T00:00:00.000Z`)
      : null,
    isCustomer: roles.has('customer'),
    isPassenger: roles.has('passenger'),
    acquaintanceMethodId: input.acquaintanceMethodId ?? null,
  };
  if (update) delete data.kind;
  return data;
}

function normalizeContact(type: 'phone' | 'email', value: string) {
  const normalized =
    type === 'email'
      ? value.trim().toLowerCase()
      : `${value.startsWith('+') ? '+' : ''}${value.replace(/\D/g, '')}`;
  if (type === 'email' && !/^\S+@\S+\.\S+$/.test(normalized))
    throw new BadRequestException('ایمیل معتبر نیست.');
  if (type === 'phone' && !/^\+?[0-9]{10,15}$/.test(normalized))
    throw new BadRequestException('شماره تماس باید ۱۰ تا ۱۵ رقم باشد.');
  const maskedValue =
    type === 'email'
      ? normalized.replace(/^(.{1,2}).*(@.*)$/, '$1•••$2')
      : normalized.length < 7
        ? '••••'
        : `${normalized.slice(0, 4)}•••${normalized.slice(-3)}`;
  return { normalized, maskedValue };
}

function duplicateDto(row: {
  id: string;
  sourceCustomerId: string;
  candidateCustomerId: string;
  score: number;
  reasons: string[];
  reviewStatus: string;
  reviewReason: string | null;
  version: number;
  reviewedAt: Date | null;
  createdAt: Date;
  candidateCustomer: { displayName: string };
}): DuplicateCandidate {
  return {
    id: row.id,
    sourceCustomerId: row.sourceCustomerId,
    candidateCustomerId: row.candidateCustomerId,
    candidateDisplayName: row.candidateCustomer.displayName,
    score: row.score,
    reasons: row.reasons,
    reviewStatus: row.reviewStatus
      .toLowerCase()
      .replaceAll('_', '-') as DuplicateCandidate['reviewStatus'],
    reviewReason: row.reviewReason,
    version: row.version,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const activityPresentation: Record<
  string,
  Pick<CustomerActivityEntry, 'type' | 'title' | 'description'>
> = {
  'customers.create': {
    type: 'created',
    title: 'ایجاد مشتری',
    description: 'پرونده مشتری ایجاد شد.',
  },
  'customers.update': {
    type: 'updated',
    title: 'ویرایش مشتری',
    description: 'اطلاعات اصلی مشتری ویرایش شد.',
  },
  'customers.contact.create': {
    type: 'contact',
    title: 'ثبت راه تماس',
    description: 'یک راه تماس محافظت‌شده ثبت شد.',
  },
  'customers.address.create': {
    type: 'address',
    title: 'ثبت نشانی',
    description: 'یک نشانی مشتری ثبت شد.',
  },
  'customers.companion.create': {
    type: 'companion',
    title: 'ثبت همراه',
    description: 'یک رابطه همراه یا خانواده ثبت شد.',
  },
  'customers.consent.create': {
    type: 'consent',
    title: 'تغییر رضایت',
    description: 'وضعیت رضایت مشتری ثبت شد.',
  },
  'customers.status': {
    type: 'status',
    title: 'تغییر وضعیت',
    description: 'وضعیت مشتری با دلیل مجاز تغییر کرد.',
  },
  'customers.duplicate.detected': {
    type: 'duplicate-review',
    title: 'شناسایی مورد مشابه',
    description: 'یک کاندید تکراری برای بررسی دستی ثبت شد.',
  },
  'customers.duplicate.review': {
    type: 'duplicate-review',
    title: 'بررسی مورد مشابه',
    description: 'نتیجه بررسی دستی رکورد مشابه ثبت شد.',
  },
  'customers.sensitive.read': {
    type: 'sensitive-view',
    title: 'مشاهده اطلاعات حساس',
    description: 'نمایش کنترل‌شده و Audit‌شده انجام شد.',
  },
};

function auditDto(row: CustomerAuditRow): CustomerAuditEntry {
  return {
    id: row.id,
    action: row.action,
    outcome: row.outcome.toLowerCase() as CustomerAuditEntry['outcome'],
    reason: row.reason,
    actor: {
      userId: row.actorUserId,
      displayName: row.actor.displayName,
    },
    actorBranchId: row.actorBranchId,
    traceId: row.traceId,
    occurredAt: row.occurredAt.toISOString(),
  };
}

@Injectable()
export class CustomerService {
  constructor(
    @Inject(CustomerRepository) private readonly repository: CustomerRepository,
    @Inject(CustomerContactCrypto)
    private readonly contactCrypto: CustomerContactCrypto,
  ) {}

  private async present(
    row: CustomerRow,
    actor: AuthenticatedActor,
    traceId?: string,
    requestedReason?: string,
  ) {
    const reason = sensitiveReadReason(requestedReason);
    if (!reason) return toCustomerDetail(row, false);
    if (!actor.permissions.includes('customers.sensitive.read'))
      throw new ForbiddenException({
        code: 'CUSTOMER_SENSITIVE_READ_FORBIDDEN',
        message: 'مجوز مشاهده اطلاعات حساس مشتری وجود ندارد.',
      });
    const detail = toCustomerDetail(row, true);
    let contacts;
    try {
      contacts = detail.contacts.map((contact, index) => ({
        ...contact,
        value: this.contactCrypto.decrypt(
          row.contacts?.[index] ?? {
            type: contact.type.toUpperCase() as 'PHONE' | 'EMAIL',
            encryptedValue: null,
            encryptionIv: null,
            encryptionAuthTag: null,
            encryptionKeyVersion: null,
          },
        ),
      }));
    } catch {
      throw new UnprocessableEntityException({
        code: 'CUSTOMER_CONTACT_DECRYPTION_FAILED',
        message: 'نمایش اطلاعات تماس حساس ممکن نشد.',
      });
    }
    await this.repository.auditSensitiveRead(
      row.id,
      actor.userId,
      row.ownerBranchId,
      reason,
      traceId,
    );
    return { ...detail, contacts };
  }

  async list(query: CustomerListQuery, actor: AuthenticatedActor) {
    validateDateRange(
      query.createdFrom ?? null,
      query.createdTo ?? null,
      'تاریخ ایجاد',
    );
    validateDateRange(
      query.updatedFrom ?? null,
      query.updatedTo ?? null,
      'آخرین ویرایش',
    );
    const branchIds = scopedBranches(actor, query.branchId ?? 'all');
    const { rows, total, metrics } = await this.repository.list(
      branchIds,
      query,
    );
    return {
      data: rows.map(toCustomerSummary),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        allowedBranchIds: actor.branchIds,
        metrics: {
          ...metrics,
          returningCustomerRate: null,
          returningCustomerRateStatus: 'awaiting-sales-public-contract',
        },
      },
    };
  }

  async statusHistory(id: string, actor: AuthenticatedActor) {
    const rows = await this.repository.statusHistory(id, actor.branchIds);
    if (!rows)
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'مشتری یافت نشد.',
      });
    return {
      data: rows.map((row) => ({
        id: row.id,
        fromStatus: row.fromStatus.toLowerCase() as
          'active' | 'inactive' | 'none',
        toStatus: row.toStatus.toLowerCase() as 'active' | 'inactive',
        reason: row.reason,
        actor: {
          userId: row.changedByUserId,
          displayName: row.changedBy.displayName,
        },
        actorBranchId: row.actorBranchId,
        occurredAt: row.changedAt.toISOString(),
      })),
    };
  }

  async activity(id: string, actor: AuthenticatedActor) {
    const rows = await this.repository.audit(id, actor.branchIds);
    if (!rows)
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'مشتری یافت نشد.',
      });
    return {
      data: rows.flatMap((row) => {
        const presentation = activityPresentation[row.action];
        if (!presentation) return [];
        return [
          {
            id: row.id,
            ...presentation,
            actor: {
              userId: row.actorUserId,
              displayName: row.actor.displayName,
            },
            actorBranchId: row.actorBranchId,
            occurredAt: row.occurredAt.toISOString(),
          },
        ];
      }),
    };
  }

  async audit(id: string, actor: AuthenticatedActor) {
    const rows = await this.repository.audit(id, actor.branchIds);
    if (!rows)
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'مشتری یافت نشد.',
      });
    return { data: rows.map(auditDto) };
  }

  async detail(
    id: string,
    actor: AuthenticatedActor,
    traceId?: string,
    requestedSensitiveReadReason?: string,
  ) {
    const row = await this.repository.find(id, actor.branchIds);
    if (!row)
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'مشتری یافت نشد.',
      });
    return {
      data: await this.present(
        row,
        actor,
        traceId,
        requestedSensitiveReadReason,
      ),
    };
  }

  async maskedDetail(id: string, actor: AuthenticatedActor) {
    const row = await this.repository.find(id, actor.branchIds);
    if (!row)
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'مشتری یافت نشد.',
      });
    return { data: toCustomerDetail(row, false) };
  }
  async create(
    input: CustomerMutationRequest,
    actor: AuthenticatedActor,
    requestedBranch?: string,
    traceId?: string,
  ) {
    let row;
    try {
      row = await this.repository.create(
        prepareMutation(input, false),
        actor.userId,
        branchOf(actor, requestedBranch),
        traceId,
      );
    } catch (error) {
      if (prismaCode(error) === 'P2003')
        throw new BadRequestException({
          code: 'INVALID_MASTER_DATA_REFERENCE',
          message: 'مرجع اطلاعات پایه معتبر نیست.',
        });
      throw error;
    }
    return { data: await this.present(row, actor, traceId) };
  }

  async update(
    id: string,
    input: CustomerMutationRequest,
    actor: AuthenticatedActor,
    requestedBranch?: string,
    traceId?: string,
  ) {
    if (!input.version)
      throw new BadRequestException('version برای ویرایش الزامی است.');
    const row = await this.repository.update(
      id,
      actor.branchIds,
      prepareMutation(input, true),
      input.version,
      actor.userId,
      branchOf(actor, requestedBranch),
      traceId,
    );
    if (!row) throw conflict();
    return { data: await this.present(row, actor, traceId) };
  }

  async status(
    id: string,
    input: CustomerStatusRequest,
    actor: AuthenticatedActor,
    requestedBranch?: string,
    traceId?: string,
  ) {
    const row = await this.repository.setStatus(
      id,
      actor.branchIds,
      input.status === 'active',
      input.version,
      input.reason.trim(),
      actor.userId,
      branchOf(actor, requestedBranch),
      traceId,
    );
    if (!row) throw conflict();
    return { data: await this.present(row, actor, traceId) };
  }

  async addContact(
    id: string,
    input: CustomerContactRequest,
    actor: AuthenticatedActor,
    requestedBranch?: string,
    traceId?: string,
  ) {
    const normalizedContact = normalizeContact(input.type, input.value);
    let row;
    try {
      row = await this.repository.addContact(
        id,
        actor.branchIds,
        {
          type: input.type,
          label: input.label ?? null,
          isPrimary: input.isPrimary ?? false,
          version: input.version,
          ...this.contactCrypto.protect(
            input.type,
            normalizedContact.normalized,
            normalizedContact.maskedValue,
          ),
        },
        actor.userId,
        branchOf(actor, requestedBranch),
        traceId,
      );
    } catch (error) {
      if (prismaCode(error) === 'P2002')
        throw new ConflictException({
          code: 'CUSTOMER_CONTACT_DUPLICATE',
          message: 'این اطلاعات تماس قبلاً برای مشتری ثبت شده است.',
        });
      throw error;
    }
    if (!row) throw conflict();
    return { data: await this.present(row, actor, traceId) };
  }

  async addAddress(
    id: string,
    input: CustomerAddressRequest,
    actor: AuthenticatedActor,
    requestedBranch?: string,
    traceId?: string,
  ) {
    let row;
    try {
      row = await this.repository.addAddress(
        id,
        actor.branchIds,
        input,
        actor.userId,
        branchOf(actor, requestedBranch),
        traceId,
      );
    } catch (error) {
      if (prismaCode(error) === 'P2003')
        throw new BadRequestException({
          code: 'INVALID_MASTER_DATA_REFERENCE',
          message: 'شهر انتخاب‌شده معتبر نیست.',
        });
      throw error;
    }
    if (!row) throw conflict();
    return { data: await this.present(row, actor, traceId) };
  }

  async addConsent(
    id: string,
    input: CustomerConsentRequest,
    actor: AuthenticatedActor,
    requestedBranch?: string,
    traceId?: string,
  ) {
    const normalizedInput = {
      ...input,
      source: input.source.trim(),
      reason: consentReason(input.reason),
    };
    const row = await this.repository.addConsent(
      id,
      actor.branchIds,
      normalizedInput,
      actor.userId,
      branchOf(actor, requestedBranch),
      traceId,
    );
    if (!row) throw conflict();
    return { data: await this.present(row, actor, traceId) };
  }

  async addCompanion(
    id: string,
    input: CustomerCompanionRequest,
    actor: AuthenticatedActor,
    requestedBranch?: string,
    traceId?: string,
  ) {
    if (id === input.relatedCustomerId)
      throw new BadRequestException({
        code: 'CUSTOMER_SELF_RELATION',
        message: 'مشتری نمی‌تواند همراه خودش باشد.',
      });
    const related = await this.repository.find(
      input.relatedCustomerId,
      actor.branchIds,
    );
    if (!related)
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'همراه در دامنه شعب مجاز یافت نشد.',
      });
    let row;
    try {
      row = await this.repository.addCompanion(
        id,
        actor.branchIds,
        input,
        actor.userId,
        branchOf(actor, requestedBranch),
        traceId,
      );
    } catch (error) {
      if (prismaCode(error) === 'P2002')
        throw new ConflictException({
          code: 'CUSTOMER_RELATION_EXISTS',
          message: 'این رابطه همراه قبلاً ثبت شده است.',
        });
      throw error;
    }
    if (!row) throw conflict();
    return { data: await this.present(row, actor, traceId) };
  }

  async detectDuplicates(
    sourceCustomerId: string,
    actor: AuthenticatedActor,
    requestedBranch?: string,
    traceId?: string,
  ) {
    const branchId = branchOf(actor, requestedBranch);
    const inputs = await this.repository.duplicateInputs(sourceCustomerId, [
      branchId,
    ]);
    if (!inputs)
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'مشتری مبدأ یافت نشد.',
      });
    const sourceName =
      `${inputs.source.firstName ?? ''}|${inputs.source.lastName ?? ''}`.toLowerCase();
    const sourceHashes = new Set(
      inputs.source.contacts.map(({ valueFingerprint }) => valueFingerprint),
    );
    const results: DuplicateCandidate[] = [];
    for (const candidate of inputs.candidates) {
      let score = 0;
      const reasons: string[] = [];
      if (
        candidate.contacts.some(
          ({ valueFingerprint }) =>
            Boolean(valueFingerprint) && sourceHashes.has(valueFingerprint),
        )
      ) {
        score += 60;
        reasons.push('تماس یکسان');
      }
      if (
        sourceName !== '|' &&
        sourceName ===
          `${candidate.firstName ?? ''}|${candidate.lastName ?? ''}`.toLowerCase()
      ) {
        score += 25;
        reasons.push('نام و نام خانوادگی یکسان');
      }
      if (
        inputs.source.birthDate &&
        candidate.birthDate &&
        inputs.source.birthDate.getTime() === candidate.birthDate.getTime()
      ) {
        score += 15;
        reasons.push('تاریخ تولد یکسان');
      }
      if (score < 50) continue;
      const saved = await this.repository.saveDuplicateCandidate(
        { sourceCustomerId, candidateCustomerId: candidate.id, score, reasons },
        actor.userId,
        branchId,
        traceId,
      );
      results.push(duplicateDto(saved));
    }
    return { data: results, meta: { autoMergePerformed: false } };
  }

  async reviewDuplicate(
    id: string,
    input: DuplicateReviewRequest,
    actor: AuthenticatedActor,
    requestedBranch?: string,
    traceId?: string,
  ) {
    const branchId = branchOf(actor, requestedBranch);
    const row = await this.repository.reviewDuplicate(
      id,
      [branchId],
      input.status,
      input.reason.trim(),
      input.version,
      actor.userId,
      branchId,
      traceId,
    );
    if (!row) throw conflict();
    return {
      data: duplicateDto(row),
      mergeProposal:
        input.status === 'merge-proposed'
          ? {
              duplicateCandidateId: row.id,
              sourceCustomerId: row.sourceCustomerId,
              targetCustomerId: row.candidateCustomerId,
              reason: input.reason,
              status: 'proposed' as const,
            }
          : null,
      mergeResult:
        input.status === 'merge-proposed'
          ? {
              status: 'blocked-by-open-decision' as const,
              code: 'MERGE_BLOCKED_BY_OPEN_DECISION' as const,
              mergedCustomerId: null,
            }
          : null,
    };
  }
}
