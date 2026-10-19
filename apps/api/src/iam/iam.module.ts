import { IamCallCenterDirectory } from './iam-call-center-directory';
import { Module } from '@nestjs/common';
import { IamCorrespondenceDirectory } from './iam-correspondence-directory';
import { HrUserUnitDirectoryModule } from '../hr/hr-user-unit-directory';
import { IamReservationsDirectory } from './iam-reservations-directory';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuditController } from './audit.controller';
import { AuthGuard } from './auth.guard';
import { IamService } from './iam.service';
import { IamProcurementDirectory } from './iam-procurement-directory';
import { IamFinanceDirectory } from './iam-finance-directory';
import { IAM_STEP_UP_PORT } from './iam-step-up.port';
import { MfaTotpService } from './mfa-totp';
import { PermissionGuard } from './permission.guard';
import { RolesController } from './roles.controller';
import { UsersController } from './users.controller';
import { ManualUserAccessService } from './manual-user-access.service';
import { ManualAccessVersionController } from './manual-access-version.controller';

@Module({
  imports: [
    HrUserUnitDirectoryModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('IAM_ACCESS_TOKEN_SECRET'),
        signOptions: { issuer: 'nora-api', audience: 'nora-web' },
        verifyOptions: { issuer: 'nora-api', audience: 'nora-web' },
      }),
    }),
  ],
  controllers: [
    ManualAccessVersionController,
    AuthController,
    UsersController,
    RolesController,
    AuditController,
  ],
  providers: [
    IamCallCenterDirectory,
    IamCorrespondenceDirectory,
    IamReservationsDirectory,
    ManualUserAccessService,
    IamProcurementDirectory,
    IamFinanceDirectory,
    IamService,
    MfaTotpService,
    AuthGuard,
    PermissionGuard,
    { provide: IAM_STEP_UP_PORT, useExisting: IamService },
  ],
  exports: [
    IamCallCenterDirectory,
    IamCorrespondenceDirectory,
    IamReservationsDirectory,
    IamService,
    IAM_STEP_UP_PORT,
    IamProcurementDirectory,
    IamFinanceDirectory,
  ],
})
export class IamModule {}
