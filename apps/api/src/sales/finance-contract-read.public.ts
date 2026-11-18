import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Module,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  FinanceContractReadV1,
} from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { LegalEntitiesModule } from '../legal-entities/legal-entities.module';
import { ContractCompanyScope } from './contract-company-scope.public';
import { SalesBuyerContactCrypto } from './sales-buyer-contact.crypto';
import { salesDetailInclude } from './sales.repository';
import { presentSalesContract } from './sales.service';
import { MasterDataModule } from '../master-data/master-data.module';
import { MasterSalesDirectory } from '../master-data/master-sales-directory';

/** Sales-owned, read-only Finance port. Does not grant Sales commands/customer identity access. */
@Injectable()
export class SalesFinanceContractRead {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ContractCompanyScope) private readonly scope: ContractCompanyScope,
    @Inject(SalesBuyerContactCrypto)
    private readonly crypto: SalesBuyerContactCrypto,
    @Inject(MasterSalesDirectory)
    private readonly directory: MasterSalesDirectory,
  ) {}

  private async where(actor: AuthenticatedActor) {
    if (!actor.permissions.includes('finance.read'))
      throw new ForbiddenException();
    return {
      ...(await this.scope.where(actor, false, 'financeHiddenAt')),
      branchId: { in: [...actor.branchIds] },
    };
  }

  async references(ids: string[], actor: AuthenticatedActor) {
    if (!ids.length) return [];
    const rows = await this.db.client.salesContract.findMany({
      where: {
        AND: [await this.where(actor), { id: { in: [...new Set(ids)] } }],
      },
      select: { id: true, contractNumber: true },
    });
    return rows.map((row) => ({ id: row.id, number: row.contractNumber }));
  }

  async paymentReferences(ids: string[], actor: AuthenticatedActor) {
    if (!ids.length) return [];
    const rows = await this.db.client.salesContractPaymentEntry.findMany({
      where: {
        id: { in: [...new Set(ids)] },
        contract: await this.where(actor),
      },
      select: {
        id: true,
        contract: { select: { id: true, contractNumber: true } },
      },
    });
    return rows.map((row) => ({
      paymentId: row.id,
      id: row.contract.id,
      number: row.contract.contractNumber,
    }));
  }

  async read(
    id: string,
    actor: AuthenticatedActor,
  ): Promise<FinanceContractReadV1> {
    const visibility = await this.where(actor);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      throw new BadRequestException('شناسه قرارداد معتبر نیست.');
    const row = await this.db.client.salesContract.findFirst({
      where: { AND: [visibility, { id }] },
      include: salesDetailInclude,
    });
    if (!row) throw new NotFoundException();
    const cityName = async (id: string) => {
      try {
        return (await this.directory.detail('cities', id)).data.name;
      } catch (error) {
        if (error instanceof NotFoundException) return null;
        throw error;
      }
    };
    const [originName, destinationName] = await Promise.all([
      cityName(row.originId),
      cityName(row.destinationId),
    ]);
    return {
      contract: {
        ...presentSalesContract(row, undefined, this.crypto),
        originName,
        destinationName,
      },
    };
  }
}

@Module({
  imports: [LegalEntitiesModule, MasterDataModule],
  providers: [SalesBuyerContactCrypto, SalesFinanceContractRead],
  exports: [SalesFinanceContractRead],
})
export class SalesFinanceContractReadModule {}
