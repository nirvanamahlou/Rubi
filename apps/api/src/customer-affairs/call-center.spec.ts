import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedActor } from '@nora/contracts';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CallCenterCrypto } from './call-center.crypto';
import { normalizedCallPhone, CallCenterService } from './call-center.service';
import type { CallCenterCallDto } from './call-center.dto';

const config = new ConfigService({
  CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString(
    'base64',
  ),
  CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 9).toString(
    'base64',
  ),
  CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
});
const crypto = new CallCenterCrypto(config);
const callInput = (): CallCenterCallDto => ({
  id: randomUUID(),
  phone: '09120000001',
  name: 'Synthetic caller',
  subject: 'Synthetic travel request',
  source: 'گوگل',
  operator: 'واحد ویزا',
  direction: 'INBOUND',
  status: 'جدید',
  occurredAt: '2026-10-18T10:00:00.000Z',
  note: 'Synthetic call summary',
});
describe('Call Center private payloads', () => {
  it('normalizes equivalent Iranian numbers and rejects malformed phones', () => {
    expect(normalizedCallPhone('+98 (912) 000-0001')).toBe('09120000001');
    expect(normalizedCallPhone('٠٩١٢٠٠٠٠٠٠١')).toBe('09120000001');
    expect(normalizedCallPhone('۲۲۳۳۴۴۵۵')).toBe('22334455');
    expect(normalizedCallPhone('123')).toBe('123');
    expect(() => normalizedCallPhone('123abc')).toThrow();
    expect(() => normalizedCallPhone('1'.repeat(16))).toThrow();
  });
  it('encrypts private values with row identity and detects tampering/substitution', () => {
    const encoded = crypto.encrypt(
      { phone: '09120000001' },
      'call:one:contact',
    );
    expect(encoded).not.toContain('09120000001');
    expect(crypto.decrypt(encoded, 1, 'call:one:contact')).toEqual({
      phone: '09120000001',
    });
    expect(() => crypto.decrypt(encoded, 1, 'call:two:contact')).toThrow();
    expect(() => crypto.decrypt(encoded, 2, 'call:one:contact')).toThrow();
    expect(() =>
      crypto.decrypt(encoded.slice(0, -4) + 'AAAA', 1, 'call:one:contact'),
    ).toThrow();
  });
});

describe.skipIf(process.env.NORA_RUN_CALL_CENTER_POSTGRES_TESTS !== '1')(
  'durable Call Center PostgreSQL workflow',
  () => {
    let client: DatabaseClient, service: CallCenterService;
    const branchId = randomUUID(),
      otherBranch = randomUUID(),
      userId = randomUUID();
    const actor = {
      userId,
      branchIds: [branchId],
      permissions: [
        'customer_affairs.call_center.read',
        'customer_affairs.call_center.calls.create',
        'customer_affairs.call_center.notes.create',
      ],
    } as AuthenticatedActor;
    let contactId = '';
    const original = callInput();
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        !['localhost', '127.0.0.1'].includes(url.hostname) ||
        ![
          '/nora_call_center_package_one_test_1019',
          '/nora_call_center_test_1018',
          '/nora_ci',
        ].includes(url.pathname)
      )
        throw Error('Only disposable named local/CI databases allowed.');
      client = createDatabaseClient(url.toString());
      await client.branch.createMany({
        data: [branchId, otherBranch].map((id) => ({
          id,
          code: 'cc-' + id,
          name: 'Synthetic Call Center branch',
        })),
      });
      await client.user.create({
        data: {
          id: userId,
          username: 'cc-' + userId,
          displayName: 'Synthetic Call Center actor',
          passwordHash: 'not-a-login-hash',
          status: 'ACTIVE',
        },
      });
      service = new CallCenterService({ client } as never, crypto);
    });
    afterAll(async () => {
      await client?.$disconnect();
    });
    it('commits exactly one call and audit under ten concurrent retries', async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          service.create(original, actor, branchId),
        ),
      );
      contactId = results[0]!.data.contactId;
      expect(new Set(results.map((r) => r.data.id)).size).toBe(1);
      expect(
        await client.callCenterCall.count({ where: { id: original.id } }),
      ).toBe(1);
      expect(
        await client.customerAffairsAuditEvent.count({
          where: { entityId: original.id },
        }),
      ).toBe(1);
      const row = await client.callCenterCall.findUniqueOrThrow({
        where: { id: original.id },
      });
      for (const text of [original.phone, original.name, original.note])
        expect(row.encryptedPayload).not.toContain(text);
      await expect(
        service.create(
          { ...original, subject: 'Different payload' },
          actor,
          branchId,
        ),
      ).rejects.toMatchObject({ status: 409 });
    });
    it('groups normalized follow-ups within one branch and preserves call chronology', async () => {
      await service.create(
        {
          ...original,
          id: randomUUID(),
          phone: '+989120000001',
          direction: 'OUTBOUND',
          occurredAt: '2026-10-19T10:00:00Z',
        },
        actor,
        branchId,
      );
      await service.create(
        {
          ...original,
          id: randomUUID(),
          phone: '۰۰۹۸۹۱۲۰۰۰۰۰۰۱',
          occurredAt: '2026-10-17T10:00:00Z',
        },
        actor,
        branchId,
      );
      const result = await service.list(actor, branchId, {
        page: 1,
        pageSize: 50,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.calls).toHaveLength(1);
      expect(result.data[0]!.calls.map((call) => call.occurredAt)).toEqual([
        '2026-10-19T10:00:00.000Z',
      ]);
      await service.create(
        { ...original, id: randomUUID() },
        { ...actor, branchIds: [otherBranch] },
        otherBranch,
      );
      expect(
        (
          await service.list(
            { ...actor, branchIds: [otherBranch] },
            otherBranch,
            { page: 1, pageSize: 50 },
          )
        ).data[0]!.id,
      ).not.toBe(contactId);
    });
    it('keeps notes replay-safe, encrypted and durable across service recreation', async () => {
      const input = { id: randomUUID(), text: 'Synthetic durable note' };
      await Promise.all(
        Array.from({ length: 5 }, () =>
          service.note(contactId, input, actor, branchId),
        ),
      );
      expect(
        await client.callCenterNote.count({ where: { id: input.id } }),
      ).toBe(1);
      expect(
        (
          await client.callCenterNote.findUniqueOrThrow({
            where: { id: input.id },
          })
        ).encryptedPayload,
      ).not.toContain(input.text);
      const fresh = new CallCenterService({ client } as never, crypto);
      const row = await client.callCenterNote.findUniqueOrThrow({
        where: { id: input.id },
      });
      expect(fresh.presentNote(row).text).toBe(input.text);
      expect(
        (await fresh.list(actor, branchId, { page: 1, pageSize: 50 })).data[0]!
          .notes,
      ).toEqual([]);
      await expect(
        service.note(contactId, { ...input, text: 'Changed' }, actor, branchId),
      ).rejects.toMatchObject({ status: 409 });
    });
    it('denies foreign branches, contact IDs and missing read/write/route authority', async () => {
      await expect(
        service.list(actor, otherBranch, { page: 1, pageSize: 50 }),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.note(
          contactId,
          { id: randomUUID(), text: 'forbidden' },
          { ...actor, branchIds: [otherBranch] },
          otherBranch,
        ),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        service.create(
          { ...original, id: randomUUID() },
          { ...actor, permissions: ['customer_affairs.call_center.read'] },
          branchId,
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.list(
          {
            ...actor,
            permissions: [
              'customer_affairs.lead.read',
              'customer_affairs.lead.create',
              'customer_affairs.lead.update',
            ],
          },
          branchId,
          { page: 1, pageSize: 50 },
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.list({ ...actor, permissions: [] }, branchId, {
          page: 1,
          pageSize: 50,
        }),
      ).rejects.toMatchObject({ status: 403 });
    });
    it('paginates bounded contact summaries without duplicating rows', async () => {
      await service.create(
        { ...original, id: randomUUID(), phone: '09120000002' },
        actor,
        branchId,
      );
      const first = await service.list(actor, branchId, {
        page: 1,
        pageSize: 1,
      });
      const second = await service.list(actor, branchId, {
        page: 2,
        pageSize: 1,
      });
      expect(first.meta.total).toBe(2);
      expect(first.data[0]!.id).not.toBe(second.data[0]!.id);
      expect(first.data[0]!.calls).toHaveLength(1);
    });
  },
);
