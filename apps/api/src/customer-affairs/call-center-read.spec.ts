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
import {
  CallCenterReadService,
  tehranDay,
  tehranWeek,
} from './call-center-read.service';
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
  it('starts the Tehran week on Saturday across UTC and year boundaries', () => {
    expect(tehranWeek(new Date('2026-10-16T20:29:59Z')).toISOString()).toBe(
      '2026-10-09T20:30:00.000Z',
    );
    expect(tehranWeek(new Date('2026-10-16T20:30:00Z')).toISOString()).toBe(
      '2026-10-16T20:30:00.000Z',
    );
    expect(tehranWeek(new Date('2027-01-01T20:30:00Z')).toISOString()).toBe(
      '2027-01-01T20:30:00.000Z',
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
        ![
          '/nora_call_center_package_one_test_1019',
          '/nora_ci',
          '/nora_outbound_first_contact_1025',
          '/nora_call_request_pending_1024',
        ].includes(url.pathname)
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
        { canManageRequest: async () => false } as never,
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
        { canManageRequest: async () => false } as never,
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
        reason: 'Synthetic request reason',
      });
      for (const status of ['IN_PROGRESS', 'NEW']) {
        // Only the synthetic fixture is changed to represent pre-upgrade rows.
        await db.customerAffairsTicket.update({
          where: { id: ticketId },
          data: { status },
        });
        const pending = await read.search(actor, branchId, {
          ...new CallCenterSearchDto(),
          requestStatus: 'IN_PROGRESS',
        });
        expect(pending.data.map((row) => row.id)).toEqual([contactId]);
        expect(
          (
            await read.search(
              { ...actor, branchIds: [branchId, otherBranch] },
              otherBranch,
              {
                ...new CallCenterSearchDto(),
                requestStatus: 'IN_PROGRESS',
              },
            )
          ).meta.total,
        ).toBe(0);
      }
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
    it('counts unique callback numbers and resolves only after a later real conversation', async () => {
      const branch = await db.branch.create({
        data: { code: randomUUID(), name: 'Synthetic callback test' },
      });
      const scoped = { ...actor, branchIds: [branch.id] };
      const contact = await db.callCenterContact.create({
        data: {
          branchId: branch.id,
          phoneFingerprint: crypto.fingerprint('2025550101'),
          latestOccurredAt: new Date(),
        },
      });
      const connection = await db.integrationTelephonyConnection.create({
        data: {
          branchId: branch.id,
          createdByUserId: userId,
          name: 'Synthetic fixture only',
        },
      });
      async function add(
        hour: number,
        direction: string,
        outcome: string | null,
        technical?: { answered?: boolean; unanswered?: boolean; state: string },
        phone = '2025550101',
        origin = 'MANUAL',
      ) {
        const id = randomUUID();
        const call = await db.callCenterCall.create({
          data: {
            id,
            contactId: contact.id,
            createdByUserId: userId,
            direction,
            outcome,
            origin: technical ? 'TELEPHONY' : origin,
            status: 'جدید',
            occurredAt: new Date(Date.UTC(2026, 9, 20, hour)),
            encryptedPayload: crypto.encrypt(
              { ...value, phone },
              `call:${id}:${contact.id}`,
            ),
            keyVersion: 1,
            requestFingerprint: crypto.fingerprint(id),
          },
        });
        if (technical) {
          const sessionId = randomUUID();
          await db.callCenterTelephonySession.create({
            data: {
              id: sessionId,
              connectionId: connection.id,
              rootFingerprint: crypto.fingerprint(id),
              callId: id,
              state: technical.state,
              synthetic: false,
              keyVersion: 1,
              encryptedTechnical: crypto.encrypt(
                technical,
                `telephony:${sessionId}`,
              ),
            },
          });
        }
        return call;
      }
      const count = async () => {
        const expected = (await read.kpis(scoped, branch.id)).data
          .needsFollowUp;
        const list = await read.missedCallbacks(
          scoped,
          branch.id,
          Object.assign(new CallCenterSearchDto(), {
            query: 'ignored contact filter',
          }),
        );
        expect(list.meta.total).toBe(expected);
        expect(new Set(list.data.map((r) => r.call.contactId)).size).toBe(
          expected,
        );
        if (expected) expect(list.data[0]!.call.phone).toBe('2025550101');
        return expected;
      };
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-20T20:00:00Z'));
      try {
        await add(1, 'INBOUND', 'NO_ANSWER', undefined, '');
        expect(await count()).toBe(0); // Hidden/unknown caller cannot be called back.
        await add(2, 'OUTBOUND', 'NO_ANSWER');
        expect(await count()).toBe(0);
        await add(3, 'INBOUND', 'NO_ANSWER');
        await add(4, 'INBOUND', 'NO_ANSWER');
        expect(await count()).toBe(1); // Repeated missed calls count once.
        const firstPage = await read.missedCallbacks(
          scoped,
          branch.id,
          new CallCenterSearchDto(),
        );
        expect(firstPage.data[0]!.call.occurredAt).toBe(
          '2026-10-20T04:00:00.000Z',
        );
        await add(5, 'OUTBOUND', 'BUSY');
        await expect(
          read.missedCallbacks(
            scoped,
            branch.id,
            Object.assign(new CallCenterSearchDto(), {
              page: 2,
              revision: firstPage.meta.revision,
            }),
          ),
        ).rejects.toMatchObject({ status: 409 });
        await expect(
          read.missedCallbacks(scoped, otherBranch, new CallCenterSearchDto()),
        ).rejects.toMatchObject({ status: 403 });
        await add(6, 'OUTBOUND', 'ANSWERED', {
          state: 'ENDED',
          unanswered: true,
        });
        expect(await count()).toBe(1); // Business outcome cannot override provider evidence.
        await add(7, 'OUTBOUND', null, { state: 'ENDED', answered: true });
        expect(await count()).toBe(0); // Successful technical call needs no completed form.
        await add(8, 'INBOUND', 'ANSWERED', {
          state: 'ENDED',
          unanswered: true,
        });
        expect(await count()).toBe(1); // A new miss reopens callback need.
        await add(
          9,
          'INBOUND',
          'ANSWERED',
          undefined,
          '2025550101',
          'SYNTHETIC',
        );
        await add(22, 'INBOUND', 'ANSWERED');
        expect(await count()).toBe(1); // Synthetic and future success cannot resolve it.
        await add(10, 'INBOUND', null, {
          state: 'ENDED',
          unanswered: true,
          answered: true,
        });
        expect(await count()).toBe(0); // Late answer wins over a missed ringing leg.
        await add(11, 'INBOUND', 'NO_ANSWER', {
          state: 'RINGING',
          unanswered: true,
        });
        expect(await count()).toBe(0); // Still ringing is not a missed call.
        const missed = await add(12, 'INBOUND', 'NO_ANSWER');
        const retry = await calls.create(
          {
            id: randomUUID(),
            ...value,
            phone: '2025550101',
            direction: 'OUTBOUND',
            status: 'جدید',
            outcome: 'NO_ANSWER',
            occurredAt: '2026-10-20T13:00:00Z',
          },
          scoped,
          branch.id,
        );
        expect(retry.data.contactId).toBe(contact.id);
        expect(retry.data.id).not.toBe(missed.id);
        expect(await count()).toBe(1);
        await calls.create(
          {
            id: randomUUID(),
            ...value,
            phone: '2025550101',
            direction: 'OUTBOUND',
            status: 'جدید',
            outcome: 'ANSWERED',
            occurredAt: '2026-10-20T14:00:00Z',
          },
          scoped,
          branch.id,
        );
        expect(await count()).toBe(0);
        expect(
          (
            await db.callCenterCall.findUniqueOrThrow({
              where: { id: missed.id },
            })
          ).outcome,
        ).toBe('NO_ANSWER');
      } finally {
        vi.useRealTimers();
      }
    });
    it('counts branch KPI calls with Tehran boundaries, null outcomes and unresolved missed callers', async () => {
      const kpiBranch = randomUUID(),
        emptyBranch = randomUUID(),
        kpiContact = randomUUID(),
        outsideContact = randomUUID();
      await db.branch.createMany({
        data: [kpiBranch, emptyBranch].map((id) => ({
          id,
          code: id,
          name: 'Synthetic KPI branch',
        })),
      });
      const now = new Date('2026-10-20T10:00:00Z');
      await db.callCenterContact.createMany({
        data: [
          {
            id: kpiContact,
            branchId: kpiBranch,
            phoneFingerprint: crypto.fingerprint(kpiContact),
            latestOccurredAt: now,
          },
          {
            id: outsideContact,
            branchId: otherBranch,
            phoneFingerprint: crypto.fingerprint(outsideContact),
            latestOccurredAt: now,
          },
        ],
      });
      const template = await db.customerAffairsTicket.findFirstOrThrow({
        where: { branchId, category: 'CALL_CENTER_REQUEST' },
      });
      const requestIds = [randomUUID(), randomUUID(), randomUUID()];
      for (const [index, id] of requestIds.entries())
        await db.customerAffairsTicket.create({
          data: {
            ...template,
            references: {},
            id,
            trackingNumber: id.replaceAll('-', ''),
            branchId: kpiBranch,
            callCenterContactId: kpiContact,
            callCenterPayload: crypto.encrypt(
              { title: 'Synthetic KPI request' },
              `request:${id}:${kpiBranch}`,
            ),
            callCenterKeyVersion: 1,
            status: index === 1 ? 'CLOSED' : 'NEW',
          },
        });
      for (const [index, ticketId] of [
        requestIds[0]!,
        requestIds[0]!,
        requestIds[1]!,
        requestIds[2]!,
      ].entries()) {
        const id = randomUUID();
        await db.automationTask.create({
          data: {
            id,
            callCenterTicketId: ticketId,
            sourceModule: 'CALL_CENTER',
            sourceEventId: id,
            sourceReference: ticketId,
            branchId: kpiBranch,
            assigneeUserId: userId,
            kind: 'CALL_CENTER_FOLLOW_UP',
            title: 'Synthetic KPI task',
            status: index === 3 ? 'COMPLETED' : 'OPEN',
            dueAt: now,
            payload: {},
          },
        });
      }
      for (const [date, outcome, origin, ticketId, target] of [
        ['2026-10-19T20:30:00Z', null, 'MANUAL', requestIds[0], kpiContact],
        [
          '2026-10-19T20:30:00.001Z',
          'NO_ANSWER',
          'MANUAL',
          requestIds[0],
          kpiContact,
        ],
        [
          '2026-10-19T20:29:59Z',
          'ANSWERED',
          'MANUAL',
          requestIds[1],
          kpiContact,
        ],
        [
          '2026-10-16T20:30:00Z',
          'ANSWERED',
          'MANUAL',
          requestIds[2],
          kpiContact,
        ],
        ['2026-10-16T20:29:59Z', 'ANSWERED', 'MANUAL', null, kpiContact],
        ['2026-10-20T20:30:00Z', null, 'MANUAL', null, kpiContact],
        ['2026-10-20T09:00:00Z', null, 'SYNTHETIC', requestIds[0], kpiContact],
        ['2026-10-20T09:00:00Z', null, 'MANUAL', null, outsideContact],
      ] as const) {
        const id = randomUUID();
        await db.callCenterCall.create({
          data: {
            id,
            contactId: target,
            createdByUserId: userId,
            ticketId: ticketId ?? null,
            direction: 'INBOUND',
            status: 'جدید',
            outcome,
            origin,
            occurredAt: new Date(date),
            encryptedPayload: crypto.encrypt(value, `call:${id}:${target}`),
            keyVersion: 1,
            requestFingerprint: crypto.fingerprint(id),
            searchVersion: 1,
          },
        });
      }
      const scopedActor = { ...actor, branchIds: [kpiBranch, emptyBranch] };
      const decrypt = vi.spyOn(crypto, 'decrypt');
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(now);
      try {
        const result = await read.kpis(scopedActor, kpiBranch);
        expect(result.data).toEqual({
          today: 2,
          week: 4,
          withoutOutcome: 1,
          needsFollowUp: 1,
        });
        expect(result.meta).toMatchObject({
          branchId: kpiBranch,
          timezone: 'Asia/Tehran',
          todayFrom: '2026-10-19T20:30:00.000Z',
          weekFrom: '2026-10-16T20:30:00.000Z',
        });
        expect((await read.kpis(scopedActor, emptyBranch)).data).toEqual({
          today: 0,
          week: 0,
          withoutOutcome: 0,
          needsFollowUp: 0,
        });
        await expect(read.kpis(scopedActor, otherBranch)).rejects.toMatchObject(
          { status: 403 },
        );
        await expect(
          read.kpis({ ...scopedActor, permissions: [] }, kpiBranch),
        ).rejects.toMatchObject({ status: 403 });
        expect(decrypt).toHaveBeenCalled();
        for (const period of ['today', 'week'] as const) {
          const first = await read.withoutOutcome(
            scopedActor,
            kpiBranch,
            Object.assign(new CallCenterSearchDto(), {
              pageSize: 1,
              query: 'ignored',
            }),
            period,
          );
          expect(first.meta.total).toBe(result.data[period]);
          expect(first.data).toHaveLength(1);
          const second = await read.withoutOutcome(
            scopedActor,
            kpiBranch,
            Object.assign(new CallCenterSearchDto(), {
              page: 2,
              pageSize: 1,
              revision: first.meta.revision,
            }),
            period,
          );
          expect(second.data[0]!.call.id).not.toBe(first.data[0]!.call.id);
          expect(
            new Date(first.data[0]!.call.occurredAt).getTime(),
          ).toBeGreaterThanOrEqual(
            new Date(second.data[0]!.call.occurredAt).getTime(),
          );
          await expect(
            read.withoutOutcome(
              scopedActor,
              kpiBranch,
              Object.assign(new CallCenterSearchDto(), {
                page: 2,
                pageSize: 1,
                revision: 'stale',
              }),
              period,
            ),
          ).rejects.toMatchObject({ status: 409 });
          await expect(
            read.withoutOutcome(
              scopedActor,
              otherBranch,
              new CallCenterSearchDto(),
              period,
            ),
          ).rejects.toMatchObject({ status: 403 });
          expect(
            (
              await read.withoutOutcome(
                scopedActor,
                emptyBranch,
                new CallCenterSearchDto(),
                period,
              )
            ).meta.total,
          ).toBe(0);
        }
        const drilldown = await read.withoutOutcome(
          scopedActor,
          kpiBranch,
          Object.assign(new CallCenterSearchDto(), {
            pageSize: 1,
            query: 'ignored filter',
          }),
        );
        expect(drilldown.meta.total).toBe(result.data.withoutOutcome);
        expect(drilldown.data).toHaveLength(1);
        expect(drilldown.data[0]!.call.outcome).toBeNull();
        expect(drilldown.data[0]!.call.origin).not.toBe('SYNTHETIC');
        const original = await db.callCenterCall.findUniqueOrThrow({
          where: { id: drilldown.data[0]!.call.id },
        });
        const secondId = randomUUID();
        await db.callCenterCall.create({
          data: {
            ...original,
            id: secondId,
            requestFingerprint: crypto.fingerprint(secondId),
            encryptedPayload: crypto.encrypt(
              value,
              `call:${secondId}:${original.contactId}`,
            ),
          },
        });
        const firstPage = await read.withoutOutcome(
          scopedActor,
          kpiBranch,
          Object.assign(new CallCenterSearchDto(), { pageSize: 1 }),
        );
        const secondPage = await read.withoutOutcome(
          scopedActor,
          kpiBranch,
          Object.assign(new CallCenterSearchDto(), {
            page: 2,
            pageSize: 1,
            revision: firstPage.meta.revision,
          }),
        );
        expect(firstPage.meta.total).toBe(2);
        expect(secondPage.data).toHaveLength(1);
        expect(secondPage.data[0]!.call.id).not.toBe(
          firstPage.data[0]!.call.id,
        );
        expect(secondPage.data[0]!.call.contactId).toBe(
          firstPage.data[0]!.call.contactId,
        );
        await expect(
          read.withoutOutcome(
            scopedActor,
            otherBranch,
            new CallCenterSearchDto(),
          ),
        ).rejects.toMatchObject({ status: 403 });
        await expect(
          read.withoutOutcome(
            scopedActor,
            kpiBranch,
            Object.assign(new CallCenterSearchDto(), {
              page: 2,
              revision: 'stale',
            }),
          ),
        ).rejects.toMatchObject({ status: 409 });
        await db.callCenterCall.updateMany({
          where: { id: { in: [original.id, secondId] } },
          data: { outcome: 'ANSWERED' },
        });
        expect(
          (
            await read.withoutOutcome(
              scopedActor,
              kpiBranch,
              new CallCenterSearchDto(),
            )
          ).meta.total,
        ).toBe(0);
        expect(
          (await read.kpis(scopedActor, kpiBranch)).data.withoutOutcome,
        ).toBe(0);
      } finally {
        vi.useRealTimers();
        decrypt.mockRestore();
      }
    });
  },
);
