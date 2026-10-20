import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { BankAccountService } from '../src/finance/bank-accounts/bank-account.service';
import { BankAccountCrypto } from '../src/finance/bank-accounts/bank-account.crypto';
import { MasterProcurementDirectory } from '../src/master-data/master-procurement-directory';

const enabled = process.env.NORA_RUN_BANK_ACCOUNT_POSTGRES_TESTS === '1';
describe.skipIf(!enabled)(
  'company bank accounts on disposable PostgreSQL',
  () => {
    let db: DatabaseClient,
      service: BankAccountService,
      bankId: string,
      otherBankId: string;
    const branchId = randomUUID(),
      userId = randomUUID();
    const actor: AuthenticatedActor = {
      userId,
      sessionId: randomUUID(),
      branchIds: [branchId],
      permissions: [
        'finance.read',
        'master_data.read',
        'finance.account.manage',
      ],
    };
    const command = (accountNumber: string, title = randomUUID()) => ({
      requestId: randomUUID(),
      branchId,
      title,
      currencyCode: 'IRR',
      isActive: true,
      accountNumber,
      cardNumber: null,
      iban: null,
    });
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL!);
      if (!(
        process.env.CI === 'true' &&
        url.hostname === '127.0.0.1' &&
        url.port === '5432' &&
        url.pathname === '/nora_ci' &&
        url.username === 'nora_ci'
      ))
        throw new Error('Dedicated CI disposable database required.');
      db = createDatabaseClient(process.env.DATABASE_URL);
      await db.branch.create({
        data: {
          id: branchId,
          code: branchId,
          name: 'Synthetic bank QA branch',
        },
      });
      await db.user.create({
        data: {
          id: userId,
          username: userId,
          displayName: 'Synthetic bank QA actor',
          passwordHash: 'not-a-login-credential',
        },
      });
      const country = await db.masterCountry.findFirstOrThrow();
      for (let i = 0; i < 2; i++) {
        const bank = await db.masterBank.create({
          data: {
            code: randomUUID().replaceAll('-', ''),
            name: 'Synthetic bank QA',
            countryId: country.id,
            createdByUserId: userId,
            updatedByUserId: userId,
          },
        });
        if (i === 0) bankId = bank.id;
        else otherBankId = bank.id;
      }
      const holder = { client: db } as never;
      service = new BankAccountService(
        holder,
        new MasterProcurementDirectory(holder),
        new BankAccountCrypto(
          new ConfigService({
            MASTER_DATA_IMPORT_TOKEN_KEY_BASE64: Buffer.alloc(32, 19).toString(
              'base64',
            ),
          }),
        ),
      );
    }, 30000);
    afterAll(async () => {
      await db?.$disconnect();
    });
    it('persists multiple accounts per bank, masks lists, reveals only explicitly and keeps other banks/branches separate', async () => {
      const first = await service.save(
        bankId,
        null,
        command('0001234501'),
        actor,
      );
      await service.save(bankId, null, command('0001234502'), actor);
      await service.save(otherBankId, null, command('0001234501'), actor);
      const list = await service.list(bankId, undefined, actor);
      expect(list.items).toHaveLength(2);
      expect(JSON.stringify(list)).not.toContain('0001234501');
      expect(
        (await service.details(bankId, first.id, actor)).accountNumber,
      ).toBe('0001234501');
      expect(
        (await service.list(bankId, '1', { ...actor, branchIds: [] })).items,
      ).toHaveLength(0);
      await expect(
        service.details(bankId, first.id, { ...actor, branchIds: [] }),
      ).rejects.toThrow();
      const stored = await db.financeSettlementAccount.findUniqueOrThrow({
        where: { id: first.id },
      });
      expect(JSON.stringify(stored.bankIdentifiers)).not.toContain(
        '0001234501',
      );
      expect(
        JSON.stringify(
          await db.financeBankAccountAudit.findMany({
            where: { accountId: first.id },
          }),
        ),
      ).not.toContain('0001234501');
    });
    it('handles25 concurrent retries once and rejects duplicate normalized numbers atomically', async () => {
      const input = command('0001234525');
      const all = await Promise.all(
        Array.from({ length: 25 }, () =>
          service.save(bankId, null, input, actor),
        ),
      );
      expect(new Set(all.map((row) => row.id)).size).toBe(1);
      expect(
        await db.financeBankAccountAudit.count({
          where: { accountId: all[0]!.id, action: 'CREATE' },
        }),
      ).toBe(1);
      const duplicates = await Promise.allSettled([
        service.save(bankId, null, command('9876543210'), actor),
        service.save(bankId, null, command('۹۸۷۶۵۴۳۲۱۰'), actor),
      ]);
      expect(
        duplicates.filter((row) => row.status === 'fulfilled'),
      ).toHaveLength(1);
    }, 30000);
    it('uses CAS for concurrent edits and preserves omissions/explicit clears with immutable audit', async () => {
      const input = {
        ...command('0001234599'),
        cardNumber: '4111111111111111',
        iban: 'GB82WEST12345698765432',
      };
      const created = await service.save(bankId, null, input, actor);
      const edit = {
        title: input.title,
        currencyCode: 'IRR',
        isActive: true,
        expectedVersion: 1,
        cardNumber: null,
      };
      const edits = await Promise.allSettled([
        service.save(bankId, created.id, edit, actor),
        service.save(bankId, created.id, edit, actor),
      ]);
      expect(edits.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
      const result = await service.details(bankId, created.id, actor);
      expect(result).toMatchObject({
        version: 2,
        cardNumber: null,
        accountNumber: input.accountNumber,
        iban: input.iban,
      });
      await expect(
        db.financeBankAccountAudit.deleteMany({
          where: { accountId: created.id },
        }),
      ).rejects.toThrow();
    });
    it('rolls creation/update back if the audit writer fails and reveals nothing on audit failure', async () => {
      const created = await service.save(
        bankId,
        null,
        command('0001234566'),
        actor,
      );
      const broken = db.$extends({
        query: {
          financeBankAccountAudit: {
            async create() {
              throw new Error('Synthetic audit unavailable');
            },
          },
        },
      });
      const holder = { client: broken } as never;
      const failing = new BankAccountService(
        holder,
        new MasterProcurementDirectory(holder),
        new BankAccountCrypto(
          new ConfigService({
            MASTER_DATA_IMPORT_TOKEN_KEY_BASE64: Buffer.alloc(32, 19).toString(
              'base64',
            ),
          }),
        ),
      );
      const next = command('0001234567');
      await expect(failing.save(bankId, null, next, actor)).rejects.toThrow();
      expect(
        await db.financeSettlementAccount.findUnique({
          where: { id: next.requestId },
        }),
      ).toBeNull();
      await expect(
        failing.save(
          bankId,
          created.id,
          {
            title: 'Must roll back',
            currencyCode: 'IRR',
            isActive: false,
            expectedVersion: 1,
          },
          actor,
        ),
      ).rejects.toThrow();
      expect(
        await db.financeSettlementAccount.findUniqueOrThrow({
          where: { id: created.id },
        }),
      ).toMatchObject({ version: 1, isActive: true });
      await expect(
        failing.details(bankId, created.id, actor),
      ).rejects.toThrow();
    });
  },
);
