import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { environmentValidationSchema } from './config/environment.validation';
import { WorkerHealthService } from './worker-health.service';
import { WorkerHealthServer } from './worker-health-server';

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
  ],
  providers: [WorkerHealthService, WorkerHealthServer],
})
export class WorkerModule {}
