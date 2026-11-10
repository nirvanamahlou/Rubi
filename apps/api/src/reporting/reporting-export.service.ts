import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { Inject, Injectable } from '@nestjs/common';

import { LocalDocumentStorage } from '../documents/documents.storage';
import type { TravelReportResultV1 } from './reporting.contracts';
import { build } from './reporting-export-renderer';

@Injectable()
export class ReportingExportService {
  constructor(
    @Inject(LocalDocumentStorage)
    private readonly storage: LocalDocumentStorage,
  ) {}

  build = build;

  async buildInWorker(
    format: 'CSV' | 'XLSX' | 'PDF',
    result: TravelReportResultV1,
    reportName: string,
  ): Promise<ReturnType<typeof build>> {
    const extension = extname(__filename);
    const worker = new Worker(
      join(__dirname, 'reporting-export.worker' + extension),
      {
        workerData: { format, result, reportName },
        execArgv:
          extension === '.ts' ? ['--require', require.resolve('tsx/cjs')] : [],
      },
    );
    try {
      return await new Promise<ReturnType<typeof build>>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Report rendering timed out')),
          90000,
        );
        const fail = (error: Error) => {
          clearTimeout(timer);
          reject(error);
        };
        worker.once('error', fail);
        worker.once('exit', (code) =>
          fail(new Error('Report renderer exited: ' + code)),
        );
        worker.once(
          'message',
          (
            file: Omit<ReturnType<typeof build>, 'buffer'> & {
              buffer: Uint8Array<ArrayBuffer>;
            },
          ) => {
            clearTimeout(timer);
            resolve({
              ...file,
              buffer: Buffer.from(
                file.buffer.buffer,
                file.buffer.byteOffset,
                file.buffer.byteLength,
              ),
            });
          },
        );
      });
    } finally {
      await worker.terminate();
    }
  }

  async store(exportId: string, _extension: string, buffer: Buffer) {
    // Reporting artifacts share the encrypted Documents quarantine. Keep the
    // object key on the single versioned contract accepted by that boundary;
    // the user-facing extension remains in export metadata, not the blob key.
    const objectKey = `documents/${exportId}/v1/${randomUUID()}.bin`;
    await this.storage.putQuarantined(objectKey, buffer);
    return objectKey;
  }

  open(objectKey: string, expectedSizeBytes: number) {
    return this.storage.openQuarantined(objectKey, expectedSizeBytes);
  }
}
