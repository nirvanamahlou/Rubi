import { createHash } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  SalesContractOutputV1,
} from '@rubi/contracts';
import { CustomerService } from '../customers/customer.service';
import { IamService } from '../iam/iam.service';
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
    @Inject(IamService) private readonly iam: IamService,
  ) {}
  async prepare(
    id: string,
    actor: AuthenticatedActor,
    traceId?: string,
  ): Promise<{ data: SalesContractOutputV1 }> {
    if (
      !actor.permissions.includes('sales.export') ||
      !actor.permissions.includes('legal-entity.read')
    )
      throw new ForbiddenException(
        'مجوز خروجی قرارداد و مشاهده شرکت فعال لازم است.',
      );
    // Reuse the existing own/assigned/branch/all contract-read policy.
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
    const { data: customer } = await this.customers.maskedDetail(
      contract.customerId,
      actor,
    );
    const users = actor.permissions.includes('iam.users.read')
      ? await this.iam.listUsers()
      : [];
    const output: SalesContractOutputV1 = {
      version: 1,
      generatedAt: new Date().toISOString(),
      contract,
      ownerName:
        users.find((user) => user.id === contract.ownerUserId)?.displayName ??
        null,
      customer: {
        kind: customer.kind,
        address: customer.addresses.find((a) => a.isPrimary)?.label ?? null,
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
