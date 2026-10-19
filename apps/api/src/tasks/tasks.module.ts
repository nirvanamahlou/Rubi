import { CallCenterTasksService } from './call-center-tasks.service';
import { Module } from '@nestjs/common';
import { AutomationTasksService } from './automation-tasks.service';

@Module({
  providers: [CallCenterTasksService, AutomationTasksService],
  exports: [CallCenterTasksService, AutomationTasksService],
})
export class TasksModule {}
