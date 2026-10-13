import { Module } from '@nestjs/common';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { CustomerContactCrypto } from './customer-contact.crypto';
import { CustomerNationalIdProtector } from './customer-national-id';
import { CustomerRepository } from './customer.repository';
import { CustomerService } from './customer.service';
import { CustomersController } from './customers.controller';

@Module({
  imports: [IamModule],
  controllers: [CustomersController],
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
