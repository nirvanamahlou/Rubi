import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  B2bAgencyAgreedRateV1,
  B2bAgencyAgreementV1,
  B2bAgencyCreditPolicyV1,
  B2bAgencyProfileV1,
  B2bAgencyWorkspaceV1,
  B2bAgencyProfileDetailsV1,
  FinancePartyExposurePortV1,
  IamPermissionCode,
} from '@rubi/contracts';
import { Prisma } from '@rubi/database';

import { MasterOrganizationDirectory } from '../master-data/master-organization-directory';
import type {
  CreateAgencyAgreedRateDto,
  CreateAgencyAgreementDto,
  UpsertAgencyCreditPolicyDto,
  UpsertAgencyProfileDto,
  UpdateAgencyAgreedRateDto,
  DeleteB2bRecordDto,
} from './b2b.dto';
import { IamService } from '../iam/iam.service';
import { B2bRepository } from './b2b.repository';
import { B2bAgreementDocuments } from './b2b-agreement-documents';
import { FINANCE_PARTY_EXPOSURE_PORT } from './finance-exposure.port';

function branchOf(actor: AuthenticatedActor, requested?: string): string {
  const branchId = requested ?? actor.branchIds[0];
  if (!branchId || !actor.branchIds.includes(branchId))
    throw new ForbiddenException('شعبه انتخاب‌شده در دامنه دسترسی کاربر نیست.');
  return branchId;
}

function date(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException({
      code: 'B2B_INVALID_DATE',
      message: 'تاریخ معتبر نیست.',
    });
  return parsed;
}

function optionalDate(value?: string | null): Date | null {
  return value ? date(value) : null;
}

function assertDateRange(from: string, to?: string | null) {
  const start = date(from);
  if (to && date(to).getTime() < start.getTime())
    throw new BadRequestException({
      code: 'B2B_INVALID_DATE_RANGE',
      message: 'پایان بازه نمی‌تواند قبل از شروع آن باشد.',
    });
}

function requirePermissions(
  actor: AuthenticatedActor,
  ...permissions: IamPermissionCode[]
) {
  if (permissions.some((permission) => !actor.permissions.includes(permission)))
    throw new ForbiddenException({
      code: 'B2B_PERMISSION_DENIED',
      message: 'مجوز این عملیات را ندارید.',
    });
}

function day(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function profileRecord(row: {
  id: string;
  organizationId: string;
  branchId: string;
  accountManagerUserId: string | null;
  status: B2bAgencyProfileV1['status'];
  displayOrder: number;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): B2bAgencyProfileV1 {
  return {
    id: row.id,
    organizationId: row.organizationId,
    branchId: row.branchId,
    accountManagerUserId: row.accountManagerUserId,
    status: row.status,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function agreementRecord(row: {
  id: string;
  profileId: string;
  code: string;
  title: string;
  documentReference: string | null;
  startsAt: Date;
  endsAt: Date | null;
  status: B2bAgencyAgreementV1['status'];
  notes: string | null;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): B2bAgencyAgreementV1 {
  return {
    ...row,
    startsAt: day(row.startsAt),
    endsAt: row.endsAt ? day(row.endsAt) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function creditRecord(row: {
  id: string;
  profileId: string;
  creditLimit: Prisma.Decimal;
  currencyCode: string;
  effectiveFrom: Date;
  expiresAt: Date | null;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): B2bAgencyCreditPolicyV1 {
  return {
    ...row,
    creditLimit: row.creditLimit.toString(),
    effectiveFrom: day(row.effectiveFrom),
    expiresAt: row.expiresAt ? day(row.expiresAt) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rateRecord(row: {
  id: string;
  profileId: string;
  code: string;
  serviceReference: string;
  title: string;
  kind: B2bAgencyAgreedRateV1['kind'];
  value: Prisma.Decimal;
  currencyCode: string | null;
  validFrom: Date;
  validTo: Date | null;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): B2bAgencyAgreedRateV1 {
  return {
    ...row,
    value: row.value.toString(),
    validFrom: day(row.validFrom),
    validTo: row.validTo ? day(row.validTo) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function code(prefix: 'AGR' | 'RATE') {
  return `${prefix}-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}

@Injectable()
export class B2bService {
  constructor(
    @Inject(B2bRepository) private readonly repository: B2bRepository,
    @Inject(MasterOrganizationDirectory)
    private readonly organizations: MasterOrganizationDirectory,
    @Inject(FINANCE_PARTY_EXPOSURE_PORT)
    private readonly financeExposure: FinancePartyExposurePortV1,
    @Inject(B2bAgreementDocuments)
    private readonly agreementDocuments: B2bAgreementDocuments,
    @Inject(IamService) private readonly iam: IamService,
  ) {}

  async profileDetails(
    organizationId: string,
    actor: AuthenticatedActor,
    requestedBranch?: string,
  ): Promise<{ data: B2bAgencyProfileDetailsV1 }> {
    requirePermissions(actor, 'b2b.agency.read');
    const branchId = branchOf(actor, requestedBranch);
    await this.agency(organizationId);
    const profile = await this.repository.findProfile(organizationId, branchId);
    return {
      data: {
        profile: profile ? profileRecord(profile) : null,
        accountManagers: await this.accountManagers(branchId),
      },
    };
  }

  private async accountManagers(branchId: string) {
    const users = await this.iam.listUsers();
    return users
      .filter(
        (user) =>
          user.status === 'ACTIVE' &&
          user.branches.some(({ branch }) => branch.id === branchId),
      )
      .map(({ id, displayName }) => ({ id, displayName }));
  }

  async rates(
    organizationId: string,
    actor: AuthenticatedActor,
    requestedBranch?: string,
  ) {
    requirePermissions(actor, 'b2b.rate.read');
    const branchId = branchOf(actor, requestedBranch);
    await this.agency(organizationId);
    return {
      data: (await this.repository.listRates(organizationId, branchId)).map(
        rateRecord,
      ),
    };
  }

  async agencyWorkspace(
    organizationId: string,
    actor: AuthenticatedActor,
    requestedBranch?: string,
  ): Promise<{ data: B2bAgencyWorkspaceV1 }> {
    requirePermissions(
      actor,
      'b2b.agency.read',
      'b2b.agreement.read',
      'b2b.credit.read',
      'b2b.rate.read',
    );
    const branchId = branchOf(actor, requestedBranch);
    const organization = await this.agency(organizationId);
    const [primaryAddress, row] = await Promise.all([
      this.organizations.primaryAddress(organizationId),
      this.repository.findProfile(organizationId, branchId),
    ]);
    const creditPolicy = row?.creditPolicies?.[0]
      ? creditRecord(row.creditPolicies[0])
      : null;
    const financeExposure = creditPolicy
      ? await this.financeExposure.getPartyExposure({
          organizationId,
          branchId,
          currencyCode: creditPolicy.currencyCode,
        })
      : {
          status: 'UNAVAILABLE' as const,
          reason: 'NO_EXPOSURE_SNAPSHOT' as const,
        };
    return {
      data: {
        organization,
        primaryAddress,
        profile: row ? profileRecord(row) : null,
        agreements: row?.agreements.map(agreementRecord) ?? [],
        creditPolicy,
        agreedRates: row?.agreedRates.map(rateRecord) ?? [],
        financeExposure,
      },
    };
  }

  async upsertProfile(
    organizationId: string,
    dto: UpsertAgencyProfileDto,
    actor: AuthenticatedActor,
  ) {
    requirePermissions(actor, 'b2b.agency.manage');
    branchOf(actor, dto.branchId);
    const organization = await this.agency(organizationId);
    if (!organization.isActive)
      throw new ConflictException({
        code: 'B2B_ORGANIZATION_INACTIVE',
        message: 'برای سازمان غیرفعال نمی‌توان پروفایل ثبت یا ویرایش کرد.',
      });
    const branchId = branchOf(actor, dto.branchId);
    if (
      dto.accountManagerUserId &&
      !(await this.accountManagers(branchId)).some(
        ({ id }) => id === dto.accountManagerUserId,
      )
    )
      throw new BadRequestException(
        'مدیر حساب باید کاربر فعال و عضو همین شعبه باشد.',
      );
    const row = await this.repository.upsertProfile({
      organizationId,
      branchId,
      ...(dto.accountManagerUserId !== undefined
        ? { accountManagerUserId: dto.accountManagerUserId }
        : {}),
      status: dto.status,
      displayOrder: dto.displayOrder,
      ...(dto.version ? { expectedVersion: dto.version } : {}),
      actorUserId: actor.userId,
    });
    return { data: profileRecord(row) };
  }

  async createAgreement(
    organizationId: string,
    dto: CreateAgencyAgreementDto,
    actor: AuthenticatedActor,
  ) {
    requirePermissions(actor, 'b2b.agreement.manage');
    branchOf(actor, dto.branchId);
    assertDateRange(dto.startsAt, dto.endsAt);
    if (dto.status !== 'DRAFT')
      throw new ConflictException({
        code: 'B2B_AGREEMENT_APPROVAL_REQUIRED',
        message:
          'توافق‌نامه جدید باید پیش‌نویس باشد؛ فعال‌سازی به گردش تأیید نیاز دارد.',
      });
    const profile = await this.profile(
      organizationId,
      dto.branchId,
      actor,
      true,
    );
    if (dto.documentReference)
      await this.agreementDocuments.assertDraftReference(
        dto.documentReference,
        organizationId,
        profile.branchId,
        actor,
      );
    const row = await this.repository.createAgreement({
      profileId: profile.id,
      branchId: profile.branchId,
      code: code('AGR'),
      title: dto.title.trim(),
      documentReference: dto.documentReference ?? null,
      startsAt: date(dto.startsAt),
      endsAt: optionalDate(dto.endsAt),
      status: dto.status,
      notes: dto.notes?.trim() || null,
      actorUserId: actor.userId,
    });
    return { data: agreementRecord(row) };
  }

  async upsertCreditPolicy(
    organizationId: string,
    dto: UpsertAgencyCreditPolicyDto,
    actor: AuthenticatedActor,
  ) {
    requirePermissions(actor, 'b2b.credit.manage');
    branchOf(actor, dto.branchId);
    assertDateRange(dto.effectiveFrom, dto.expiresAt);
    await this.profile(organizationId, dto.branchId, actor);
    throw new ConflictException({
      code: 'B2B_CREDIT_APPROVAL_REQUIRED',
      message:
        'تغییر سقف اعتبار به ثبت درخواست و تأیید شخص دیگری نیاز دارد. گردش تأیید هنوز متصل نیست.',
    });
  }

  async createRate(
    organizationId: string,
    dto: CreateAgencyAgreedRateDto,
    actor: AuthenticatedActor,
  ) {
    requirePermissions(actor, 'b2b.rate.manage');
    branchOf(actor, dto.branchId);
    assertDateRange(dto.validFrom, dto.validTo);
    const value = new Prisma.Decimal(dto.value);
    if (dto.kind === 'FIXED_AMOUNT' && !dto.currencyCode)
      throw new BadRequestException('ارز برای نرخ مبلغ ثابت الزامی است.');
    if (dto.kind !== 'FIXED_AMOUNT' && dto.currencyCode)
      throw new BadRequestException('نرخ درصدی نباید ارز داشته باشد.');
    if (dto.kind !== 'FIXED_AMOUNT' && value.greaterThan(100))
      throw new BadRequestException(
        'درصد نرخ توافقی نمی‌تواند بیشتر از ۱۰۰ باشد.',
      );
    const profile = await this.profile(
      organizationId,
      dto.branchId,
      actor,
      true,
    );
    if ((dto.isActive ?? true) && profile.status !== 'ACTIVE')
      throw new ConflictException(
        'تا تأیید پروفایل، شرایط تجاری فقط به‌صورت پیش‌نویس قابل ثبت است.',
      );
    if (
      dto.currencyCode &&
      !(
        await this.organizations.activeCurrencyCodes([dto.currencyCode])
      ).includes(dto.currencyCode)
    )
      throw new BadRequestException('ارز انتخاب‌شده فعال نیست.');
    const row = await this.repository.createRate({
      profileId: profile.id,
      branchId: profile.branchId,
      code: code('RATE'),
      serviceReference: dto.serviceReference.trim(),
      title: dto.title.trim(),
      kind: dto.kind,
      value,
      currencyCode: dto.currencyCode ?? null,
      validFrom: date(dto.validFrom),
      validTo: optionalDate(dto.validTo),
      isActive: dto.isActive ?? true,
      actorUserId: actor.userId,
    });
    return { data: rateRecord(row) };
  }

  async updateRate(
    organizationId: string,
    rateId: string,
    dto: UpdateAgencyAgreedRateDto,
    actor: AuthenticatedActor,
  ) {
    requirePermissions(actor, 'b2b.rate.manage');
    const profile = await this.profile(
      organizationId,
      dto.branchId,
      actor,
      true,
    );
    assertDateRange(dto.validFrom, dto.validTo);
    const value = new Prisma.Decimal(dto.value);
    if (
      (dto.kind === 'FIXED_AMOUNT' && !dto.currencyCode) ||
      (dto.kind !== 'FIXED_AMOUNT' &&
        (dto.currencyCode || value.greaterThan(100)))
    )
      throw new BadRequestException('ارز یا درصد شرایط تجاری معتبر نیست.');
    if ((dto.isActive ?? true) && profile.status !== 'ACTIVE')
      throw new ConflictException(
        'تا تأیید پروفایل، شرایط تجاری فقط به‌صورت پیش‌نویس قابل ثبت است.',
      );
    if (
      dto.currencyCode &&
      !(
        await this.organizations.activeCurrencyCodes([dto.currencyCode])
      ).includes(dto.currencyCode)
    )
      throw new BadRequestException('ارز انتخاب‌شده فعال نیست.');
    const row = await this.repository.updateRate({
      id: rateId,
      profileId: profile.id,
      branchId: profile.branchId,
      expectedVersion: dto.version,
      serviceReference: dto.serviceReference.trim(),
      title: dto.title.trim(),
      kind: dto.kind,
      value,
      currencyCode: dto.currencyCode ?? null,
      validFrom: date(dto.validFrom),
      validTo: optionalDate(dto.validTo),
      isActive: dto.isActive ?? true,
      actorUserId: actor.userId,
    });
    return { data: rateRecord(row) };
  }

  async deleteRate(
    organizationId: string,
    rateId: string,
    dto: DeleteB2bRecordDto,
    actor: AuthenticatedActor,
  ) {
    requirePermissions(actor, 'b2b.rate.manage');
    const branchId = branchOf(actor, dto.branchId);
    await this.agency(organizationId);
    await this.repository.deleteRate({
      organizationId,
      branchId,
      id: rateId,
      expectedVersion: dto.version,
      actorUserId: actor.userId,
      reason: dto.reason,
    });
    return { data: { id: rateId, deleted: true } };
  }

  private async agency(organizationId: string) {
    const organization =
      await this.organizations.agencyReference(organizationId);
    if (!organization)
      throw new NotFoundException('سازمان دارای نقش آژانس یافت نشد.');
    return organization;
  }

  private async profile(
    organizationId: string,
    requestedBranch: string,
    actor: AuthenticatedActor,
    allowUnderReview = false,
  ) {
    const branchId = branchOf(actor, requestedBranch);
    const organization = await this.agency(organizationId);
    if (!organization.isActive)
      throw new ConflictException({
        code: 'B2B_ORGANIZATION_INACTIVE',
        message: 'سازمان غیرفعال است.',
      });
    const profile = await this.repository.findProfile(organizationId, branchId);
    if (!profile)
      throw new NotFoundException('ابتدا پروفایل عملیاتی آژانس را ثبت کنید.');
    if (
      !profile.isActive ||
      (profile.status !== 'ACTIVE' &&
        !(allowUnderReview && profile.status === 'UNDER_REVIEW'))
    )
      throw new ConflictException({
        code: 'B2B_PROFILE_INACTIVE',
        message: 'پروفایل عملیاتی شعبه فعال نیست.',
      });
    return profile;
  }
}
