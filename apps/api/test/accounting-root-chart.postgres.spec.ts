import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import {
  accountingTestUrl,
  assertAccountingTestDatabase,
} from './accounting-test-database';
import {
  planRootChart,
  type RootChartReference,
} from '../src/finance/accounting/accounting-root-chart-plan';
import { AccountingService } from '../src/finance/accounting/accounting.service';
import { AccountingCompanyScope } from '../src/finance/accounting/accounting-company-scope';
import { IamFinanceDirectory } from '../src/iam/iam-finance-directory';

const url = accountingTestUrl('ACCOUNTING_TEST_DATABASE_URL');
const reference = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      '../../data/accounting/rahkaran-group-general-1115.json',
    ),
    'utf8',
  ),
).accounts as RootChartReference[];
describe.skipIf(!url)(
  'Group/general chart through native commands on isolated PostgreSQL',
  () => {
    let db: DatabaseClient;
    const branchId = randomUUID(),
      userId = randomUUID();
    const actor = {
      userId,
      sessionId: randomUUID(),
      branchIds: [branchId],
      permissions: [
        'finance.read',
        'finance.account.manage',
        'finance.journal.read',
      ],
    } as AuthenticatedActor;
    beforeAll(async () => {
      assertAccountingTestDatabase(url!, '55437', 'accounting_test');
      db = createDatabaseClient(url);
      await db.branch.create({
        data: { id: branchId, code: branchId, name: 'Synthetic root chart' },
      });
      await db.user.create({
        data: {
          id: userId,
          username: userId,
          displayName: 'Synthetic chart operator',
          passwordHash: 'not-a-login-credential',
        },
      });
    });
    afterAll(async () => {
      await db?.$disconnect();
    });
    it('creates 13 groups and 36 generals independently in three books, retains old accounts, creates no subsidiaries and replays safely', async () => {
      for (let index = 0; index < 3; index++) {
        const entity = await db.legalEntity.create({
          data: {
            code: 'RC_' + randomUUID().slice(0, 12),
            persianName: 'Synthetic root ' + index,
          },
        });
        const scope = new AccountingCompanyScope({
          current: async () => ({
            data: {
              selection: entity.code,
              isAggregate: false,
              legalEntity: { id: entity.id },
            },
          }),
          selectable: async () => ({
            data: [
              {
                id: entity.id,
                code: entity.code,
                persianName: entity.persianName,
              },
            ],
          }),
        } as never);
        const service = new AccountingService(
          { client: db } as never,
          new IamFinanceDirectory({ client: db } as never),
          undefined,
          undefined,
          undefined,
          scope,
        );
        const book = await service.createBook(
          {
            id: randomUUID(),
            code: String(index + 1),
            branchId,
            legalEntityId: entity.id,
            title: entity.persianName,
            baseCurrency: 'IRR',
            approvalPolicy: 'DUAL_CONTROL',
            active: true,
            isMain: false,
            allowsPosting: true,
          },
          actor,
        );
        if (index === 1) {
          const parent = await db.accountingAccount.create({
            data: {
              bookId: book.id,
              code: '01',
              title: 'Existing group',
              level: 'GROUP',
              nature: 'DEBIT',
              attributes: {},
            },
          });
          await db.accountingAccount.create({
            data: {
              bookId: book.id,
              parentId: parent.id,
              code: '0110',
              title: 'Existing general',
              level: 'GENERAL',
              nature: 'DEBIT',
              attributes: {},
            },
          });
        }
        const before = await db.accountingAccount.findMany({
          where: { bookId: book.id },
        });
        const plan = planRootChart(book.id, before, reference);
        for (const payload of plan.create)
          await service.command(
            book.id,
            'save-account',
            { key: `rc-${book.id}-${payload.code}`, payload },
            actor,
          );
        const after = await db.accountingAccount.findMany({
          where: { bookId: book.id },
        });
        expect(after.filter((row) => row.level === 'GROUP')).toHaveLength(
          index === 1 ? 14 : 13,
        );
        expect(after.filter((row) => row.level === 'GENERAL')).toHaveLength(
          index === 1 ? 37 : 36,
        );
        expect(after.filter((row) => row.level === 'SUBSIDIARY')).toHaveLength(
          0,
        );
        expect(planRootChart(book.id, after, reference)).toMatchObject({
          create: [],
          matched: 49,
        });
        for (const row of before)
          expect(after.find((a) => a.id === row.id)).toEqual(row);
        const payload = plan.create[0]!;
        await service.command(
          book.id,
          'save-account',
          { key: `rc-${book.id}-${payload.code}`, payload },
          actor,
        );
        expect(
          await db.accountingAccount.count({ where: { bookId: book.id } }),
        ).toBe(after.length);
        expect(
          await db.accountingJournal.count({ where: { bookId: book.id } }),
        ).toBe(0);
      }
    }, 90000);
  },
);
