import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  insurancePassengerIds,
  type SalesReservationRequestV1,
} from '@nora/contracts';
import type { Prisma } from '@nora/database';
import type {
  AuthenticatedActor,
  InsurancePassengerInputV1,
} from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { CustomerNationalIdProtector } from './customer-national-id';
import { CustomerContactCrypto } from './customer-contact.crypto';
import { CustomerRepository } from './customer.repository';

/** Internal provider-only projection; never exposed through an HTTP customer endpoint. */
@Injectable()
export class CustomerInsuranceIdentity {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CustomerNationalIdProtector)
    private readonly ids: CustomerNationalIdProtector,
    @Inject(CustomerContactCrypto)
    private readonly contacts: CustomerContactCrypto,
    @Inject(CustomerRepository) private readonly repository: CustomerRepository,
  ) {}
  private async context(intakeId: string, customerId: string) {
    const source = await this.db.client.reservationIntake.findUnique({
      where: { id: intakeId },
    });
    if (!source) throw new NotFoundException();
    const contract = await this.db.client.salesContract.findFirst({
      where: { id: source.contractId, branchId: source.branchId },
    });
    if (
      !contract ||
      !['SENT_TO_RESERVATIONS', 'CONFIRMED'].includes(contract.status)
    )
      throw new NotFoundException();
    const intake = { ...source, contract };
    if (
      !intake ||
      intake.status === 'CANCELLED' ||
      intake.contract.status === 'CANCELLED'
    )
      throw new NotFoundException();
    const snapshot = intake.snapshot as unknown as SalesReservationRequestV1;
    if (!insurancePassengerIds(snapshot).includes(customerId))
      throw new NotFoundException();
    const latest = await this.db.client.reservationIntake.findFirst({
      where: { contractId: intake.contractId },
      orderBy: { contractVersion: 'desc' },
      select: { id: true },
    });
    if (latest?.id !== intakeId) throw new NotFoundException();
    const person = await this.db.client.customer.findUnique({
      where: { id: customerId },
      include: { contacts: true },
    });
    if (!person || person.kind !== 'PERSON' || !person.isActive)
      throw new NotFoundException();
    return { intake, snapshot, person };
  }
  async correction(
    intakeId: string,
    customerId: string,
    actor: AuthenticatedActor,
  ) {
    const { intake, person } = await this.context(intakeId, customerId);
    await this.repository.auditSensitiveRead(
      customerId,
      actor.userId,
      intake.branchId,
      'insurance-provider-issuance',
      undefined,
      ['nationalId', 'passportNumber', 'birthDate', 'contacts.value'],
    );
    const contact = (type: 'PHONE' | 'EMAIL') => {
      const value =
        person.contacts.find((c) => c.type === type && c.isPrimary) ??
        person.contacts.find((c) => c.type === type);
      return value ? (this.contacts.decrypt(value) ?? '') : '';
    };
    return {
      version: person.version,
      firstName: person.firstName ?? '',
      lastName: person.lastName ?? '',
      firstNameLatin: person.passportFirstName ?? '',
      lastNameLatin: person.passportLastName ?? '',
      nationalityCode: person.nationalityCode ?? 'IRN',
      nationalCode: this.ids.decrypt(person) ?? '',
      passportNo: this.ids.decryptPassportNumber(person) ?? '',
      birthDate: person.birthDate?.toISOString().slice(0, 10) ?? '',
      gender:
        person.gender === 'M' || person.gender === 'F' ? person.gender : '',
      mobile: contact('PHONE'),
      email: contact('EMAIL'),
    };
  }
  async saveCorrection(
    tx: Prisma.TransactionClient,
    customerId: string,
    input: InsurancePassengerInputV1,
    actor: AuthenticatedActor,
    branchId: string,
  ) {
    const national =
      input.nationalityCode === 'IRN'
        ? this.ids.protect(input.nationalCode)
        : {};
    const passport = this.ids.protectPassportNumber(input.passportNo);
    const updated = await tx.customer.updateMany({
      where: {
        id: customerId,
        version: input.version,
        kind: 'PERSON',
        isActive: true,
      },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        displayName: input.firstName + ' ' + input.lastName,
        passportFirstName: input.firstNameLatin,
        passportLastName: input.lastNameLatin,
        nationalityCode: input.nationalityCode,
        gender: input.gender,
        birthDate: new Date(input.birthDate + 'T00:00:00Z'),
        ...national,
        ...passport,
        version: { increment: 1 },
        updatedByUserId: actor.userId,
      },
    });
    if (!updated.count)
      throw new ConflictException(
        'اطلاعات مسافر تغییر کرده است؛ دوباره دریافت کنید.',
      );
    for (const [type, value] of [
      ['phone', input.mobile],
      ['email', input.email.toLowerCase()],
    ] as const) {
      const kind = type === 'phone' ? 'PHONE' : 'EMAIL';
      const protectedValue = this.contacts.protect(
        type,
        value,
        type === 'phone'
          ? '*******' + value.slice(-4)
          : '***@' + value.split('@')[1],
      );
      await tx.customerContact.updateMany({
        where: { customerId, type: kind, isPrimary: true },
        data: { isPrimary: false },
      });
      await tx.customerContact.upsert({
        where: {
          customerId_type_valueHash: {
            customerId,
            type: kind,
            valueHash: protectedValue.valueHash,
          },
        },
        create: {
          customerId,
          type: kind,
          ...protectedValue,
          isPrimary: true,
          createdByUserId: actor.userId,
        },
        update: { ...protectedValue, isPrimary: true, verifiedAt: null },
      });
    }
    await tx.customerAuditEvent.create({
      data: {
        actorUserId: actor.userId,
        actorBranchId: branchId,
        action: 'customers.insurance.correct',
        entityType: 'customer',
        entityId: customerId,
        outcome: 'SUCCESS',
        afterSnapshot: {
          fields: [
            'firstName',
            'lastName',
            'passportFirstName',
            'passportLastName',
            'nationalId',
            'passportNumber',
            'birthDate',
            'gender',
            'nationalityCode',
            'contacts.value',
          ],
          version: input.version + 1,
        },
      },
    });
  }
  async read(intakeId: string, customerId: string) {
    const { intake, snapshot, person } = await this.context(
      intakeId,
      customerId,
    );
    const payer =
      customerId === intake.contract.customerId
        ? person
        : await this.db.client.customer.findUnique({
            where: { id: intake.contract.customerId },
            include: { contacts: true },
          });
    const contact = (kind: 'PHONE' | 'EMAIL') => {
      const selected =
        person.contacts.find((c) => c.type === kind && c.isPrimary) ??
        person.contacts.find((c) => c.type === kind) ??
        payer?.contacts.find((c) => c.type === kind);
      return selected ? this.contacts.decrypt(selected)?.trim() : undefined;
    };
    const passportNo = this.ids.decryptPassportNumber(person)?.trim();
    const nationalCode = this.ids.decrypt(person)?.trim();
    const mobile = contact('PHONE');
    const email = contact('EMAIL');
    const isIranian = person.nationalityCode === 'IRN';
    if (
      !person.birthDate ||
      !person.firstName ||
      !person.lastName ||
      !person.passportFirstName ||
      !person.passportLastName ||
      !['M', 'F'].includes(person.gender ?? '') ||
      !passportNo ||
      !mobile ||
      !email ||
      (isIranian && !nationalCode) ||
      !person.nationalityCode
    )
      throw new BadRequestException(
        'اطلاعات هویتی، پاسپورت و تماس بیمه‌شده را تکمیل کنید.',
      );
    await this.repository.auditSensitiveRead(
      person.id,
      intake.contract.ownerUserId,
      intake.branchId,
      'insurance-provider-issuance',
      undefined,
      ['nationalId', 'passportNumber', 'birthDate', 'contacts.value'],
    );
    if (payer && payer.id !== person.id)
      await this.repository.auditSensitiveRead(
        payer.id,
        intake.contract.ownerUserId,
        intake.branchId,
        'insurance-provider-contact',
        undefined,
        ['contacts.value'],
      );
    return {
      intake,
      snapshot,
      person: {
        nationalCode: isIranian ? nationalCode! : passportNo,
        isIranian,
        firstName: person.firstName,
        lastName: person.lastName,
        firstNameLatin: person.passportFirstName,
        lastNameLatin: person.passportLastName,
        gender: person.gender === 'M' ? 1 : 2,
        birthDate: person.birthDate.toISOString(),
        mobile,
        email,
      },
      passportNo,
    };
  }
}
