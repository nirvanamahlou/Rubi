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
  MasterOrganizationAddressMutationV1,
  MasterOrganizationAddressV1,
} from '@rubi/contracts';
import { AuditOutcome } from '@rubi/database';

import { DatabaseService } from '../database/database.service';

const addressInclude = {
  country: { select: { name: true } },
  city: { select: { name: true } },
} as const;

function branchOf(actor: AuthenticatedActor, requested?: string): string {
  const branchId = requested ?? actor.branchIds[0];
  if (!branchId || !actor.branchIds.includes(branchId))
    throw new ForbiddenException('شعبه انتخاب‌شده در دامنه دسترسی کاربر نیست.');
  return branchId;
}

function addressRecord(row: {
  id: string;
  organizationId: string;
  countryId: string;
  cityId: string;
  label: string;
  postalCode: string | null;
  addressLine: string;
  isPrimary: boolean;
  displayOrder: number;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  country: { name: string };
  city: { name: string };
}): MasterOrganizationAddressV1 {
  return {
    id: row.id,
    organizationId: row.organizationId,
    countryId: row.countryId,
    countryName: row.country.name,
    cityId: row.cityId,
    cityName: row.city.name,
    label: row.label,
    postalCode: row.postalCode,
    addressLine: row.addressLine,
    isPrimary: row.isPrimary,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class MasterOrganizationDirectory {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async agencyReference(organizationId: string) {
    return this.database.client.masterOrganization.findFirst({
      where: {
        id: organizationId,
        roles: { some: { roleCode: 'AGENCY' } },
      },
      select: {
        id: true,
        code: true,
        legalName: true,
        displayName: true,
        personType: true,
        logoFileReference: true,
        isActive: true,
        version: true,
      },
    });
  }

  async addresses(organizationId: string) {
    await this.assertOrganization(organizationId);
    const rows = await this.database.client.masterOrganizationAddress.findMany({
      where: { organizationId },
      include: addressInclude,
      orderBy: [
        { isPrimary: 'desc' },
        { displayOrder: 'asc' },
        { label: 'asc' },
      ],
    });
    return rows.map(addressRecord);
  }

  async primaryAddress(organizationId: string) {
    const row = await this.database.client.masterOrganizationAddress.findFirst({
      where: { organizationId, isPrimary: true, isActive: true },
      include: addressInclude,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return row ? addressRecord(row) : null;
  }

  async createAddress(
    organizationId: string,
    input: MasterOrganizationAddressMutationV1,
    actor: AuthenticatedActor,
    requestedBranch?: string,
  ) {
    await this.assertOrganization(organizationId);
    await this.assertCityCountry(input.cityId, input.countryId);
    const actorBranchId = branchOf(actor, requestedBranch);
    const row = await this.database.client.$transaction(async (transaction) => {
      if (input.isPrimary)
        await transaction.masterOrganizationAddress.updateMany({
          where: { organizationId, isPrimary: true },
          data: {
            isPrimary: false,
            updatedByUserId: actor.userId,
            version: { increment: 1 },
          },
        });
      const created = await transaction.masterOrganizationAddress.create({
        data: {
          organizationId,
          countryId: input.countryId,
          cityId: input.cityId,
          label: input.label.trim(),
          postalCode: input.postalCode?.trim() || null,
          addressLine: input.addressLine.trim(),
          isPrimary: input.isPrimary ?? false,
          displayOrder: input.displayOrder ?? 0,
          isActive: input.isActive ?? true,
          createdByUserId: actor.userId,
          updatedByUserId: actor.userId,
        },
        include: addressInclude,
      });
      await transaction.masterDataAuditEvent.create({
        data: {
          actorUserId: actor.userId,
          actorBranchId,
          action: 'master_data.organization_address.create',
          resource: 'organization-addresses',
          entityId: created.id,
          outcome: AuditOutcome.SUCCESS,
          afterSnapshot: {
            organizationId,
            countryId: created.countryId,
            cityId: created.cityId,
            label: created.label,
            isPrimary: created.isPrimary,
          },
          entityVersion: created.version,
        },
      });
      return created;
    });
    return addressRecord(row);
  }

  async updateAddress(
    organizationId: string,
    addressId: string,
    input: MasterOrganizationAddressMutationV1,
    actor: AuthenticatedActor,
    requestedBranch?: string,
  ) {
    if (!input.version)
      throw new BadRequestException('version برای ویرایش آدرس الزامی است.');
    await this.assertCityCountry(input.cityId, input.countryId);
    const actorBranchId = branchOf(actor, requestedBranch);
    const row = await this.database.client.$transaction(async (transaction) => {
      const before = await transaction.masterOrganizationAddress.findFirst({
        where: { id: addressId, organizationId },
        include: addressInclude,
      });
      if (!before) throw new NotFoundException('آدرس سازمان یافت نشد.');
      if (before.version !== input.version)
        throw new ConflictException('آدرس هم‌زمان تغییر کرده است.');
      if (input.isPrimary)
        await transaction.masterOrganizationAddress.updateMany({
          where: { organizationId, isPrimary: true, NOT: { id: addressId } },
          data: {
            isPrimary: false,
            updatedByUserId: actor.userId,
            version: { increment: 1 },
          },
        });
      const claimed = await transaction.masterOrganizationAddress.updateMany({
        where: { id: addressId, organizationId, version: input.version },
        data: {
          countryId: input.countryId,
          cityId: input.cityId,
          label: input.label.trim(),
          postalCode: input.postalCode?.trim() || null,
          addressLine: input.addressLine.trim(),
          isPrimary: input.isPrimary ?? false,
          displayOrder: input.displayOrder ?? 0,
          isActive: input.isActive ?? true,
          updatedByUserId: actor.userId,
          version: { increment: 1 },
          deactivatedAt: input.isActive === false ? new Date() : null,
          deactivatedByUserId: input.isActive === false ? actor.userId : null,
        },
      });
      if (claimed.count !== 1)
        throw new ConflictException('آدرس هم‌زمان تغییر کرده است.');
      const updated =
        await transaction.masterOrganizationAddress.findUniqueOrThrow({
          where: { id: addressId },
          include: addressInclude,
        });
      await transaction.masterDataAuditEvent.create({
        data: {
          actorUserId: actor.userId,
          actorBranchId,
          action: 'master_data.organization_address.update',
          resource: 'organization-addresses',
          entityId: updated.id,
          outcome: AuditOutcome.SUCCESS,
          beforeSnapshot: {
            countryId: before.countryId,
            cityId: before.cityId,
            label: before.label,
            isPrimary: before.isPrimary,
            isActive: before.isActive,
          },
          afterSnapshot: {
            countryId: updated.countryId,
            cityId: updated.cityId,
            label: updated.label,
            isPrimary: updated.isPrimary,
            isActive: updated.isActive,
          },
          entityVersion: updated.version,
        },
      });
      return updated;
    });
    return addressRecord(row);
  }

  private async assertOrganization(organizationId: string) {
    const exists = await this.database.client.masterOrganization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('سازمان یافت نشد.');
  }

  private async assertCityCountry(cityId: string, countryId: string) {
    const city = await this.database.client.masterCity.findFirst({
      where: { id: cityId, countryId },
      select: { id: true },
    });
    if (!city)
      throw new BadRequestException(
        'شهر انتخاب‌شده متعلق به کشور انتخاب‌شده نیست.',
      );
  }
}
