import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DatabaseService } from '../database/database.service';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { WindowsDefenderAntivirus } from './documents.antivirus';
import { DocumentsRepository } from './documents.repository';
import {
  DocumentsScanProcessor,
  STANDALONE_DOCUMENT_SCANNER,
} from './documents.scan-processor';
import { LocalDocumentStorage } from './documents.storage';

/** A real local ClamAV/Defender scanner. No HTTP server or unrelated workers. */
@Module({
  imports: [ConfigModule.forRoot({ ignoreEnvFile: true })],
  providers: [
    DatabaseService,
    NotificationsRepository,
    NotificationsService,
    DocumentsRepository,
    LocalDocumentStorage,
    WindowsDefenderAntivirus,
    DocumentsScanProcessor,
    { provide: STANDALONE_DOCUMENT_SCANNER, useValue: true },
  ],
})
class DocumentScanWorkerModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(
    DocumentScanWorkerModule,
    { logger: false, abortOnError: false },
  );
  if (!app.get(DocumentsScanProcessor).available) {
    await app.close();
    throw new Error(
      'Configure a real ClamAV or Windows Defender adapter before starting this worker.',
    );
  }
  if (process.argv.includes('--once')) {
    await app.close();
    return;
  }
  // Processor interval is intentionally unref-ed for the API; keep this standalone process alive.
  const keepAlive = setInterval(() => undefined, 60_000);
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    clearInterval(keepAlive);
    await app.close();
  };
  process.once('SIGINT', () => void close());
  process.once('SIGTERM', () => void close());
  process.stdout.write('Document antivirus worker is running.\n');
}

void main().catch(() => {
  // Configuration/DB errors can contain credentials; never echo them.
  process.stderr.write(
    'Document antivirus worker could not start; check private runtime configuration.\n',
  );
  process.exitCode = 1;
});
