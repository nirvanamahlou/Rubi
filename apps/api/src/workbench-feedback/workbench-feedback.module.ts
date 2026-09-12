import { Module } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module';
import { HrDirectoryModule } from '../hr/hr-directory.module';
import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkbenchFeedbackController } from './workbench-feedback.controller';
import { WorkbenchFeedbackRepository } from './workbench-feedback.repository';
import { WorkbenchFeedbackService } from './workbench-feedback.service';

@Module({
  imports: [IamModule, HrDirectoryModule, DocumentsModule, NotificationsModule],
  controllers: [WorkbenchFeedbackController],
  providers: [AuthGuard, WorkbenchFeedbackRepository, WorkbenchFeedbackService],
})
export class WorkbenchFeedbackModule {}
