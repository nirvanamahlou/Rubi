import { on } from 'node:events';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { Inject, Injectable } from '@nestjs/common';

import { LocalDocumentStorage } from '../documents/documents.storage';
import type { TravelReportResultV1 } from './reporting.contracts';
import { build, renderReport } from './reporting-export-renderer';

type ReportFormat = Parameters<typeof renderReport>[0];
type RenderMetadata = ReturnType<typeof renderReport>;
type WorkerMessage =
  | { type: 'chunk'; bytes: Uint8Array }
  | { type: 'complete'; metadata: RenderMetadata };

@Injectable()
export class ReportingExportService {
  constructor(
    @Inject(LocalDocumentStorage)
    private readonly storage: LocalDocumentStorage,
  ) {}

  build = build;

  async buildInWorker(
    format: ReportFormat,
    result: TravelReportResultV1,
    reportName: string,
  ): Promise<ReturnType<typeof build>> {
    const chunks: Uint8Array[] = [];
    const metadata = await this.consumeWorker(
      format,
      result,
      reportName,
      async (source) => {
        for await (const chunk of source) chunks.push(chunk);
      },
    );
    const { sizeBytes, ...file } = metadata;
    return { ...file, buffer: Buffer.concat(chunks, sizeBytes) };
  }

  async buildAndStore(
    exportId: string,
    format: ReportFormat,
    result: TravelReportResultV1,
    reportName: string,
  ) {
    const objectKey = this.objectKey(exportId);
    const metadata = await this.consumeWorker(
      format,
      result,
      reportName,
      (source) => this.storage.putQuarantinedStream(objectKey, source),
    );
    return { ...metadata, objectKey };
  }

  private async consumeWorker(
    format: ReportFormat,
    result: TravelReportResultV1,
    reportName: string,
    consume: (source: AsyncIterable<Uint8Array>) => Promise<void>,
  ) {
    const extension = extname(__filename);
    const renderInput: Parameters<typeof build>[1] = {
      reportCode: result.reportCode,
      generatedAtUtc: result.generatedAtUtc,
      sourceProjection: result.sourceProjection,
      total: result.total,
      grain: result.grain,
      filterSnapshot: result.filterSnapshot,
      columns: format === 'PDF' ? [] : result.columns,
      rows: format === 'PDF' ? [] : result.rows,
      ...(format === 'XLSX' && result.columnFilters
        ? {
            columnFilters: result.columnFilters.map(({ key, label }) => ({
              key,
              label,
              options: [],
            })),
          }
        : {}),
    };
    const acknowledgment = new Int32Array(new SharedArrayBuffer(4));
    const worker = new Worker(
      join(__dirname, 'reporting-export.worker' + extension),
      {
        workerData: { format, result: renderInput, reportName, acknowledgment },
        execArgv:
          extension === '.ts' ? ['--require', require.resolve('tsx/cjs')] : [],
      },
    );
    const messages = on(worker, 'message', {
      close: ['exit'],
      signal: AbortSignal.timeout(90_000),
    });
    let metadata: RenderMetadata | undefined;
    let sizeBytes = 0;
    async function* chunks() {
      for await (const [payload] of messages) {
        const message = payload as WorkerMessage;
        if (message.type === 'complete') {
          metadata = message.metadata;
          return;
        }
        sizeBytes += message.bytes.byteLength;
        yield message.bytes;
        Atomics.store(acknowledgment, 0, 1);
        Atomics.notify(acknowledgment, 0);
      }
      throw new Error('Report renderer exited before completion');
    }
    try {
      await consume(chunks());
      if (!metadata) throw new Error('Report output was not fully consumed');
      return { ...metadata, sizeBytes };
    } finally {
      await messages.return?.();
      await worker.terminate();
    }
  }

  private objectKey(exportId: string) {
    return `documents/${exportId}/v1/${randomUUID()}.bin`;
  }

  async store(exportId: string, _extension: string, buffer: Buffer) {
    const objectKey = this.objectKey(exportId);
    await this.storage.putQuarantined(objectKey, buffer);
    return objectKey;
  }

  discard(objectKey: string) {
    return this.storage.removeQuarantined(objectKey);
  }

  open(objectKey: string, expectedSizeBytes: number) {
    return this.storage.openQuarantined(objectKey, expectedSizeBytes);
  }
}
