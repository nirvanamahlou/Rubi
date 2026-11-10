import { parentPort, workerData } from 'node:worker_threads';

import { build } from './reporting-export-renderer';

const { format, result, reportName } = workerData as {
  format: Parameters<typeof build>[0];
  result: Parameters<typeof build>[1];
  reportName: string;
};
const file = build(format, result, reportName);
parentPort!.postMessage(file);
