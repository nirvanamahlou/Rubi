import { MasterDataModule } from '../master-data/master-data.module';
import { CustomerInsuranceIdentity } from './customer-insurance-identity';
import { SalesOperationalAmendmentModule } from '../sales/sales-operational-amendment.module';
import { SalesPeopleController } from './sales-people.controller';
import { Module, forwardRef } from '@nestjs/common';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { CustomerContactCrypto } from './customer-contact.crypto';
import { CustomerNationalIdProtector } from './customer-national-id';
import { CustomerRepository } from './customer.repository';
import { CustomerService } from './customer.service';
import { CustomersController } from './customers.controller';
import { CustomerSelectionController } from './customer-selection.controller';

@Module({
  imports: [
    IamModule,
    MasterDataModule,
    forwardRef(() => SalesOperationalAmendmentModule),
  ],
  controllers: [
    SalesPeopleController,
    CustomerSelectionController,
    CustomersController,
  ],
  providers: [
    AuthGuard,
    PermissionGuard,
    CustomerContactCrypto,
    CustomerNationalIdProtector,
    CustomerRepository,
    CustomerService,
    CustomerInsuranceIdentity,
  ],
  exports: [CustomerService, CustomerInsuranceIdentity],
})
export class CustomersModule {}
