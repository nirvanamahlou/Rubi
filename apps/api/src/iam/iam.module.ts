import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuditController } from './audit.controller';
import { AuthGuard } from './auth.guard';
import { IamService } from './iam.service';
import { PermissionGuard } from './permission.guard';
import { RolesController } from './roles.controller';
import { UsersController } from './users.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('IAM_ACCESS_TOKEN_SECRET'),
        signOptions: { issuer: 'rubi-api', audience: 'rubi-web' },
        verifyOptions: { issuer: 'rubi-api', audience: 'rubi-web' },
      }),
    }),
  ],
  controllers: [
    AuthController,
    UsersController,
    RolesController,
    AuditController,
  ],
  providers: [IamService, AuthGuard, PermissionGuard],
  exports: [IamService],
})
export class IamModule {}
