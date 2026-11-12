import { Module } from '@nestjs/common';
import { IamModule } from '../../iam/iam.module';
import { AuthGuard } from '../../iam/auth.guard';
import { PermissionGuard } from '../../iam/permission.guard';
import { DatabaseModule } from '../../database/database.module';
import { AccountingTaxpayerController } from './accounting-taxpayer.controller';
import { AccountingTaxpayerService } from './accounting-taxpayer.service';
import { AccountingCompletionController } from './accounting-completion.controller';
import { AccountingCompletionService } from './accounting-completion.service';
import { AccountingCompanyScope } from './accounting-company-scope';
import { LegalEntitiesModule } from '../../legal-entities/legal-entities.module';

// Mounted by FinanceModule; controllers retain their own authentication and scope checks.
// Existing AccountingTaxController stays registered in FinanceModule exactly once.
@Module({
  imports: [DatabaseModule, IamModule, LegalEntitiesModule],
  controllers: [AccountingTaxpayerController, AccountingCompletionController],
  providers: [
    AuthGuard,
    PermissionGuard,
    AccountingTaxpayerService,
    AccountingCompletionService,
    AccountingCompanyScope,
  ],
})
export class AccountingCompletionModule {}
