import 'reflect-metadata';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createDatabaseClient } from '@nora/database';
import { MANUAL_ACCESS_VERSION } from '@nora/contracts';
import { manualAccessCatalogFingerprint } from '../src/iam/manual-access-policy';
import {
  applyManualAccessMigration,
  planManualAccessMigration,
} from '../src/iam/manual-access-migration';

async function main() {
  const { values } = parseArgs({
    options: {
      preview: { type: 'string' },
      apply: { type: 'string' },
      'expected-database': { type: 'string' },
      receipt: { type: 'string' },
      'runtime-url': { type: 'string', multiple: true },
    },
  });
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('Local database required');
  if (decodeURIComponent(url.pathname.slice(1)) !== values['expected-database'])
    throw new Error('Exact database name required');
  if (Boolean(values.preview) === Boolean(values.apply))
    throw new Error('Choose preview or apply');
  if (values.apply && !values.receipt) throw new Error('Receipt path required');
  const db = createDatabaseClient();
  try {
    if (values.preview) {
      const plan = await planManualAccessMigration(db);
      await writeFile(values.preview, JSON.stringify(plan, null, 2), {
        encoding: 'utf8',
        flag: 'wx',
      });
      console.log(
        JSON.stringify({
          mode: 'preview',
          users: plan.rows.length,
          fingerprint: plan.fingerprint,
        }),
      );
    } else {
      if (!values['runtime-url']?.length)
        throw new Error(
          'List every active API runtime before applying shared-database permissions',
        );
      for (const address of values['runtime-url']) {
        const runtime = new URL(address);
        if (!['localhost', '127.0.0.1', '[::1]'].includes(runtime.hostname))
          throw new Error('Only local runtime verification is supported');
        const response = await fetch(
          address.replace(/\/$/, '') + '/iam/access-version',
          { redirect: 'error', signal: AbortSignal.timeout(10000) },
        );
        if (!response.ok)
          throw new Error('Runtime is not upgraded: ' + runtime.origin);
        const capability = (await response.json()) as {
          version?: string;
          catalogFingerprint?: string;
        };
        if (
          capability.version !== MANUAL_ACCESS_VERSION ||
          capability.catalogFingerprint !== manualAccessCatalogFingerprint()
        )
          throw new Error(
            'Runtime permission catalog mismatch: ' + runtime.origin,
          );
      }
      const plan = JSON.parse(await readFile(values.apply!, 'utf8')) as {
        fingerprint: string;
      };
      // Reserve receipt before mutation so an unwritable/existing path cannot conceal completion.
      await writeFile(
        values.receipt!,
        JSON.stringify({ status: 'started', fingerprint: plan.fingerprint }),
        { flag: 'wx' },
      );
      const receipt = await applyManualAccessMigration(db, plan.fingerprint);
      await writeFile(values.receipt!, JSON.stringify(receipt, null, 2));
      console.log(JSON.stringify(receipt));
    }
  } finally {
    await db.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]')
      : 'Migration failed',
  );
  process.exitCode = 1;
});
