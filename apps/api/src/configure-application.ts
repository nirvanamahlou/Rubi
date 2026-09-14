import { Logger, ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { parseCommaSeparatedList } from '@nora/config';

import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { requestIdMiddleware } from './common/request-id.middleware';

export function configureApplication(app: INestApplication): void {
  const config = app.get(ConfigService);
  const apiPrefix = config
    .getOrThrow<string>('API_PREFIX')
    .replace(/^\/+|\/+$/g, '');
  const corsOrigins = parseCommaSeparatedList(
    config.getOrThrow<string>('CORS_ORIGINS'),
  );

  app.use(requestIdMiddleware);
  app.setGlobalPrefix(apiPrefix);
  app.enableCors({
    credentials: true,
    exposedHeaders: [
      'X-Nora-Manifest-Contracts',
      'X-Nora-Manifest-Passengers',
      'X-Nora-Manifest-Skipped-Finance',
    ],
    origin: corsOrigins,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
  app.enableShutdownHooks();

  if (config.getOrThrow<boolean>('ENABLE_SWAGGER')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Nora Airline CRM API')
      .setDescription('Nora API including versioned IAM contracts')
      .setVersion('1.0')
      .addCookieAuth('nora_access')
      .build();
    const documentFactory = () =>
      SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, documentFactory);
  }

  Logger.log(`API configured with prefix /${apiPrefix}`, 'Bootstrap');
}
