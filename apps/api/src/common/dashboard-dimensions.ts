import { createHash } from 'node:crypto';

/** References have already been authorized by their owning producer. No raw row ID leaves it. */
export function dashboardDimensionKey(kind: string, ...references: string[]) {
  return createHash('sha256')
    .update(JSON.stringify([kind, ...references]))
    .digest('hex');
}
