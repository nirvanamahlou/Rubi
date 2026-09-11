import { Module } from '@nestjs/common';
import { HrDirectoryModule } from './hr-directory.module';

import { DocumentsModule } from '../documents/documents.module';
import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { HrConnectionsService } from './hr-connections.service';
import { HrConnectionsController } from './hr-connections.controller';

@Module({
  imports: [IamModule, DocumentsModule, HrDirectoryModule],
  controllers: [HrController, HrConnectionsController],
  providers: [AuthGuard, HrService, HrConnectionsService],
  exports: [HrService, HrConnectionsService],
})
export class HrModule {}
