import { AccountingController } from './accounting/accounting.controller';
import { AccountingService } from './accounting/accounting.service';
import { Module } from '@nestjs/common';

import { HrModule } from '../hr/hr.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DocumentsModule } from '../documents/documents.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { FinanceRequestsController } from './operations/finance-requests.controller';
import { FinanceFollowupController } from './operations/finance-followup.controller';
import { FinanceFollowupService } from './operations/finance-followup.service';
import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { ReservationsRuntimeModule } from '../reservations/reservations-runtime.module';
import { SalesModule } from '../sales/sales.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { FinanceInboxController } from './finance-inbox.controller';
import { FinancePayrollController } from './operations/finance-payroll.controller';
import { FinancePayrollService } from './operations/finance-payroll.service';
import { FinanceInboxService } from './finance-inbox.service';
import { FinanceTicketCostModule } from './finance-ticket-cost.module';

@Module({
  imports: [
    IamModule,
    NotificationsModule,
    DocumentsModule,
    MasterDataModule,
    SalesModule,
    HrModule,
    ReservationsRuntimeModule,
    ProcurementModule,
    FinanceTicketCostModule,
  ],
  controllers: [
    AccountingController,
    FinanceInboxController,
    FinancePayrollController,
    FinanceFollowupController,
    FinanceRequestsController,
  ],
  providers: [
    AccountingService,
    AuthGuard,
    PermissionGuard,
    FinanceInboxService,
    FinancePayrollService,
    FinanceFollowupService,
  ],
})
export class FinanceModule {}
