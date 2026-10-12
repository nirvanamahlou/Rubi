import { randomUUID } from 'node:crypto';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { DatabaseService } from '../src/database/database.service';
import { CorrespondenceNumberingService } from '../src/system-management/correspondence-numbering';

const url = process.env.CORRESPONDENCE_TEST_DATABASE_URL;
describe.skipIf(!url)('correspondence numbering on isolated PostgreSQL', () => {
  let db: DatabaseClient;
  let service: CorrespondenceNumberingService;
  const actor = randomUUID();
  beforeAll(() => {
    const target = new URL(url!);
    if (
      !['localhost', '127.0.0.1'].includes(target.hostname) ||
      target.port !== '55441' ||
      target.pathname !== '/correspondence_test'
    )
      throw new Error('Dedicated correspondence test database required.');
    db = createDatabaseClient(url);
    service = new CorrespondenceNumberingService({
      client: db,
    } as DatabaseService);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });
  it('serializes concurrent issues, replays simultaneous retries and separates brands', async () => {
    const keys = Array.from({ length: 8 }, () => randomUUID());
    const results = await Promise.all(
      keys.map((idempotencyKey) =>
        service.issue(
          { companyId: 'niayesh', date: '2026-10-12', idempotencyKey },
          actor,
        ),
      ),
    );
    expect(new Set(results.map((result) => result.number)).size).toBe(8);
    const replays = await Promise.all(
      Array.from({ length: 4 }, () =>
        service.issue(
          { companyId: 'niayesh', date: '2026-10-12', idempotencyKey: keys[0] },
          actor,
        ),
      ),
    );
    expect(
      replays.every((result) => result.number === results[0]!.number),
    ).toBe(true);
    const other = await service.issue(
      { companyId: 'jahan', date: '2026-10-12', idempotencyKey: keys[0] },
      actor,
    );
    expect(other.number).toMatch(/^JB\/1405\/07\/20\//);
    expect(
      await db.systemIssuedNumber.count({ where: { actorUserId: actor } }),
    ).toBe(9);
    expect(
      await db.systemAuditEvent.count({
        where: { actorUserId: actor, action: 'correspondence.number.issue' },
      }),
    ).toBe(9);
  }, 30000);
});
