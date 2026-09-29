import { parseArgs } from 'node:util';
import { createDatabaseClient } from '../src/client';
import { repairPackagePricingAccess } from '../src/package-pricing-access-repair';

async function main() {
  const { values } = parseArgs({
    options: {
      apply: { type: 'boolean', default: false },
      'user-id': { type: 'string' },
      'role-code': { type: 'string' },
      reason: { type: 'string' },
    },
  });
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('This repair is restricted to a local database.');
  }
  const database = createDatabaseClient();
  try {
    const result = await repairPackagePricingAccess(database, {
      userId: values['user-id'] ?? '',
      roleCode: values['role-code'] ?? '',
      reason: values.reason ?? '',
      apply: values.apply,
    });
    console.log(JSON.stringify(result));
  } finally {
    await database.$disconnect();
  }
}

void main().catch(() => {
  // Do not echo connection strings, PII or Prisma request parameters.
  console.error(
    'Pricing access repair failed; no partial change was committed. Check the target role, user and local database.',
  );
  process.exitCode = 1;
});
