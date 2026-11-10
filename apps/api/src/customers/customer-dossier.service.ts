import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AuthenticatedActor,
  CustomerDossierResponse,
  CustomerDossierSection,
} from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { CustomerRepository } from './customer.repository';
import { ContractCompanyScope } from '../sales/contract-company-scope.public';
import {
  dossierSalesScope,
  readSalesCustomerDossier,
} from '../sales/customer-dossier.public';
import { customerDossierContractReferences } from '../sales/customer-dossier-references.public';
import { readReservationCustomerDossier } from '../reservations/customer-dossier.public';
import { readAffairsCustomerDossier } from '../customer-affairs/customer-dossier.public';
@Injectable()
export class CustomerDossierService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CustomerRepository) private readonly customers: CustomerRepository,
    @Inject(ContractCompanyScope)
    private readonly company: ContractCompanyScope,
  ) {}
  async read(
    customerId: string,
    actor: AuthenticatedActor,
  ): Promise<CustomerDossierResponse> {
    if (!(await this.customers.find(customerId, actor.branchIds)))
      throw new NotFoundException();
    const scope = dossierSalesScope(actor, customerId, {})
      ? this.company
          .where(actor)
          .then((company) => dossierSalesScope(actor, customerId, company))
      : Promise.resolve(null);
    const safe = async (
      ids: CustomerDossierSection['id'][],
      read: () => Promise<CustomerDossierSection[]>,
    ): Promise<CustomerDossierSection[]> => {
      try {
        return await read();
      } catch {
        return ids.map((id) => ({
          id,
          state: 'unavailable',
          rows: [],
          hasMore: false,
        }));
      }
    };
    const sources = await Promise.all([
      safe(['contracts', 'services', 'payments', 'checks'], async () =>
        readSalesCustomerDossier(
          this.db.client,
          actor,
          customerId,
          await scope,
        ),
      ),
      safe(['requests', 'support'], () =>
        readAffairsCustomerDossier(this.db.client, actor, customerId),
      ),
      safe(['tickets', 'vouchers', 'insurance'], async () => {
        const contractScope = await scope;
        const refs = contractScope
          ? await customerDossierContractReferences(
              this.db.client,
              contractScope,
            )
          : null;
        return readReservationCustomerDossier(
          this.db.client,
          actor,
          customerId,
          refs?.map((r) => r.id) ?? null,
        );
      }),
    ]);
    return { data: { customerId, sections: sources.flat() } };
  }
}
