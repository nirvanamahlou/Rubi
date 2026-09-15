import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import type { ProcurementDraftV1 } from '@nora/contracts';
import { ProcurementPolicyPort } from './procurement.ports';

const previous = process.env.SETTINGS_PROCUREMENT_APPROVAL_POLICIES_FILE;
let directory: string | null = null;
afterEach(async () => {
  if (previous === undefined)
    delete process.env.SETTINGS_PROCUREMENT_APPROVAL_POLICIES_FILE;
  else process.env.SETTINGS_PROCUREMENT_APPROVAL_POLICIES_FILE = previous;
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = null;
});

const branchId = randomUUID();
const draft = {
  branchId,
  unitId: 'unit-a',
  category: 'OFFICE',
  currencyCode: 'IRR',
} as ProcurementDraftV1;

it('fails closed without a Settings-owned approved policy artifact', async () => {
  delete process.env.SETTINGS_PROCUREMENT_APPROVAL_POLICIES_FILE;
  expect(await new ProcurementPolicyPort().resolve(draft)).toBeNull();
});

it('selects one exact approved policy and rejects ambiguous or unapproved artifacts', async () => {
  directory = await mkdtemp(join(tmpdir(), 'procurement-policy-'));
  const path = join(directory, 'approved.json');
  process.env.SETTINGS_PROCUREMENT_APPROVAL_POLICIES_FILE = path;
  const policy = {
    id: randomUUID(),
    version: 1,
    source: 'SETTINGS',
    approvedAt: new Date().toISOString(),
    branchId,
    unitId: 'unit-a',
    category: 'OFFICE',
    currencyCode: 'IRR',
    maximumAmount: '1000',
    allowUnknownEstimate: false,
    emergencyAllowed: false,
    minimumQuotations: 1,
    singleSourceAllowed: false,
    steps: [
      {
        userId: randomUUID(),
        maximumAmount: '1000',
        permission: 'procurement.approve',
      },
    ],
  };
  await writeFile(path, JSON.stringify([policy]));
  expect(await new ProcurementPolicyPort().resolve(draft)).toEqual(policy);
  expect(
    await new ProcurementPolicyPort().resolve({ ...draft, category: 'HOTEL' }),
  ).toBeNull();
  await writeFile(
    path,
    JSON.stringify([policy, { ...policy, id: randomUUID() }]),
  );
  expect(await new ProcurementPolicyPort().resolve(draft)).toBeNull();
  await writeFile(path, JSON.stringify([{ ...policy, source: 'LOCAL' }]));
  expect(await new ProcurementPolicyPort().resolve(draft)).toBeNull();
});
