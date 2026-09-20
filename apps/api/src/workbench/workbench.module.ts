import { Module } from '@nestjs/common';
import { CustomerAffairsModule } from '../customer-affairs/customer-affairs.module';
import { DocumentsModule } from '../documents/documents.module';
import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { WorkbenchController } from './workbench.controller';
import { WorkbenchService } from './workbench.service';
import { WorkbenchPerformanceService } from './workbench-performance.service';
import { HrModule } from '../hr/hr.module';
import { SalesModule } from '../sales/sales.module';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [
    IamModule,
    DocumentsModule,
    CustomerAffairsModule,
    HrModule,
    SalesModule,
    CustomersModule,
  ],
  controllers: [WorkbenchController],
  providers: [AuthGuard, WorkbenchService, WorkbenchPerformanceService],
})
export class WorkbenchModule {}
