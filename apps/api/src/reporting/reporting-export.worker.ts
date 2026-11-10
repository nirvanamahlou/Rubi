import {
  isMarkedAsUntransferable,
  parentPort,
  workerData,
} from 'node:worker_threads';

import { build } from './reporting-export-renderer';

const { format, result, reportName } = workerData as {
  format: Parameters<typeof build>[0];
  result: Parameters<typeof build>[1];
  reportName: string;
};
const { buffer, ...file } = build(format, result, reportName);
const backing = buffer.buffer;
// Never transfer an entire allocator slab or unrelated bytes outside a slice.
const bytes =
  backing instanceof ArrayBuffer &&
  buffer.byteOffset === 0 &&
  buffer.byteLength === backing.byteLength &&
  !isMarkedAsUntransferable(backing)
    ? new Uint8Array(backing)
    : Uint8Array.from(buffer);
parentPort!.postMessage({ ...file, buffer: bytes }, [bytes.buffer]);
