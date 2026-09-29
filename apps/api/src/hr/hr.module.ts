import { Module } from '@nestjs/common';
import { HrDirectoryModule } from './hr-directory.module';

import { DocumentsModule } from '../documents/documents.module';
import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { HrSelfPerformanceService } from './hr-self-performance.service';
import { HrConnectionsService } from './hr-connections.service';
import { HrConnectionsController } from './hr-connections.controller';

@Module({
  imports: [IamModule, DocumentsModule, HrDirectoryModule],
  controllers: [HrController, HrConnectionsController],
  providers: [
    AuthGuard,
    HrService,
    HrConnectionsService,
    HrSelfPerformanceService,
  ],
  exports: [HrService, HrConnectionsService, HrSelfPerformanceService],
})
export class HrModule {}
