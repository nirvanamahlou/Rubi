import { randomUUID } from 'node:crypto';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';
import type { DatabaseService } from '../src/database/database.service';
import { IamCorrespondenceDirectory } from '../src/iam/iam-correspondence-directory';
import { InternalCorrespondenceService } from '../src/system-management/internal-correspondence';
import { CorrespondenceNumberingService } from '../src/system-management/correspondence-numbering';
const url = process.env.CORRESPONDENCE_MULTI_TEST_DATABASE_URL;
describe.skipIf(!url)(
  'multi-recipient correspondence isolated PostgreSQL',
  { timeout: 30000 },
  () => {
    let db: DatabaseClient,
      service: InternalCorrespondenceService,
      numbering: CorrespondenceNumberingService;
    let ids: string[] = [];
    beforeAll(async () => {
      const target = new URL(url!);
      if (
        !['localhost', '127.0.0.1'].includes(target.hostname) ||
        target.port !== '55593' ||
        target.pathname !== '/nora_ci'
      )
        throw new Error('Dedicated correspondence test database required.');
      db = createDatabaseClient(url);
      const database = { client: db } as DatabaseService;
      service = new InternalCorrespondenceService(
        database,
        new IamCorrespondenceDirectory(database),
      );
      numbering = new CorrespondenceNumberingService(database);
    }, 60000);
    beforeEach(async () => {
      ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
      for (const [index, id] of ids.entries())
        await db.user.create({
          data: {
            id,
            username: `letter-${id}`,
            displayName: `Synthetic ${index}`,
            passwordHash: 'not-a-login-hash',
            status: index === 3 ? 'INACTIVE' : 'ACTIVE',
          },
        });
    }, 60000);
    afterEach(async () => {
      await db.correspondenceLetter.deleteMany({
        where: { authorId: { in: ids } },
      });
      await db.user.deleteMany({ where: { id: { in: ids } } });
    }, 60000);
    afterAll(async () => {
      await db?.$disconnect();
    }, 60000);
    async function payload() {
      const number = await numbering.issue(
        {
          companyId: 'niayesh',
          date: '2026-10-18',
          idempotencyKey: randomUUID(),
        },
        ids[0]!,
      );
      return {
        letter: {
          company: 'نیایش سیر',
          recipient: 'Synthetic recipient',
          sender: 'Synthetic sender',
          subject: 'Internal test',
          date: number.date,
          number: number.number,
          signer: '',
          text: 'Synthetic body',
          template: '{{متن}}',
        },
        dateISO: '2026-10-18',
        recipientId: ids[1],
        requestKey: randomUUID(),
      };
    }
    it('sends exactly once under parallel retries and exposes only the destination inbox', async () => {
      const input = await payload();
      const results = await Promise.all(
        Array.from({ length: 4 }, () => service.send(ids[0]!, input)),
      );
      expect(new Set(results.map((result) => result.id)).size).toBe(1);
      const recipient = await service.list(ids[1]!, {});
      expect(recipient.items).toHaveLength(1);
      expect(recipient.kpis.unread).toBe(1);
      expect((await service.list(ids[2]!, {})).items).toHaveLength(0);
      await expect(service.detail(ids[2]!, results[0]!.id)).rejects.toThrow();
      await service.read(ids[1]!, results[0]!.id);
      expect((await service.list(ids[1]!, {})).kpis.unread).toBe(0);
    });
    it('supports recipient editing, conflicts, forwarding statuses, filtering and global hard deletion', async () => {
      const created = await service.send(ids[0]!, await payload());
      const row = await service.detail(ids[1]!, created.id);
      const letter = {
        ...(row.letter as object),
        subject: 'Edited by recipient',
      };
      await service.edit(ids[1]!, row.id, { version: row.version, letter });
      await expect(
        service.edit(ids[1]!, row.id, { version: row.version, letter }),
      ).rejects.toThrow('نامه تغییر کرده');
      const updated = await service.detail(ids[1]!, row.id);
      const command = {
        version: updated.version,
        recipientId: ids[2],
        status: 'NEEDS_CORRECTION',
        requestKey: randomUUID(),
      };
      await Promise.all(
        Array.from({ length: 3 }, () =>
          service.forward(ids[1]!, row.id, command),
        ),
      );
      const inbox = await service.list(ids[2]!, {
        status: 'NEEDS_CORRECTION',
        search: 'Edited',
      });
      expect(inbox.items).toHaveLength(1);
      expect(inbox.kpis.needsCorrection).toBe(1);
      expect(
        (await service.list(ids[2]!, { status: 'APPROVED' })).items,
      ).toHaveLength(0);
      for (const status of ['APPROVED', 'REJECTED'] as const) {
        await service.read(ids[2]!, row.id);
        const current = await service.detail(ids[1]!, row.id);
        await service.forward(ids[1]!, row.id, {
          version: current.version,
          recipientId: ids[2],
          status,
          requestKey: randomUUID(),
        });
        const again = await service.list(ids[2]!, { status });
        expect(again.items).toHaveLength(1);
        expect(again.kpis.unread).toBe(1);
        expect((await service.list(ids[1]!, { status })).items).toHaveLength(1);
      }
      const fresh = await service.detail(ids[2]!, row.id);
      await service.remove(ids[2]!, row.id, { version: fresh.version });
      expect(
        await db.correspondenceDelivery.count({ where: { letterId: row.id } }),
      ).toBe(0);
      expect((await service.list(ids[1]!, {})).items).toHaveLength(0);
      expect(
        await db.systemAuditEvent.count({
          where: { entityId: row.id, action: 'correspondence.delete' },
        }),
      ).toBe(1);
    });
    it('atomically delivers once to multiple recipients and rejects changed replay sets', async () => {
      const base = await payload();
      const input = { ...base, recipientIds: [ids[1], ids[2], ids[1]] };
      const results = await Promise.all([
        service.send(ids[0]!, input),
        service.send(ids[0]!, input),
      ]);
      expect(results[0]).toEqual(results[1]);
      expect(
        await db.correspondenceDelivery.count({
          where: { letterId: results[0]!.id },
        }),
      ).toBe(2);
      expect((await service.list(ids[1]!, {})).items).toHaveLength(1);
      expect((await service.list(ids[2]!, {})).items).toHaveLength(1);
      await expect(
        service.send(ids[0]!, { ...input, recipientIds: [ids[1]] }),
      ).rejects.toThrow();
      const invalid = await payload();
      await expect(
        service.send(ids[0]!, { ...invalid, recipientIds: [ids[1], ids[3]] }),
      ).rejects.toThrow();
      expect(
        await db.correspondenceLetter.count({
          where: { number: invalid.letter.number },
        }),
      ).toBe(0);
    });
    it('forwards descriptions to every selected destination, with atomic validation and replay', async () => {
      const created = await service.send(ids[0]!, await payload());
      const input = {
        version: 1,
        recipientIds: [ids[0], ids[2]],
        status: 'APPROVED',
        description: 'Please review the attachment.',
        requestKey: randomUUID(),
      };
      await Promise.all([
        service.forward(ids[1]!, created.id, input),
        service.forward(ids[1]!, created.id, input),
      ]);
      for (const recipient of [ids[0]!, ids[2]!]) {
        const inbox = await service.list(recipient, {});
        expect(inbox.items[0]!.delivery.description).toBe(input.description);
        expect(
          (await service.detail(recipient, created.id)).delivery?.description,
        ).toBe(input.description);
      }
      await expect(
        service.forward(ids[1]!, created.id, {
          ...input,
          description: 'Changed',
        }),
      ).rejects.toThrow();
      const current = await service.detail(ids[1]!, created.id);
      await expect(
        service.forward(ids[1]!, created.id, {
          ...input,
          version: current.version,
          requestKey: randomUUID(),
          recipientIds: [ids[0], ids[3]],
        }),
      ).rejects.toThrow();
      expect((await service.detail(ids[1]!, created.id)).version).toBe(
        current.version,
      );
    });
    it('rejects inactive recipients, unissued numbers and foreign edits without creating records', async () => {
      const input = await payload();
      await expect(
        service.send(ids[0]!, { ...input, recipientId: ids[3] }),
      ).rejects.toThrow();
      await expect(
        service.send(ids[0]!, {
          ...input,
          letter: { ...input.letter, number: 'forged' },
        }),
      ).rejects.toThrow();
      const created = await service.send(ids[0]!, input);
      await expect(
        service.edit(ids[2]!, created.id, { version: 1, letter: input.letter }),
      ).rejects.toThrow();
      const directory = await service.users();
      expect(directory.some((user) => user.id === ids[3])).toBe(false);
      expect(
        Object.keys(directory.find((user) => user.id === ids[1])!).sort(),
      ).toEqual(['displayName', 'id', 'username']);
    });
  },
);
