import { SalesPeopleController } from './sales-people.controller';
import { Module } from '@nestjs/common';

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
  imports: [IamModule],
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
  ],
  exports: [CustomerService],
})
export class CustomersModule {}
