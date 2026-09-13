import { Module } from '@nestjs/common';
import { CustomerAffairsModule } from '../customer-affairs/customer-affairs.module';
import { DocumentsModule } from '../documents/documents.module';
import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { WorkbenchController } from './workbench.controller';
import { WorkbenchService } from './workbench.service';

@Module({
  imports: [IamModule, DocumentsModule, CustomerAffairsModule],
  controllers: [WorkbenchController],
  providers: [AuthGuard, WorkbenchService],
})
export class WorkbenchModule {}
