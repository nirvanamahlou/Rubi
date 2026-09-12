import { Module } from '@nestjs/common';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { MessagingController } from './messaging.controller';
import { MessagingRepository } from './messaging.repository';
import { MessagingService } from './messaging.service';

@Module({
  imports: [IamModule],
  controllers: [MessagingController],
  providers: [AuthGuard, MessagingRepository, MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
