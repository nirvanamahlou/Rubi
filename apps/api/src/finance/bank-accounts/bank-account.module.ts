import { Module } from '@nestjs/common';
import { IamModule } from '../../iam/iam.module';
import { MasterDataModule } from '../../master-data/master-data.module';
import { AuthGuard } from '../../iam/auth.guard';
import { PermissionGuard } from '../../iam/permission.guard';
import { BankAccountController } from './bank-account.controller';
import { BankAccountService } from './bank-account.service';
import { BankAccountCrypto } from './bank-account.crypto';

@Module({
  imports: [IamModule, MasterDataModule],
  controllers: [BankAccountController],
  providers: [
    BankAccountService,
    BankAccountCrypto,
    AuthGuard,
    PermissionGuard,
  ],
})
export class BankAccountModule {}
