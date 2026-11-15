import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
import { IamFinanceDirectory } from '../iam/iam-finance-directory';
import { MfaTotpService } from '../iam/mfa-totp';
import { MasterDataRepository } from '../master-data/master-data.repository';
import { MasterDataService } from '../master-data/master-data.service';
import { MasterDataContactCrypto } from '../master-data/master-data-contact.crypto';
import { SalesRepository } from '../sales/sales.repository';
import { SalesAssistantController } from '../sales/sales-assistant.controller';
import { SalesAssistantConfirmationService } from '../sales/sales-assistant-confirmation.service';
import { CustomerAffairsAssistantController } from '../customer-affairs/customer-affairs-assistant.controller';
import { AssistantReadAccessController } from './assistant-read-access.controller';
import { SalesAgentController } from '../sales/assistant-agent/controller';
import { SalesAgentQueryService } from '../sales/assistant-agent/query.service';
import { ContractCompanyScope } from '../sales/contract-company-scope.public';
import { LegalEntitiesService } from '../legal-entities/legal-entities.service';
import {
  DOCUMENT_TEMPLATE_POLICY_PORT,
  FailClosedDocumentTemplatePolicyAdapter,
} from '../legal-entities/document-template-policy.port';

@Controller('health')
class AssistantReadHealthController {
  @Get() health() {
    return { service: 'erp-assistant-read', readOnly: true };
  }
}

/** ERP-owned read boundary. Do not import full business modules/background dispatchers. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    DatabaseModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('IAM_ACCESS_TOKEN_SECRET'),
        verifyOptions: { issuer: 'nora-api', audience: 'nora-web' },
      }),
    }),
  ],
  controllers: [
    AssistantReadAccessController,
    SalesAgentController,
    AssistantReadHealthController,
    SalesAssistantController,
    CustomerAffairsAssistantController,
  ],
  providers: [
    AuthGuard,
    SalesAgentQueryService,
    ContractCompanyScope,
    LegalEntitiesService,
    FailClosedDocumentTemplatePolicyAdapter,
    {
      provide: DOCUMENT_TEMPLATE_POLICY_PORT,
      useExisting: FailClosedDocumentTemplatePolicyAdapter,
    },
    IamService,
    IamFinanceDirectory,
    MfaTotpService,
    MasterDataRepository,
    MasterDataService,
    MasterDataContactCrypto,
    SalesRepository,
    SalesAssistantConfirmationService,
  ],
})
export class AssistantReadModule {}
