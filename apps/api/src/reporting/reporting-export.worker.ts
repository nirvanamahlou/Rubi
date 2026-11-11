import { parentPort, workerData } from 'node:worker_threads';

import { renderReport } from './reporting-export-renderer';

const { format, result, reportName, acknowledgment } = workerData as {
  format: Parameters<typeof renderReport>[0];
  result: Parameters<typeof renderReport>[1];
  reportName: string;
  acknowledgment: Int32Array<SharedArrayBuffer>;
};

const metadata = renderReport(format, result, reportName, (output) => {
  for (let offset = 0; offset < output.length; offset += 64 * 1024) {
    const bytes = Uint8Array.from(output.subarray(offset, offset + 64 * 1024));
    Atomics.store(acknowledgment, 0, 0);
    parentPort!.postMessage({ type: 'chunk', bytes }, [bytes.buffer]);
    // Wait only in the rendering worker while the parent consumes this chunk.
    if (Atomics.wait(acknowledgment, 0, 0, 90_000) === 'timed-out')
      throw new Error('Report output consumer timed out');
  }
});
parentPort!.postMessage({ type: 'complete', metadata });
