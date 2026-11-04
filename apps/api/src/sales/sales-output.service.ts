import { createHash } from 'node:crypto';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type {
  AuthenticatedActor,
  SalesContractOutputV1,
} from '@nora/contracts';
import { CustomerService } from '../customers/customer.service';
import { IamFinanceDirectory } from '../iam/iam-finance-directory';
import { LegalEntitiesService } from '../legal-entities/legal-entities.service';
import { SalesService } from './sales.service';
import { SalesRepository } from './sales.repository';

@Injectable()
export class SalesOutputService {
  constructor(
    @Inject(SalesService) private readonly sales: SalesService,
    @Inject(SalesRepository) private readonly repository: SalesRepository,
    @Inject(CustomerService) private readonly customers: CustomerService,
    @Inject(LegalEntitiesService)
    private readonly legalEntities: LegalEntitiesService,
    @Inject(IamFinanceDirectory)
    private readonly identities: IamFinanceDirectory,
  ) {}
  async prepare(
    id: string,
    actor: AuthenticatedActor,
    traceId?: string,
  ): Promise<{ data: SalesContractOutputV1 }> {
    // The authoritative row-read policy also authorizes this document's output.
    const { data: contract } = await this.sales.detail(id, actor);
    if (['DRAFT', 'PENDING_CONFIRMATION'].includes(contract.status))
      throw new ConflictException(
        'قرارداد را پیش از تهیه خروجی نهایی تأیید کنید.',
      );
    const { data: context } = await this.legalEntities.current(actor);
    if (context.isAggregate || !context.legalEntity)
      throw new ConflictException(
        'برای خروجی، یک شرکت مشخص را از بالای صفحه انتخاب کنید.',
      );
    const { data: branding } = await this.legalEntities.branding(
      context.legalEntity.id,
      actor,
    );
    // Derived only after Sales row authorization, and used only for this
    // document's buyer/passenger projections (including read-all managers).
    const documentActor: AuthenticatedActor = {
      ...actor,
      branchIds: [...new Set([...actor.branchIds, contract.branchId])],
      permissions: [
        ...new Set<AuthenticatedActor['permissions'][number]>([
          ...actor.permissions,
          'sales.export',
        ]),
      ],
    };
    const { data: customer } = await this.customers.maskedDetail(
      contract.customerId,
      documentActor,
    );
    const passengerNames = await Promise.all(
      (contract.passengersDetail ?? []).map(async (passenger) => {
        const person = await this.customers.salesOutputIdentity(
          passenger.customerId,
          documentActor,
          traceId,
        );
        return {
          ...passenger,
          displayNameSnapshot:
            person.passportName ||
            person.displayName ||
            passenger.displayNameSnapshot,
          birthDate: person.birthDate ?? passenger.birthDate,
        };
      }),
    );
    const owner = await this.identities.documentOwnerName(contract.ownerUserId);
    const output: SalesContractOutputV1 = {
      version: 1,
      generatedAt: new Date().toISOString(),
      contract: { ...contract, passengersDetail: passengerNames },
      ownerName: owner?.displayName ?? null,
      customer: {
        kind: customer.kind,
        address:
          contract.buyerContact?.address ??
          customer.addresses.find((a) => a.isPrimary)?.label ??
          null,
        phone: contract.buyerContact?.phone ?? null,
        landline: contract.buyerContact?.landline ?? null,
        postalCode: contract.buyerContact?.postalCode ?? null,
      },
      company: {
        id: branding.legalEntityId,
        code: branding.code,
        persianName: branding.persianName,
        latinName: branding.latinName,
        website: branding.website,
        brandingVersion: branding.version,
      },
    };
    await this.repository.recordOutputPreview(
      contract.id,
      {
        userId: actor.userId,
        branchId: contract.branchId,
        ...(traceId ? { traceId } : {}),
      },
      {
        templateVersion: 'travel-services-v1',
        contractVersion: contract.version,
        generatedAt: output.generatedAt,
        company: output.company,
        fingerprint: createHash('sha256')
          .update(JSON.stringify(output))
          .digest('hex'),
        officialIssuance: false,
      },
    );
    return { data: output };
  }
}
