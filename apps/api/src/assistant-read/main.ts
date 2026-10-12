import 'reflect-metadata';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';
import { AssistantReadModule } from './assistant-read.module';
import { DatabaseService } from '../database/database.service';
import { AllExceptionsFilter } from '../common/all-exceptions.filter';
import { requestIdMiddleware } from '../common/request-id.middleware';

export function readOnlyDatabaseUrl(input: string | undefined): string {
  if (!input) throw new Error('READ_DATABASE_CONFIGURATION_REQUIRED');
  const url = new URL(input);
  if (!['postgresql:', 'postgres:'].includes(url.protocol))
    throw new Error('READ_DATABASE_CONFIGURATION_INVALID');
  url.searchParams.set(
    'options',
    '-c default_transaction_read_only=on -c statement_timeout=2500',
  );
  return url.toString();
}
export async function startAssistantRead() {
  process.env.DATABASE_URL = readOnlyDatabaseUrl(process.env.DATABASE_URL);
  const port = Number(process.env.ERP_ASSISTANT_READ_PORT ?? 4301);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('READ_PORT_INVALID');
  const app = await NestFactory.create(AssistantReadModule, {
    logger: false,
    abortOnError: false,
  });
  app.use(requestIdMiddleware);
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.status(405).json({ error: { code: 'READ_ONLY' } });
      return;
    }
    next();
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
  app.enableShutdownHooks();
  try {
    const setting = await app.get(DatabaseService).client.$queryRaw<
      Array<{ default_transaction_read_only: string }>
    >`SHOW default_transaction_read_only`;
    if (setting[0]?.default_transaction_read_only !== 'on')
      throw new Error('READ_DATABASE_ENFORCEMENT_FAILED');
    await app.listen(port, '127.0.0.1');
    return app;
  } catch {
    await app.close();
    throw new Error('READ_API_STARTUP_FAILED');
  }
}
if (require.main === module)
  void startAssistantRead()
    .then(() =>
      process.stdout.write('ERP assistant read API ready on loopback\n'),
    )
    .catch(() => {
      process.stderr.write(
        'ERP assistant read API startup failed; check private deployment configuration\n',
      );
      process.exitCode = 1;
    });
