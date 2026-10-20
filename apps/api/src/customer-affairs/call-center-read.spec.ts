import { CustomerService } from '../customers/customer.service';
import { CustomerRepository } from '../customers/customer.repository';
import { CustomerContactCrypto } from '../customers/customer-contact.crypto';
import { CallCenterCustomerService } from './call-center-customer.service';
import { CallCenterTasksService } from '../tasks/call-center-tasks.service';
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CallCenterCrypto } from './call-center.crypto';
import { CallCenterService } from './call-center.service';
import { CallCenterWorkflowService } from './call-center-workflow.service';
import { CallCenterReadService, tehranDay } from './call-center-read.service';
import { callSearchMetadata, normalizeCallSearch } from './call-center-search';
import { CallCenterSearchDto } from './call-center-search.dto';
const crypto = new CallCenterCrypto(
  new ConfigService({
    CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString(
      'base64',
    ),
    CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 9).toString(
      'base64',
    ),
    CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
  }),
);
describe('Call Center search semantics', () => {
  it('normalizes Persian/Arabic letters, digits, diacritics and whitespace', () =>
    expect(normalizeCallSearch('  كِيش\u200cي ۱۲٣  ')).toBe('کیش ی 123'));
  it('retains branch-domain separation without private plaintext', () => {
    const value = {
      name: 'علی محمدی',
      subject: 'تور کیش',
      phone: '09120000001',
      source: 'گوگل',
      operator: 'فروش',
    };
    const a = callSearchMetadata(crypto, 'a', value, 'ANSWERED'),
      b = callSearchMetadata(crypto, 'b', value, 'ANSWERED');
    expect(a.searchTokens).not.toEqual(b.searchTokens);
    expect(JSON.stringify(a)).not.toContain('علی');
    expect(a.needsCompletion).toBe(false);
  });
  it('uses Tehran year/day boundary', () => {
    expect(tehranDay(new Date('2026-12-31T21:00:00Z')).toISOString()).toBe(
      '2026-12-31T20:30:00.000Z',
    );
  });
});
describe.skipIf(process.env.NORA_RUN_CALL_CENTER_POSTGRES_TESTS !== '1')(
  'Call Center package two PostgreSQL',
  () => {
    let db: DatabaseClient,
      read: CallCenterReadService,
      calls: CallCenterService;
    const branchId = randomUUID(),
      otherBranch = randomUUID(),
      userId = randomUUID(),
      contactId = randomUUID();
    const actor = {
      userId,
      branchIds: [branchId],
      permissions: [
        'customer_affairs.call_center.read',
        'customer_affairs.call_center.calls.create',
      ],
    } as AuthenticatedActor;
    const value = {
      name: 'علی محمدی',
      subject: 'تور کیش',
      phone: '09120000001',
      source: 'گوگل',
      operator: 'فروش داخلی',
      note: 'Synthetic private note',
    };
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        !['localhost', '127.0.0.1'].includes(url.hostname) ||
        !['/nora_call_center_package_one_test_1019', '/nora_ci'].includes(
          url.pathname,
        )
      )
        throw Error('Disposable database only');
      db = createDatabaseClient(url.toString());
      await db.branch.createMany({
        data: [branchId, otherBranch].map((id) => ({
          id,
          code: id,
          name: 'Synthetic package two',
        })),
      });
      await db.user.create({
        data: {
          id: userId,
          username: userId,
          displayName: 'Synthetic reader',
          passwordHash: 'not-a-login',
          status: 'ACTIVE',
        },
      });
      const database = { client: db } as never;
      calls = new CallCenterService(database, crypto);
      const workflow = new CallCenterWorkflowService(
        database,
        crypto,
        {} as never,
        {} as never,
        {} as never,
      );
      read = new CallCenterReadService(database, workflow, calls, crypto, {
        options: async () => ({ units: [] }),
      } as never);
      await db.callCenterContact.create({
        data: {
          id: contactId,
          branchId,
          phoneFingerprint: crypto.fingerprint(value.phone),
          latestOccurredAt: new Date('2026-10-19T10:00:00Z'),
        },
      });
      await db.callCenterCall.createMany({
        data: Array.from({ length: 1001 }, (_, i) => {
          const id = randomUUID();
          return {
            id,
            contactId,
            createdByUserId: userId,
            direction: 'INBOUND',
            status: 'جدید',
            outcome: 'ANSWERED',
            origin: 'MANUAL',
            occurredAt: new Date(Date.parse('2026-10-19T10:00:00Z') - i * 1000),
            encryptedPayload: crypto.encrypt(value, `call:${id}:${contactId}`),
            keyVersion: 1,
            requestFingerprint: crypto.fingerprint(id),
            ...callSearchMetadata(crypto, branchId, value, 'ANSWERED'),
          };
        }),
      });
      await db.callCenterNote.createMany({
        data: Array.from({ length: 1001 }, (_, i) => {
          const id = randomUUID();
          return {
            id,
            contactId,
            createdByUserId: userId,
            createdAt: new Date(Date.parse('2026-10-19T10:00:00Z') - i * 1000),
            encryptedPayload: crypto.encrypt(
              { text: 'Synthetic note' },
              `note:${id}:${contactId}`,
            ),
            keyVersion: 1,
            requestFingerprint: crypto.fingerprint(id),
          };
        }),
      });
      for (let i = 0; i < 24; i++)
        await calls.create(
          {
            id: randomUUID(),
            ...value,
            phone: '0912000' + String(i + 1000),
            subject: i === 23 ? 'جستجوی دوردست' : 'موضوع دیگر',
            direction: 'OUTBOUND',
            status: 'جدید',
            outcome: 'NO_ANSWER',
            occurredAt: '2026-10-18T10:00:00Z',
          },
          actor,
          branchId,
        );
    }, 60000);
    it('offers shared-phone identities only with native permission and records explicit replay-safe links', async () => {
      const database = { client: db } as never;
      const contactCrypto = new CustomerContactCrypto(
        new ConfigService({
          CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString(
            'base64',
          ),
          CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 9).toString(
            'base64',
          ),
          CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
        }),
      );
      const customers = new CustomerService(
        new CustomerRepository(database),
        contactCrypto,
        {} as never,
      );
      const workflow = new CallCenterWorkflowService(
        database,
        crypto,
        {} as never,
        new CallCenterTasksService(database),
        {} as never,
      );
      const links = new CallCenterCustomerService(
        database,
        customers,
        workflow,
        calls,
        crypto,
      );
      const ids = [randomUUID(), randomUUID(), randomUUID()];
      for (const [i, id] of ids.entries()) {
        await db.customer.create({
          data: {
            id,
            kind: 'PERSON',
            firstName: 'Synthetic',
            lastName: 'Identity',
            displayName: 'Synthetic shared identity ' + i,
            ownerBranchId: i === 2 ? otherBranch : branchId,
            createdByUserId: userId,
            updatedByUserId: userId,
          },
        });
        await db.customerContact.create({
          data: {
            customerId: id,
            type: 'PHONE',
            createdByUserId: userId,
            ...contactCrypto.protect('phone', value.phone, '0912•••001'),
          },
        });
      }
      const allowed = {
        ...actor,
        permissions: [
          ...actor.permissions,
          'customers.read',
          'customer_affairs.call_center.workflow.manage',
        ],
      } as AuthenticatedActor;
      expect(
        (await links.candidates(allowed, branchId, contactId)).data
          .map((c) => c.id)
          .sort(),
      ).toEqual(ids.slice(0, 2).sort());
      await expect(
        links.candidates(actor, branchId, contactId),
      ).rejects.toMatchObject({ status: 403 });
      const ticketId = randomUUID();
      await workflow.saveRequest(allowed, branchId, contactId, {
        commandId: randomUUID(),
        id: ticketId,
        expectedVersion: 0,
        title: 'Synthetic identity request',
        status: 'NEW',
        priority: 'NORMAL',
        reason: '',
      });
      const input = {
        commandId: randomUUID(),
        expectedVersion: 1,
        customerId: ids[0]!,
      };
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          links.link(allowed, branchId, ticketId, input),
        ),
      );
      expect(results.every((r) => r.data.customerId === ids[0])).toBe(true);
      expect(
        await db.customerAffairsAuditEvent.count({
          where: { entityId: ticketId, action: 'CUSTOMER_LINKED' },
        }),
      ).toBe(1);
      await expect(
        links.link(allowed, branchId, ticketId, {
          ...input,
          commandId: randomUUID(),
          customerId: ids[2]!,
        }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        links.link(allowed, branchId, ticketId, {
          ...input,
          commandId: randomUUID(),
          customerId: ids[1]!,
        }),
      ).rejects.toMatchObject({ status: 409 });
    });
    afterAll(async () => {
      await db?.$disconnect();
    });
    it('returns only 20 summaries and decrypts at most one call per summary', async () => {
      const spy = vi.spyOn(crypto, 'decrypt');
      const start = performance.now();
      const page = await read.search(
        actor,
        branchId,
        new CallCenterSearchDto(),
      );
      expect(page.data).toHaveLength(20);
      expect(page.meta.total).toBe(25);
      expect(page.data.find((c) => c.id === contactId)?.callCount).toBe(1001);
      expect(spy).toHaveBeenCalledTimes(20);
      expect(JSON.stringify(page).length).toBeLessThan(30000);
      console.log(
        'package-two summary latency ms',
        Math.round(performance.now() - start),
      );
      spy.mockRestore();
    });
    it('searches beyond first page and equivalent exact phones without scanning decrypted history', async () => {
      const remote = await read.search(actor, branchId, {
        ...new CallCenterSearchDto(),
        query: 'دوردست',
      });
      expect(remote.meta.total).toBe(1);
      const phone = await read.search(actor, branchId, {
        ...new CallCenterSearchDto(),
        query: '٠٠٩٨٩١٢٠٠٠٠٠٠١',
      });
      expect(phone.data.map((c) => c.id)).toEqual([contactId]);
      const words = await read.search(actor, branchId, {
        ...new CallCenterSearchDto(),
        query: 'علي كيش',
      });
      expect(words.data.some((c) => c.id === contactId)).toBe(true);
    });
    it('uses stable bounded keyset history across thousands of calls and notes', async () => {
      const first = await read.history(actor, branchId, contactId, 'calls', {
        pageSize: 20,
      });
      const second = await read.history(actor, branchId, contactId, 'calls', {
        pageSize: 20,
        after: first.meta.next!,
      });
      expect(first.data).toHaveLength(20);
      expect(second.data).toHaveLength(20);
      expect(
        new Set([...first.data, ...second.data].map((c) => c.id)).size,
      ).toBe(40);
      const notes = await read.history(actor, branchId, contactId, 'notes', {
        pageSize: 20,
      });
      expect(notes.data).toHaveLength(20);
      expect(notes.meta.next).not.toBeNull();
    });
    it('reproduces call/contact/source totals without join multiplication', async () => {
      const r = await read.report(actor, branchId, {
        ...new CallCenterSearchDto(),
        from: '2026-10-01T00:00:00Z',
        to: '2026-11-01T00:00:00Z',
      });
      expect(r.data.calls).toBe(1025);
      expect(r.data.contacts).toBe(25);
      expect(r.data.groups.reduce((n, g) => n + g.count, 0)).toBe(1025);
      expect(r.data.sources.reduce((n, g) => n + g.count, 0)).toBe(1025);
      expect(r.data.tasks.onTimeRate).toBeNull();
    });
    it('refuses a shifted page after a new call instead of silently skipping', async () => {
      const first = await read.search(
        actor,
        branchId,
        new CallCenterSearchDto(),
      );
      const second = await read.search(actor, branchId, {
        ...new CallCenterSearchDto(),
        page: 2,
        revision: first.meta.revision,
      });
      expect(second.data).toHaveLength(5);
      await calls.create(
        {
          id: randomUUID(),
          ...value,
          direction: 'INBOUND',
          status: 'جدید',
          outcome: 'BUSY',
          occurredAt: '2026-10-20T10:00:00Z',
        },
        actor,
        branchId,
      );
      await expect(
        read.search(actor, branchId, {
          ...new CallCenterSearchDto(),
          page: 2,
          revision: first.meta.revision,
        }),
      ).rejects.toMatchObject({ status: 409 });
    });
    it('denies cross-branch/revoked reads, foreign history and invalid ranges', async () => {
      await expect(
        read.search(actor, otherBranch, new CallCenterSearchDto()),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        read.search(
          { ...actor, permissions: [] },
          branchId,
          new CallCenterSearchDto(),
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        read.history(actor, branchId, randomUUID(), 'calls', { pageSize: 20 }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        read.report(actor, branchId, {
          ...new CallCenterSearchDto(),
          from: '2020-01-01T00:00:00Z',
          to: '2026-01-01T00:00:00Z',
        }),
      ).rejects.toMatchObject({ status: 400 });
    });
    it('separates current responsibility from historical completion and uses the correct denominator', async () => {
      const ticket = await db.customerAffairsTicket.findFirstOrThrow({
        where: { branchId, category: 'CALL_CENTER_REQUEST' },
      });
      for (const [status, due, completed] of [
        ['COMPLETED', '2026-10-19T12:00:00Z', '2026-10-19T11:00:00Z'],
        ['COMPLETED', '2026-10-19T10:00:00Z', '2026-10-19T11:00:00Z'],
        ['CANCELLED', '2026-10-19T10:00:00Z', '2026-10-19T11:00:00Z'],
        ['OPEN', '2026-01-01T10:00:00Z', null],
      ] as const) {
        const id = randomUUID();
        await db.automationTask.create({
          data: {
            id,
            callCenterTicketId: ticket.id,
            sourceModule: 'CALL_CENTER',
            sourceEventId: id,
            sourceReference: ticket.id,
            branchId,
            assigneeUserId: userId,
            kind: 'CALL_CENTER_FOLLOW_UP',
            title: 'Synthetic report action',
            status,
            dueAt: new Date(due),
            completedAt: completed ? new Date(completed) : null,
            payload: { version: 1, history: [{ actorId: userId, status }] },
          },
        });
      }
      const report = await read.report(actor, branchId, {
        ...new CallCenterSearchDto(),
        from: '2026-10-01T00:00:00Z',
        to: '2026-11-01T00:00:00Z',
      });
      expect(report.data.tasks.completed).toBe(2);
      expect(report.data.tasks.onTime).toBe(1);
      expect(report.data.tasks.onTimeRate).toBe(0.5);
      expect(report.data.tasks.open).toBe(1);
      expect(
        report.data.tasks.activity.find((a) => a.role === 'COMPLETED_BY')
          ?.count,
      ).toBe(2);
      const filtered = await read.search(actor, branchId, {
        ...new CallCenterSearchDto(),
        followUp: 'OVERDUE',
      });
      expect(filtered.data.map((c) => c.id)).toEqual([contactId]);
    });
    it('ranks only matching outbound calls across all contacts and decrypts bounded summaries', async () => {
      for (let i = 0; i < 3; i++)
        await calls.create(
          {
            id: randomUUID(),
            ...value,
            direction: 'OUTBOUND',
            status: 'جدید',
            outcome: 'ANSWERED',
            occurredAt: '2026-10-20T10:00:00Z',
          },
          actor,
          branchId,
        );
      const query = {
        ...new CallCenterSearchDto(),
        from: '2026-10-01T00:00:00Z',
        to: '2026-11-01T00:00:00Z',
      };
      const report = await read.report(actor, branchId, query);
      expect(report.data.topFollowUps).toHaveLength(5);
      expect(report.data.topFollowUps[0]).toEqual({
        contactId,
        name: value.name,
        count: 3,
      });
      expect(report.data.topFollowUps.every((r) => !('phone' in r))).toBe(true);
      const inbound = await read.report(actor, branchId, {
        ...query,
        direction: 'INBOUND',
      });
      expect(inbound.data.topFollowUps).toEqual([]);
    });
  },
);
