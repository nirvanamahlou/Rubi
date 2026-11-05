// Run from apps/api with the deployed API environment. Preview is the default.
// No contact values or credentials are printed. Applies only derived flags.
require('reflect-metadata');
const { ConfigService } = require('@nestjs/config');
const { createDatabaseClient } = require('@nora/database');
const {
  CallCenterCrypto,
} = require('../dist/customer-affairs/call-center.crypto');
const {
  reconcileCallCompletion,
} = require('../dist/customer-affairs/call-center-completion-repair');

async function main() {
  const args = process.argv.slice(2);
  if (
    args.some((arg) => !['--preview', '--apply'].includes(arg)) ||
    args.length > 1
  )
    throw new Error('Use --preview (default) or --apply');
  const apply = args[0] === '--apply';
  const db = createDatabaseClient(process.env.DATABASE_URL);
  try {
    const crypto = new CallCenterCrypto(new ConfigService(process.env));
    const counts = {};
    let cursor;
    do {
      const rows = await db.callCenterCall.findMany({
        where: {
          needsCompletion: true,
          origin: { not: 'SYNTHETIC' },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 100,
      });
      if (!rows.length) break;
      for (const row of rows) {
        const status = await reconcileCallCompletion(db, crypto, row.id, apply);
        counts[status] = (counts[status] ?? 0) + 1;
      }
      cursor = rows.at(-1).id;
    } while (cursor);
    process.stdout.write(
      JSON.stringify({ mode: apply ? 'apply' : 'preview', counts }) + '\n',
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  process.stderr.write(
    'Completion reconciliation failed; no private data logged. Review operator logs before retry.\n',
  );
  process.exitCode = 1;
});
