import { randomUUID } from 'node:crypto';
import { generateKeyPairSync } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { AccountingTaxpayerService } from '../src/finance/accounting/accounting-taxpayer.service';
import { AccountingService } from '../src/finance/accounting/accounting.service';
const url = process.env.ACCOUNTING_DESIGN_TEST_DATABASE_URL;
describe.skipIf(!url)('local taxpayer drafts on isolated PostgreSQL', () => {
  let db: DatabaseClient,
    service: AccountingTaxpayerService,
    bookId: string,
    actor: AuthenticatedActor;
  beforeAll(async () => {
    const target = new URL(url!);
    if (
      target.hostname !== '127.0.0.1' ||
      target.port !== '55494' ||
      target.pathname !== '/accounting_design_qa'
    )
      throw new Error('Dedicated design QA database required');
    db = createDatabaseClient(url);
    const branchId = randomUUID(),
      userId = randomUUID();
    await db.branch.create({
      data: { id: branchId, code: branchId, name: 'Synthetic draft branch' },
    });
    await db.user.create({
      data: {
        id: userId,
        username: userId,
        displayName: 'Synthetic draft actor',
        passwordHash: 'not-a-login-credential',
      },
    });
    bookId = (
      await db.accountingBook.create({
        data: {
          branchId,
          code: 'DRAFT',
          title: 'Synthetic draft book',
          baseCurrency: 'IRR',
        },
      })
    ).id;
    actor = {
      userId,
      sessionId: randomUUID(),
      branchIds: [branchId],
      permissions: [
        'finance.read',
        'finance.account.manage',
        'finance.journal.read',
      ],
    };
    service = new AccountingTaxpayerService({ client: db } as never);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });
  it('stores source public fields with replay/version guards and no claimed external result', async () => {
    const input = {
      key: randomUUID(),
      version: 0,
      values: {
        lkpSendingType_ComboBox_Input: 'ارسال مستقیم',
        txtTitle: 'Synthetic connection draft',
        txtDirectTaxMemoryID: 'synthetic-reference',
      },
    };
    const row = await service.saveDraft(bookId, 'settings', input, actor);
    expect(row).toMatchObject({
      status: 'DRAFT',
      externalConnection: false,
      externalAcceptance: false,
      version: 1,
    });
    expect((await service.saveDraft(bookId, 'settings', input, actor)).id).toBe(
      row.id,
    );
    await expect(
      service.saveDraft(
        bookId,
        'settings',
        { ...input, key: randomUUID(), id: row.id, version: 999 },
        actor,
      ),
    ).rejects.toThrow('تغییر');
    await expect(
      service.drafts(bookId, 'settings', {}, { ...actor, branchIds: [] }),
    ).rejects.toThrow();
    await db.accountingConfiguration.create({
      data: {
        bookId,
        kind: 'tax-settings',
        code: randomUUID(),
        title: 'Legacy request',
        active: false,
        attributes: {
          connectorRef: 'synthetic-ref',
          sellerProfileRef: 'synthetic-ref',
          schemaVersion: 'synthetic',
          environment: 'SANDBOX',
        },
      },
    });
    expect((await service.drafts(bookId, 'settings', {}, actor)).total).toBe(2);
    const filtered = await service.drafts(
      bookId,
      'settings',
      { filters: JSON.stringify({ عنوان: 'Legacy' }) },
      actor,
    );
    expect(filtered.total).toBe(1);
    expect(filtered.items[0]).toMatchObject({
      legacyRequest: true,
      values: { txtTitle: 'Legacy request' },
    });
  });
  it('rejects private values, unknown fields and inactive schedule filters without persistence', async () => {
    const before = await db.accountingCommand.count({ where: { bookId } });
    const values = {
      lkpSendingType_ComboBox_Input: 'ارسال مستقیم',
      txtTitle: 'Synthetic',
      txtDirectTaxMemoryID: 'synthetic-reference',
    };
    await expect(
      service.saveDraft(
        bookId,
        'settings',
        {
          key: randomUUID(),
          version: 0,
          values: { ...values, txtDirectPrivate: 'SYNTHETIC-PRIVATE-MATERIAL' },
        },
        actor,
      ),
    ).rejects.toThrow('محرمانه');
    await expect(
      service.saveDraft(
        bookId,
        'settings',
        {
          key: randomUUID(),
          version: 0,
          values: { ...values, unofficialExtra: 'value' },
        },
        actor,
      ),
    ).rejects.toThrow('ناشناخته');
    await expect(
      service.saveDraft(
        bookId,
        'schedules',
        {
          key: randomUUID(),
          version: 0,
          values: {
            lkpOperatins_ComboBox_Input: 'جمع آوری داده',
            lkpActionType_ComboBox_Input: 'ایجاد',
          },
        },
        actor,
      ),
    ).rejects.toThrow('غیرفعال');
    expect(await db.accountingCommand.count({ where: { bookId } })).toBe(
      before,
    );
    expect(
      JSON.stringify(
        await db.accountingConfiguration.findMany({ where: { bookId } }),
      ),
    ).not.toContain('SYNTHETIC-PRIVATE-MATERIAL');
  });
  it('keeps cancellation dates valid and never invents an official cancellation number', async () => {
    const values = {
      dpCancellationDate_MaskedTextBox: '2026-10-14',
      txtUniqueBillNumberRef: 'synthetic-external-reference',
      lkpReferenceActionType_ComboBox_Input: 'اصلی',
      dpReferenceDate_MaskedTextBox: '2026-10-13',
    };
    const row = await service.saveDraft(
      bookId,
      'cancellations',
      { key: randomUUID(), version: 0, values },
      actor,
    );
    expect(row.values.txtUniqueBillNumber).toBeUndefined();
    expect(row.externalAcceptance).toBe(false);
    await expect(
      service.saveDraft(
        bookId,
        'cancellations',
        { key: randomUUID(), version: 0, values },
        actor,
      ),
    ).rejects.toThrow('موجود');
    await expect(
      service.saveDraft(
        bookId,
        'cancellations',
        {
          id: row.id,
          key: randomUUID(),
          version: row.version,
          values: { ...values, txtUniqueBillNumberRef: 'changed-reference' },
        },
        actor,
      ),
    ).rejects.toThrow('قابل تغییر');
    await expect(
      service.saveDraft(
        bookId,
        'cancellations',
        {
          key: randomUUID(),
          version: 0,
          values: { ...values, dpCancellationDate_MaskedTextBox: '2026-10-12' },
        },
        actor,
      ),
    ).rejects.toThrow('تاریخ');
  });
  it('stores private material encrypted and excludes it from list, command receipts and the book snapshot', async () => {
    const previous = process.env.FINANCE_TAXPAYER_SECRET_KEY;
    process.env.FINANCE_TAXPAYER_SECRET_KEY = Buffer.alloc(32, 7).toString(
      'base64',
    );
    let secure: AccountingTaxpayerService;
    try {
      secure = new AccountingTaxpayerService({ client: db } as never);
    } finally {
      if (previous === undefined)
        delete process.env.FINANCE_TAXPAYER_SECRET_KEY;
      else process.env.FINANCE_TAXPAYER_SECRET_KEY = previous;
    }
    const pair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const values = {
      lkpSendingType_ComboBox_Input: 'ارسال مستقیم',
      txtTitle: 'Synthetic encrypted profile',
      txtDirectTaxMemoryID: 'synthetic-memory',
      txtDirectPrivate: pair.privateKey,
    };
    const input = { key: randomUUID(), version: 0, values };
    const row = await secure!.saveDraft(bookId, 'settings', input, actor);
    expect(row.storedSecretFields).toEqual(['txtDirectPrivate']);
    expect(JSON.stringify(row)).not.toContain('PRIVATE KEY');
    expect((await secure!.saveDraft(bookId, 'settings', input, actor)).id).toBe(
      row.id,
    );
    const stored = await db.accountingConfiguration.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(JSON.stringify(stored.attributes)).not.toContain('PRIVATE KEY');
    expect(stored.attributes).toHaveProperty('__sealedSecrets');
    expect(
      JSON.stringify(await secure!.drafts(bookId, 'settings', {}, actor)),
    ).not.toContain('ciphertext');
    expect(
      JSON.stringify(
        await db.accountingCommand.findMany({ where: { bookId } }),
      ),
    ).not.toContain('PRIVATE KEY');
    const snapshot = await new AccountingService(
      { client: db } as never,
      {} as never,
    ).snapshot(bookId, actor);
    expect(snapshot.configurations.some((c) => c.id === row.id)).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain('ciphertext');
    const changed = await secure!.saveDraft(
      bookId,
      'settings',
      {
        id: row.id,
        version: row.version,
        key: randomUUID(),
        values: {
          lkpSendingType_ComboBox_Input: 'ارسال از شرکت معتمد',
          txtTitle: 'Synthetic indirect profile',
          lkpIndirectCompany_ComboBox_Input: 'synthetic-provider',
          txtIndirectServiceAddress: 'https://provider.invalid',
          txtIndirectUserName: 'synthetic-provider-user',
        },
      },
      actor,
    );
    expect(changed.storedSecretFields).toBeUndefined();
  }, 30000);
});
