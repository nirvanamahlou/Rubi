/** Run only after migration and API build. No private content is printed. Resumable in batches. */
const { Client } = require('../../packages/database/node_modules/pg');
const { ConfigService } = require('../../apps/api/node_modules/@nestjs/config');
const {
  CallCenterCrypto,
} = require('../../apps/api/dist/customer-affairs/call-center.crypto');
const {
  callSearchMetadata,
} = require('../../apps/api/dist/customer-affairs/call-center-search');
async function main() {
  const url = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1'].includes(url.hostname))
    throw Error('Explicit reviewed non-local rollout required');
  const crypto = new CallCenterCrypto(new ConfigService(process.env));
  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  let count = 0;
  try {
    for (;;) {
      await db.query('BEGIN');
      try {
        const rows = (
          await db.query(
            'SELECT a.*,c.branch_id FROM customer_affairs_calls a JOIN customer_affairs_call_contacts c ON c.id=a.contact_id WHERE a.search_version=0 ORDER BY a.id LIMIT 100 FOR UPDATE OF a SKIP LOCKED',
          )
        ).rows;
        if (!rows.length) {
          await db.query('COMMIT');
          break;
        }
        for (const row of rows) {
          const data = crypto.decrypt(
            row.encrypted_payload,
            row.key_version,
            `call:${row.id}:${row.contact_id}`,
          );
          const index = callSearchMetadata(
            crypto,
            row.branch_id,
            data,
            row.outcome,
          );
          await db.query(
            'UPDATE customer_affairs_calls SET search_tokens=$1,source_token=$2,unit_token=$3,needs_completion=$4,search_version=1 WHERE id=$5',
            [
              index.searchTokens,
              index.sourceToken,
              index.unitToken,
              index.needsCompletion,
              row.id,
            ],
          );
        }
        await db.query('COMMIT');
        count += rows.length;
      } catch (e) {
        await db.query('ROLLBACK');
        throw e;
      }
    }
    console.log('Indexed records:', count);
  } finally {
    await db.end();
  }
}
main().catch(() => {
  console.error('Index backfill failed; private details withheld.');
  process.exitCode = 1;
});
