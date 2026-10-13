import { Module } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module';
import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { MasterDataLogoController } from './master-data-logo.controller';
import { MasterDataLogoService } from './master-data-logo.service';
import { MasterDataModule } from './master-data.module';

@Module({
  imports: [IamModule, MasterDataModule, DocumentsModule],
  controllers: [MasterDataLogoController],
  providers: [AuthGuard, PermissionGuard, MasterDataLogoService],
})
export class MasterDataLogoModule {}
