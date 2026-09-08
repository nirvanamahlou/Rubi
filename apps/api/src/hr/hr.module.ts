import { Module } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module';
import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';

@Module({
  imports: [IamModule, DocumentsModule],
  controllers: [HrController],
  providers: [AuthGuard, HrService],
  exports: [HrService],
})
export class HrModule {}
