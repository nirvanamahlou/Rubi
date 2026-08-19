import { Logger, ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { parseCommaSeparatedList } from '@rubi/config';

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
      .setTitle('Rubi Airline CRM API')
      .setDescription('Technical Bootstrap API surface')
      .setVersion('1.0')
      .build();
    const documentFactory = () =>
      SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, documentFactory);
  }

  Logger.log(`API configured with prefix /${apiPrefix}`, 'Bootstrap');
}
