import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  normalizeIranianMobile,
  type AuthenticatedActor,
} from '@nora/contracts';
import { MasterDataService } from '../master-data/master-data.service';
import { B2bOrganizationUserRepository } from './b2b-organization-user.repository';
import {
  B2B_PHONE_DELIVERY_PORT,
  type B2bPhoneDeliveryPort,
} from './b2b-phone-verification.delivery';
import type {
  CreateB2bPhoneChallengeDto,
  CreateVerifiedB2bContactDto,
  VerifyB2bPhoneChallengeDto,
} from './b2b-phone-verification.dto';
import {
  B2bPhoneVerificationStore,
  type PhoneVerificationBinding,
} from './b2b-phone-verification.store';

@Injectable()
export class B2bPhoneVerificationService {
  constructor(
    @Inject(B2bPhoneVerificationStore)
    private readonly store: B2bPhoneVerificationStore,
    @Inject(B2bOrganizationUserRepository)
    private readonly organizationUsers: B2bOrganizationUserRepository,
    @Inject(MasterDataService) private readonly masterData: MasterDataService,
    @Inject(B2B_PHONE_DELIVERY_PORT)
    private readonly delivery: B2bPhoneDeliveryPort,
  ) {}

  async challenge(dto: CreateB2bPhoneChallengeDto, actor: AuthenticatedActor) {
    await this.assertActor(actor, dto.branchId);
    const binding = this.binding(dto, actor);
    if (binding.organizationId)
      await this.assertActiveOrganization(binding.organizationId);
    const issued = this.store.issue(binding);
    await this.delivery.send({
      canonicalPhone: binding.canonicalPhone,
      code: issued.code,
    });
    return {
      challengeId: issued.challengeId,
      canonicalPhone: binding.canonicalPhone,
      expiresAt: new Date(issued.expiresAt).toISOString(),
      resendAfter: new Date(issued.resendAfter).toISOString(),
      developmentCode: issued.code,
    };
  }

  async verify(
    challengeId: string,
    dto: VerifyB2bPhoneChallengeDto,
    actor: AuthenticatedActor,
  ) {
    await this.assertActor(actor, dto.branchId);
    const binding = this.binding(dto, actor);
    if (binding.organizationId)
      await this.assertActiveOrganization(binding.organizationId);
    const result = this.store.verify(challengeId, dto.code, binding);
    return {
      grant: result.grant,
      canonicalPhone: binding.canonicalPhone,
      expiresAt: new Date(result.expiresAt).toISOString(),
    };
  }

  async createVerifiedContact(
    dto: CreateVerifiedB2bContactDto,
    actor: AuthenticatedActor,
  ) {
    await this.assertActor(actor, dto.branchId);
    const binding = this.binding(dto, actor, null);
    const inspected = this.store.inspectGrant(dto.grant, binding);
    const organization = await this.assertActiveOrganization(
      dto.organizationId,
    );
    if (
      inspected.organizationId &&
      inspected.organizationId !== dto.organizationId
    )
      throw new UnauthorizedException(
        'مجوز تأیید برای این سازمان صادر نشده است.',
      );
    const roles = String(organization.attributes.roleCodes ?? '')
      .split(',')
      .filter(Boolean);
    if (!roles.includes(dto.role))
      throw new ForbiddenException('نقش همکاری سازمان هنوز ثبت نشده است.');
    if (
      inspected.organizationId === null &&
      Date.parse(organization.createdAt) < inspected.issuedAt
    )
      throw new UnauthorizedException(
        'مجوز ثبت جدید را نمی‌توان برای پرونده سازمانی قدیمی استفاده کرد.',
      );

    // This synchronous claim is intentionally the last operation before persistence.
    this.store.consume(dto.grant, binding, dto.organizationId);
    try {
      return await this.masterData.create(
        'organization-contacts',
        {
          organizationId: dto.organizationId,
          fullName: dto.fullName,
          jobTitle: dto.jobTitle ?? '',
          phone: inspected.canonicalPhone,
          email: dto.email ?? '',
          nationalId: dto.nationalId ?? '',
          preferredChannel: 'PHONE',
        },
        actor,
        dto.branchId,
      );
    } catch {
      throw new ServiceUnavailableException(
        'ثبت مخاطب پس از مصرف مجوز ناموفق بود؛ پرونده نیمه‌ثبت‌شده را بررسی و کد جدید دریافت کنید.',
      );
    }
  }

  private binding(
    dto: CreateB2bPhoneChallengeDto,
    actor: AuthenticatedActor,
    organizationId = dto.organizationId ?? null,
  ): PhoneVerificationBinding {
    const canonicalPhone = normalizeIranianMobile(dto.phone);
    if (!canonicalPhone)
      throw new BadRequestException(
        'شماره همراه معتبر نیست؛ 09xxxxxxxxx یا معادل +98/0098 آن را وارد کنید.',
      );
    return {
      actor,
      branchId: dto.branchId,
      registrationId: dto.registrationId,
      role: dto.role,
      organizationId,
      canonicalPhone,
    };
  }

  private async assertActor(actor: AuthenticatedActor, branchId: string) {
    if (process.env.NODE_ENV !== 'development')
      throw new ServiceUnavailableException(
        'تأیید شماره در این محیط غیرفعال است و پرونده ذخیره نشد.',
      );
    if (
      !actor.permissions.includes('master_data.read') ||
      !actor.permissions.includes('master_data.create')
    )
      throw new ForbiddenException('مجوز ثبت مخاطب سازمانی وجود ندارد.');
    if (!actor.branchIds.includes(branchId))
      throw new ForbiddenException(
        'شعبه انتخاب‌شده در دامنه دسترسی کاربر نیست.',
      );
    if (await this.organizationUsers.byUser(actor.userId))
      throw new ForbiddenException(
        'حساب پرتال سازمان اجازه اجرای ثبت همکاری داخلی را ندارد.',
      );
  }

  private async assertActiveOrganization(organizationId: string) {
    const result = await this.masterData.detail(
      'organizations',
      organizationId,
    );
    if (result.data.status !== 'active')
      throw new ForbiddenException('سازمان انتخاب‌شده فعال نیست.');
    return result.data;
  }
}
