import { Module } from '@nestjs/common';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [IamModule],
  controllers: [NotificationsController],
  providers: [AuthGuard, NotificationsRepository, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
