import {
  Inject,
  forwardRef,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  insurancePassengerIds,
  type SalesReservationRequestV1,
} from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { CustomerNationalIdProtector } from './customer-national-id';
import { CustomerContactCrypto } from './customer-contact.crypto';
import { CustomerRepository } from './customer.repository';
import { SalesOperationalAmendmentService } from '../sales/sales-operational-amendment.module';

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
    @Inject(forwardRef(() => SalesOperationalAmendmentService))
    private readonly sales: SalesOperationalAmendmentService,
  ) {}
  async read(intakeId: string, customerId: string) {
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
    const snapshot = await this.sales.currentExecution(
      this.db.client,
      intake.snapshot as unknown as SalesReservationRequestV1,
      [intake.branchId],
    );
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
    const payer =
      customerId === intake.contract.customerId
        ? person
        : await this.db.client.customer.findUnique({
            where: { id: intake.contract.customerId },
            include: { contacts: true },
          });
    const contact = (kind: 'PHONE' | 'EMAIL') => {
      const selected =
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
