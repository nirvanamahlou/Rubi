import { Module } from '@nestjs/common';

import { IamModule } from '../iam/iam.module';
import { SystemManagementController } from './system-management.controller';
import { SystemManagementService } from './system-management.service';

@Module({
  imports: [IamModule],
  controllers: [SystemManagementController],
  providers: [SystemManagementService],
  exports: [SystemManagementService],
})
export class SystemManagementModule {}
