import { Module } from '@nestjs/common';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { CustomerRepository } from './customer.repository';
import { CustomerService } from './customer.service';
import { CustomersController } from './customers.controller';

@Module({
  imports: [IamModule],
  controllers: [CustomersController],
  providers: [AuthGuard, PermissionGuard, CustomerRepository, CustomerService],
  exports: [CustomerService],
})
export class CustomersModule {}
