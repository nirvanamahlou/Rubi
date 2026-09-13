import { Module } from '@nestjs/common';

import { HrModule } from '../hr/hr.module';
import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { SalesModule } from '../sales/sales.module';
import { FinanceInboxController } from './finance-inbox.controller';
import { FinanceInboxService } from './finance-inbox.service';

@Module({
  imports: [IamModule, SalesModule, HrModule],
  controllers: [FinanceInboxController],
  providers: [AuthGuard, PermissionGuard, FinanceInboxService],
})
export class FinanceModule {}
