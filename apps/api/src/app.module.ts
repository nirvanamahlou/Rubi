import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { environmentValidationSchema } from './config/environment.validation';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { IamModule } from './iam/iam.module';

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
    IamModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
