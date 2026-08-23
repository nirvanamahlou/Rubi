import { Module } from '@nestjs/common';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { MasterDataController } from './master-data.controller';
import { MasterDataRepository } from './master-data.repository';
import { MasterDataService } from './master-data.service';

@Module({
  imports: [IamModule],
  controllers: [MasterDataController],
  providers: [AuthGuard, PermissionGuard, MasterDataRepository, MasterDataService],
})
export class MasterDataModule {}
