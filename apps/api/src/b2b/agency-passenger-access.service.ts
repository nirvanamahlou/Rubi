import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Joi from 'joi';
import {
  MANUAL_ACCESS_VERSION,
  type AuthenticatedActor,
  type CustomerMutationRequest,
} from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { CustomerService } from '../customers/customer.service';
import { agencyBuyerReferences } from '../customers/agency-passenger-reference.public';
import { agencyContractPassengerReferences } from '../sales/agency-passenger-reference.public';
import { B2bOrganizationUserService } from './b2b-organization-user.service';

export const AGENCY_PASSENGER_FIELDS = [
  'birthDate',
  'nationalId',
  'passportNumber',
  'passportExpiryDate',
  'gender',
  'nationalityCode',
  'passportIssuingCountryCode',
  'birthCountryCode',
] as const;
const text = (max: number) => Joi.string().trim().max(max).allow('', null);
const day = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .allow('', null);
const schema = Joi.object({
  version: Joi.number().integer().min(1).required(),
  birthDate: day,
  nationalId: text(16),
  passportNumber: text(24),
  passportExpiryDate: day,
  gender: Joi.string().valid('M', 'F', '').allow(null),
  nationalityCode: text(3),
  passportIssuingCountryCode: text(3),
  birthCountryCode: text(3),
}).unknown(false);
export function parseAgencyPassengerUpdate(raw: unknown) {
  const result = schema.validate(raw, { convert: false });
  if (result.error)
    throw new BadRequestException(
      'فقط جزئیات هویتی غیرنام قابل ویرایش است؛ نسخه و مقادیر معتبر لازم‌اند.',
    );
  return result.value as Pick<
    CustomerMutationRequest,
    (typeof AGENCY_PASSENGER_FIELDS)[number]
  > & { version: number };
}

@Injectable()
export class AgencyPassengerAccessService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(B2bOrganizationUserService)
    private readonly members: B2bOrganizationUserService,
    @Inject(CustomerService) private readonly customers: CustomerService,
  ) {}
  private async scope(actor: AuthenticatedActor, write = false) {
    if (
      !actor.permissions.includes('b2b.portal.passengers.read') ||
      (write && !actor.permissions.includes('b2b.portal.passengers.update'))
    )
      throw new ForbiddenException('تیک دسترسی مسافران آژانس فعال نیست.');
    const { row } = await this.members.member(actor);
    const buyerIds = await agencyBuyerReferences(
      this.database.client,
      row.organizationId,
      row.branchId,
    );
    return { row, buyerIds };
  }
  async list(actor: AuthenticatedActor) {
    const { row, buyerIds } = await this.scope(actor);
    return {
      data: await agencyContractPassengerReferences(
        this.database.client,
        buyerIds,
        row.branchId,
      ),
      canEdit: actor.permissions.includes('b2b.portal.passengers.update'),
    };
  }
  private async passenger(
    actor: AuthenticatedActor,
    contractId: string,
    passengerId: string,
    write = false,
  ) {
    const { row, buyerIds } = await this.scope(actor, write);
    const contracts = await agencyContractPassengerReferences(
      this.database.client,
      buyerIds,
      row.branchId,
      contractId,
    );
    if (!contracts[0]?.passengers.some((p) => p.customerId === passengerId))
      throw new NotFoundException('مسافر در قراردادهای آژانس شما وجود ندارد.');
    // A local capability created only after ownership proof. Never returned or persisted on the account.
    const scoped: AuthenticatedActor = {
      ...actor,
      branchIds: [row.branchId],
      permissions: [
        MANUAL_ACCESS_VERSION,
        'customers.read',
        'customers.sensitive.read',
        ...(write ? ['customers.update' as const] : []),
        ...AGENCY_PASSENGER_FIELDS.map(
          (f) => `ui.allow.field.customers.${f}` as const,
        ),
      ],
    };
    const { data } = await this.customers.detail(
      passengerId,
      scoped,
      undefined,
      'customer-verification',
    );
    if (data.kind !== 'person') throw new NotFoundException();
    return { scoped, data };
  }
  private present(
    data: Awaited<ReturnType<CustomerService['detail']>>['data'],
  ) {
    return {
      id: data.id,
      version: data.version,
      firstName: data.firstName,
      lastName: data.lastName,
      passportFirstName: data.passportFirstName,
      passportLastName: data.passportLastName,
      ...Object.fromEntries(
        AGENCY_PASSENGER_FIELDS.map((f) => [f, data[f] ?? null]),
      ),
    };
  }
  async detail(
    actor: AuthenticatedActor,
    contractId: string,
    passengerId: string,
  ) {
    return {
      data: this.present(
        (await this.passenger(actor, contractId, passengerId)).data,
      ),
    };
  }
  async update(
    actor: AuthenticatedActor,
    contractId: string,
    passengerId: string,
    raw: unknown,
  ) {
    const input = parseAgencyPassengerUpdate(raw);
    const { scoped, data } = await this.passenger(
      actor,
      contractId,
      passengerId,
      true,
    );
    const result = await this.customers.update(
      passengerId,
      {
        kind: data.kind,
        roles: data.roles,
        organizationId: data.organizationId,
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName,
        passportFirstName: data.passportFirstName,
        passportLastName: data.passportLastName,
        acquaintanceMethodId: data.acquaintanceMethodId,
        ...Object.fromEntries(
          AGENCY_PASSENGER_FIELDS.map((f) => [f, data[f] ?? null]),
        ),
        ...input,
      },
      scoped,
      data.ownerBranchId,
    );
    return { data: this.present(result.data) };
  }
}
