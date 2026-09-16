import { Module } from '@nestjs/common';

import { HrModule } from '../hr/hr.module';
import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { ReservationsRuntimeModule } from '../reservations/reservations-runtime.module';
import { SalesModule } from '../sales/sales.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { FinanceInboxController } from './finance-inbox.controller';
import { FinanceInboxService } from './finance-inbox.service';

@Module({
  imports: [
    IamModule,
    SalesModule,
    HrModule,
    ReservationsRuntimeModule,
    ProcurementModule,
  ],
  controllers: [FinanceInboxController],
  providers: [AuthGuard, PermissionGuard, FinanceInboxService],
})
export class FinanceModule {}
