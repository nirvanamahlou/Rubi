import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  financeCodingProfiles,
  type AuthenticatedActor,
} from '@nora/contracts';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import { AccountingService } from '../src/finance/accounting/accounting.service';
import { assertAccountingTestDatabase } from './accounting-test-database';

const url = process.env.FIN_CODING_TEST_DATABASE_URL;
const branchId = randomUUID();
const actor: AuthenticatedActor = {
  userId: randomUUID(),
  sessionId: randomUUID(),
  branchIds: [branchId],
  permissions: [
    'finance.read',
    'finance.journal.read',
    'finance.account.manage',
  ],
};
type Detail = { id: string; code: string; title: string; version: number };

describe.skipIf(!url)('FIN-CODING-001 on isolated PostgreSQL', () => {
  let db: DatabaseClient;
  let accounting: AccountingService;
  let firstBook: string;
  let otherBook: string;
  let legacyTypeId: string;

  beforeAll(async () => {
    const fixture = new URL(url!).pathname.slice(1);
    if (!/^fin_coding_test_\d+$/.test(fixture))
      throw new Error('Fresh FIN-CODING test fixture required');
    assertAccountingTestDatabase(url!, '55437', fixture);
    db = createDatabaseClient(url);
    await db.branch.create({
      data: { id: branchId, code: branchId, name: 'Synthetic FIN-CODING' },
    });
    await db.user.create({
      data: {
        id: actor.userId,
        username: actor.userId,
        displayName: 'Synthetic accountant',
        passwordHash: 'not-a-login',
      },
    });
    accounting = new AccountingService(
      { client: db } as never,
      {
        branches: async () => [
          { id: branchId, code: 'F', name: 'Synthetic branch' },
        ],
        displayNames: async () => [],
      } as never,
    );
    firstBook = (
      await accounting.createBook(
        {
          id: randomUUID(),
          branchId,
          code: 'FC1',
          title: 'New synthetic ledger',
          baseCurrency: 'IRR',
          approvalPolicy: 'DUAL_CONTROL',
        },
        actor,
      )
    ).id;
    otherBook = (
      await db.accountingBook.create({
        data: {
          branchId,
          code: 'FC2',
          title: 'Existing synthetic ledger',
          baseCurrency: 'IRR',
        },
      })
    ).id;
    legacyTypeId = (
      await db.accountingConfiguration.create({
        data: {
          bookId: otherBook,
          kind: 'detail-types',
          code: 'LEGACY-8',
          title: 'Existing custom type',
          attributes: {
            classificationNumberLength: '8',
            defaultFirstCode: '10000000',
          },
        },
      })
    ).id;
  }, 30000);
  afterAll(async () => {
    await db?.$disconnect();
  });

  function run<T>(
    bookId: string,
    action: string,
    payload: Record<string, unknown>,
    expectedVersion?: number,
    who = actor,
    key = randomUUID(),
  ) {
    return accounting.command(
      bookId,
      action,
      { key, payload, expectedVersion },
      who,
    ) as Promise<T>;
  }
  async function typeId(bookId: string, code: string) {
    return (
      await db.accountingConfiguration.findFirstOrThrow({
        where: { bookId, kind: 'detail-types', code },
      })
    ).id;
  }

  it('defines the four categories under the existing ledger permission and preserves same-title records', async () => {
    const readOnly = {
      ...actor,
      permissions: ['finance.read', 'finance.journal.read'],
    } as AuthenticatedActor;
    await expect(
      run(otherBook, 'setup-finance-coding-types', {}, undefined, readOnly),
    ).rejects.toMatchObject({ status: 403 });
    const protectedBook = await db.accountingBook.create({
      data: {
        branchId,
        code: 'FC3',
        title: 'Synthetic conflict ledger',
        baseCurrency: 'IRR',
      },
    });
    const conflict = await db.accountingConfiguration.create({
      data: {
        bookId: protectedBook.id,
        kind: 'detail-types',
        code: 'LEGACY-BANK',
        title: 'حساب های بانکی',
        attributes: { classificationNumberLength: '7' },
      },
    });
    await expect(
      run(protectedBook.id, 'setup-finance-coding-types', {}),
    ).resolves.toEqual({
      created: 3,
      conflicts: ['حساب‌های بانکی'],
    });
    expect(
      await db.accountingConfiguration.findUnique({
        where: { id: conflict.id },
      }),
    ).toEqual(conflict);
    await expect(
      run(otherBook, 'setup-finance-coding-types', {}),
    ).resolves.toEqual({ created: 4, conflicts: [] });
    await expect(
      run(otherBook, 'setup-finance-coding-types', {}),
    ).resolves.toEqual({ created: 0, conflicts: [] });
    for (const profile of financeCodingProfiles) {
      const saved = await db.accountingConfiguration.findUniqueOrThrow({
        where: {
          id: await typeId(firstBook, profile.typeCode),
        },
      });
      expect(saved).toMatchObject({
        title: profile.title,
        attributes: {
          isSystem: true,
          classificationNumberLength: '8',
          defaultFirstCode: profile.firstCode,
        },
      });
      await expect(
        run(
          firstBook,
          'save-configuration',
          {
            ...saved,
            attributes: {
              ...(saved.attributes as object),
              classificationNumberLength: '7',
            },
          },
          saved.version,
        ),
      ).rejects.toMatchObject({ status: 422 });
    }
  });

  it('issues the first three per type across two ledgers, serializes concurrent writes and replays a request', async () => {
    for (const profile of financeCodingProfiles) {
      const first = {
        typeId: await typeId(firstBook, profile.typeCode),
        title: 'Synthetic first',
      };
      const second = {
        typeId: await typeId(otherBook, profile.typeCode),
        title: 'Synthetic next',
      };
      const key = randomUUID();
      for (const illegal of [
        profile.prefix + '0000000',
        '10000001',
        profile.prefix + '001',
        profile.firstCode,
      ]) {
        await expect(
          run(firstBook, 'save-detail', { ...first, code: illegal }),
        ).rejects.toMatchObject({ status: 422 });
      }
      const saved = await run<Detail>(
        firstBook,
        'save-detail',
        first,
        undefined,
        actor,
        key,
      );
      expect(saved.code).toBe(profile.firstCode);
      expect(
        await run<Detail>(
          firstBook,
          'save-detail',
          first,
          undefined,
          actor,
          key,
        ),
      ).toEqual(saved);
      const following = await Promise.all([
        run<Detail>(firstBook, 'save-detail', first),
        run<Detail>(otherBook, 'save-detail', second),
      ]);
      expect(following.map((row) => row.code).sort()).toEqual([
        profile.prefix + '0000002',
        profile.prefix + '0000003',
      ]);
      expect(
        await db.systemIssuedNumber.findUnique({
          where: { issuedValue: saved.code },
        }),
      ).toMatchObject({
        actorUserId: actor.userId,
        idempotencyKey: 'accounting-detail:' + saved.id,
      });
    }
  });

  it('skips occupied legacy values, preserves issued and legacy codes, and does not recycle deleted codes', async () => {
    const profile = financeCodingProfiles[3];
    const type = await typeId(firstBook, profile.typeCode);
    const latest = await db.accountingDetail.findFirstOrThrow({
      where: { typeId: type, code: '50000001' },
    });
    await expect(
      run(
        firstBook,
        'save-detail',
        { id: latest.id, typeId: type, title: latest.title, code: '50000009' },
        1,
      ),
    ).rejects.toMatchObject({ status: 422 });
    await run(
      firstBook,
      'delete-base-record',
      { entity: 'detail', id: latest.id },
      latest.version,
    );
    const legacy = await run<Detail>(otherBook, 'save-detail', {
      typeId: legacyTypeId,
      title: 'Legacy bank-like code',
      code: '50000004',
      active: false,
    });
    const allocated = await run<Detail>(firstBook, 'save-detail', {
      typeId: type,
      title: 'Another bank detail',
    });
    expect(allocated.code).toBe('50000005');
    expect(
      await db.accountingDetail.findUnique({ where: { id: legacy.id } }),
    ).toMatchObject({ code: '50000004', active: false });
    expect(
      await db.systemIssuedNumber.findUnique({
        where: { issuedValue: latest.code },
      }),
    ).toBeTruthy();
    await expect(
      run(otherBook, 'save-detail', {
        typeId: legacyTypeId,
        title: 'Conflicting number',
        code: latest.code,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
