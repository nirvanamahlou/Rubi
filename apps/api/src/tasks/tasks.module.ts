import { Module } from '@nestjs/common';
import { AutomationTasksService } from './automation-tasks.service';

@Module({
  providers: [AutomationTasksService],
  exports: [AutomationTasksService],
})
export class TasksModule {}
