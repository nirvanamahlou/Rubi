import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { environmentValidationSchema } from './config/environment.validation';
import { CustomersModule } from './customers/customers.module';
import { DatabaseModule } from './database/database.module';
import { DocumentsModule } from './documents/documents.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { IamModule } from './iam/iam.module';
import { LegalEntitiesModule } from './legal-entities/legal-entities.module';
import { MasterDataModule } from './master-data/master-data.module';
import { SalesModule } from './sales/sales.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
      validationSchema: environmentValidationSchema,
    }),
    DatabaseModule,
    DocumentsModule,
    CustomersModule,
    MasterDataModule,
    IamModule,
    LegalEntitiesModule,
    SalesModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
