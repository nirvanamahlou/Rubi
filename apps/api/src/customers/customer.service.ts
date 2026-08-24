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

import {
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
  return {
    valueHash: createHash('sha256').update(normalized, 'utf8').digest('hex'),
    maskedValue,
  };
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

@Injectable()
export class CustomerService {
  constructor(
    @Inject(CustomerRepository) private readonly repository: CustomerRepository,
  ) {}

  async list(query: CustomerListQuery, actor: AuthenticatedActor) {
    const { rows, total } = await this.repository.list(actor.branchIds, query);
    return {
      data: rows.map(toCustomerSummary),
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async detail(id: string, actor: AuthenticatedActor) {
    const row = await this.repository.find(id, actor.branchIds);
    if (!row)
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'مشتری یافت نشد.',
      });
    return {
      data: toCustomerDetail(
        row,
        actor.permissions.includes('customers.sensitive.read'),
      ),
    };
  }

  async create(
    input: CustomerMutationRequest,
    actor: AuthenticatedActor,
    requestedBranch?: string,
    traceId?: string,
  ) {
    const row = await this.repository.create(
      prepareMutation(input, false),
      actor.userId,
      branchOf(actor, requestedBranch),
      traceId,
    );
    return {
      data: toCustomerDetail(
        row,
        actor.permissions.includes('customers.sensitive.read'),
      ),
    };
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
    return {
      data: toCustomerDetail(
        row,
        actor.permissions.includes('customers.sensitive.read'),
      ),
    };
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
    return {
      data: toCustomerDetail(
        row,
        actor.permissions.includes('customers.sensitive.read'),
      ),
    };
  }

  async addContact(
    id: string,
    input: CustomerContactRequest,
    actor: AuthenticatedActor,
    requestedBranch?: string,
    traceId?: string,
  ) {
    const row = await this.repository.addContact(
      id,
      actor.branchIds,
      {
        type: input.type,
        label: input.label ?? null,
        isPrimary: input.isPrimary ?? false,
        version: input.version,
        ...normalizeContact(input.type, input.value),
      },
      actor.userId,
      branchOf(actor, requestedBranch),
      traceId,
    );
    if (!row) throw conflict();
    return {
      data: toCustomerDetail(
        row,
        actor.permissions.includes('customers.sensitive.read'),
      ),
    };
  }

  async addAddress(
    id: string,
    input: CustomerAddressRequest,
    actor: AuthenticatedActor,
    requestedBranch?: string,
    traceId?: string,
  ) {
    const row = await this.repository.addAddress(
      id,
      actor.branchIds,
      input,
      actor.userId,
      branchOf(actor, requestedBranch),
      traceId,
    );
    if (!row) throw conflict();
    return {
      data: toCustomerDetail(
        row,
        actor.permissions.includes('customers.sensitive.read'),
      ),
    };
  }

  async addConsent(
    id: string,
    input: CustomerConsentRequest,
    actor: AuthenticatedActor,
    requestedBranch?: string,
    traceId?: string,
  ) {
    const row = await this.repository.addConsent(
      id,
      actor.branchIds,
      input,
      actor.userId,
      branchOf(actor, requestedBranch),
      traceId,
    );
    if (!row) throw conflict();
    return {
      data: toCustomerDetail(
        row,
        actor.permissions.includes('customers.sensitive.read'),
      ),
    };
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
    const row = await this.repository.addCompanion(
      id,
      actor.branchIds,
      input,
      actor.userId,
      branchOf(actor, requestedBranch),
      traceId,
    );
    if (!row) throw conflict();
    return {
      data: toCustomerDetail(
        row,
        actor.permissions.includes('customers.sensitive.read'),
      ),
    };
  }

  async detectDuplicates(
    sourceCustomerId: string,
    actor: AuthenticatedActor,
    requestedBranch?: string,
    traceId?: string,
  ) {
    const inputs = await this.repository.duplicateInputs(
      sourceCustomerId,
      actor.branchIds,
    );
    if (!inputs)
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'مشتری مبدأ یافت نشد.',
      });
    const sourceName =
      `${inputs.source.firstName ?? ''}|${inputs.source.lastName ?? ''}`.toLowerCase();
    const sourceHashes = new Set(
      inputs.source.contacts.map(({ valueHash }) => valueHash),
    );
    const results: DuplicateCandidate[] = [];
    for (const candidate of inputs.candidates) {
      let score = 0;
      const reasons: string[] = [];
      if (
        candidate.contacts.some(({ valueHash }) => sourceHashes.has(valueHash))
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
        branchOf(actor, requestedBranch),
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
    const row = await this.repository.reviewDuplicate(
      id,
      actor.branchIds,
      input.status,
      input.reason.trim(),
      input.version,
      actor.userId,
      branchOf(actor, requestedBranch),
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
