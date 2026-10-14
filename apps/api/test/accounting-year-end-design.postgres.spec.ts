import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AccountingJournalV1, AuthenticatedActor } from '@nora/contracts';
import { AccountingCompletionService } from '../src/finance/accounting/accounting-completion.service';
import { AccountingService } from '../src/finance/accounting/accounting.service';

const url = process.env.ACCOUNTING_DESIGN_TEST_DATABASE_URL;
describe.skipIf(!url)('I01–I05 year-end design on isolated PostgreSQL', () => {
  let db: DatabaseClient;
  beforeAll(() => {
    const target = new URL(url!);
    if (
      target.hostname !== '127.0.0.1' ||
      target.port !== '55494' ||
      target.pathname !== '/accounting_design_qa'
    )
      throw new Error('Dedicated design QA database required');
    db = createDatabaseClient(url);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });
  async function fixture(
    cashNature: 'ANY' | 'DEBIT' | 'CREDIT' = 'ANY',
    tracked = false,
  ) {
    const branchId = randomUUID(),
      makerId = randomUUID(),
      checkerId = randomUUID();
    await db.branch.create({
      data: { id: branchId, code: branchId, name: 'Synthetic year-end branch' },
    });
    for (const id of [makerId, checkerId])
      await db.user.create({
        data: {
          id,
          username: id,
          displayName: 'Synthetic year-end actor',
          passwordHash: 'not-a-login-credential',
        },
      });
    const actor: AuthenticatedActor = {
      userId: makerId,
      sessionId: randomUUID(),
      branchIds: [branchId],
      permissions: [
        'finance.read',
        'finance.account.manage',
        'finance.journal.read',
        'finance.journal.create',
        'finance.journal.approve',
        'finance.journal.post',
        'finance.period.close',
      ],
    };
    const checker = { ...actor, userId: checkerId };
    const service = new AccountingService(
      { client: db } as never,
      {
        branches: async () => [{ id: branchId, code: 'QA', name: 'Synthetic' }],
        displayNames: async (ids: string[]) =>
          ids.map((id) => ({ id, displayName: 'Synthetic' })),
      } as never,
    );
    const book = await service.createBook(
      {
        id: randomUUID(),
        branchId,
        code: 'QA',
        title: 'Synthetic design book',
        baseCurrency: 'IRR',
        approvalPolicy: 'DUAL_CONTROL',
      },
      actor,
    );
    const command = async <T = Record<string, unknown>>(
      action: string,
      payload: Record<string, unknown>,
      expectedVersion?: number,
      who = actor,
      key = randomUUID(),
    ) =>
      (await service.command(
        book.id,
        action,
        { key, payload, expectedVersion },
        who,
      )) as T;
    const year = await command<{ id: string }>('save-configuration', {
      kind: 'fiscal-years',
      code: '2026',
      title: 'Synthetic 2026',
    });
    const period = await command<{ id: string }>('save-period', {
      fiscalYearId: year.id,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    const type = await command<{ id: string }>('save-configuration', {
      kind: 'voucher-types',
      code: '01',
      title: 'Synthetic type',
    });
    const group = await command<{ id: string }>('save-account', {
      code: '1',
      title: 'Synthetic group',
      level: 'GROUP',
      nature: 'ANY',
      permanent: true,
    });
    const general = await command<{ id: string }>('save-account', {
      code: '11',
      title: 'Synthetic general',
      parentId: group.id,
      level: 'GENERAL',
      nature: 'ANY',
      permanent: true,
    });
    const account = async (code: string, permanent = true, nature = 'ANY') =>
      command<{ id: string }>('save-account', {
        code,
        title: `Synthetic ${code}`,
        parentId: general.id,
        level: 'SUBSIDIARY',
        nature,
        permanent,
        ...(tracked && code === '1101'
          ? { attributes: { traceable: true } }
          : {}),
      });
    const cash = await account('1101', true, cashNature),
      income = await account('1102', false),
      retained = await account('1103'),
      other = await account('1104'),
      bridge = await account('1105');
    const post = async (journal: AccountingJournalV1) => {
      let j = await command<AccountingJournalV1>(
        'submit',
        { id: journal.id },
        journal.version,
      );
      j = await command<AccountingJournalV1>(
        'approve',
        { id: j.id },
        j.version,
        checker,
      );
      return command<AccountingJournalV1>('post', { id: j.id }, j.version);
    };
    const source = await command<AccountingJournalV1>('journal-save', {
      periodId: period.id,
      typeId: type.id,
      documentDate: '2026-10-01',
      description: 'Synthetic income',
      lines: [
        {
          accountId: cash.id,
          debit: '1001',
          credit: '0',
          ...(tracked
            ? {
                attributes: {
                  trackingNumber: 'QA-TRACK-01',
                  trackingDate: '2026-10-01',
                },
              }
            : {}),
        },
        { accountId: income.id, debit: '0', credit: '1001' },
      ],
    });
    await post(source);
    return {
      db,
      actor,
      checker,
      service,
      book,
      command,
      period,
      type,
      cash,
      income,
      retained,
      other,
      bridge,
      post,
    };
  }
  it('reports exact scoped posted totals, matrix axes and cross-branch isolation', async () => {
    const f = await fixture();
    const reports = new AccountingCompletionService({ client: db } as never);
    const report = await reports.internalReport(
      f.book.id,
      'analysis',
      { periodId: f.period.id },
      f.actor,
    );
    expect('debit' in report ? report.debit : undefined).toBe('1001');
    expect('credit' in report ? report.credit : undefined).toBe('1001');
    expect(report.sourceCount).toBe(2);
    expect(
      report.rows.map((r) => ('balance' in r ? r.balance : '')).sort(),
    ).toEqual(['-1001', '1001']);
    const matrix = await reports.internalReport(
      f.book.id,
      'matrix',
      { periodId: f.period.id },
      f.actor,
    );
    expect(matrix.axes).toEqual(['account', 'month']);
    await expect(
      reports.internalReport(
        f.book.id,
        'matrix',
        { periodId: f.period.id, axes: 'account' },
        f.actor,
      ),
    ).rejects.toThrow('دو بعد');
    await expect(
      reports.internalReport(
        f.book.id,
        'analysis',
        { periodId: f.period.id },
        { ...f.actor, branchIds: [] },
      ),
    ).rejects.toThrow();
  });
  it('preserves tracked balances and prevents editing generated tracking', async () => {
    const f = await fixture('ANY', true);
    const closePayload = {
      operation: 'year-end-closing',
      periodId: f.period.id,
      retainedAccountId: f.retained.id,
      typeId: f.type.id,
      documentDate: '2026-12-31',
      fxCarryPolicy: 'HISTORICAL_LOTS',
    };
    const closingPreview = await f.command<{ checksum: string }>(
      'year-end-preview',
      closePayload,
    );
    await f.post(
      await f.command<AccountingJournalV1>('year-end-closing', {
        ...closePayload,
        checksum: closingPreview.checksum,
      }),
    );
    const payload = {
      ...closePayload,
      operation: 'year-end-final',
      retainedAccountId: f.bridge.id,
    };
    const preview = await f.command<{ checksum: string }>(
      'year-end-preview',
      payload,
    );
    const final = await f.command<AccountingJournalV1>('year-end-final', {
      ...payload,
      checksum: preview.checksum,
    });
    expect(
      final.lines.find((l) => l.accountId === f.cash.id)?.attributes
        .trackingNumber,
    ).toBe('QA-TRACK-01');
    await expect(
      f.command(
        'journal-save',
        {
          id: final.id,
          periodId: f.period.id,
          typeId: f.type.id,
          documentDate: final.documentDate,
          lines: final.lines.map((l) => ({
            accountId: l.accountId,
            detail4Id: l.detail4Id,
            detail5Id: l.detail5Id,
            detail6Id: l.detail6Id,
            debit: l.debit.toString(),
            credit: l.credit.toString(),
            currency: l.currency,
            rate: l.rate?.toString() ?? null,
            foreignAmount: l.foreignAmount?.toString() ?? null,
            fxSnapshotId: l.fxSnapshotId,
            attributes: {
              ...(l.attributes.trackingNumber
                ? { trackingNumber: l.attributes.trackingNumber }
                : {}),
              ...(l.attributes.trackingDate
                ? { trackingDate: l.attributes.trackingDate }
                : {}),
              ...(l.accountId === f.cash.id
                ? { trackingNumber: 'CHANGED' }
                : {}),
            },
          })),
        },
        final.version,
      ),
    ).rejects.toThrow('جریان اصلی');
    await f.post(final);
  });
  it('previews and posts 60/40 closing once; final and opening restore historical balances', async () => {
    const f = await fixture();
    const template = await f.command<{ id: string; version: number }>(
      'save-template',
      {
        kind: 'CLOSING',
        code: 'C',
        title: 'Synthetic 60/40',
        voucherTypeId: f.type.id,
        retainedAccountId: f.retained.id,
        lines: [
          {
            accountId: f.income.id,
            side: 'CREDIT',
            percentage: '100',
            include: true,
          },
          {
            accountId: f.retained.id,
            side: 'CREDIT',
            percentage: '60',
            include: true,
          },
          {
            accountId: f.other.id,
            side: 'CREDIT',
            percentage: '40',
            include: true,
          },
        ],
      },
    );
    const payload = {
      operation: 'year-end-closing',
      periodId: f.period.id,
      templateId: template.id,
      templateVersion: template.version,
      documentDate: '2026-12-31',
      fxCarryPolicy: 'HISTORICAL_LOTS',
    };
    await expect(
      f.command('year-end-closing', { ...payload, operation: undefined }),
    ).rejects.toThrow('پیش‌نمایش');
    const preview = await f.command<{
      checksum: string;
      lines: { accountId: string; credit: string }[];
    }>('year-end-preview', payload);
    expect(
      preview.lines.find((l) => l.accountId === f.retained.id)?.credit,
    ).toBe('601');
    expect(preview.lines.find((l) => l.accountId === f.other.id)?.credit).toBe(
      '400',
    );
    const key = randomUUID();
    const closing = await f.command<AccountingJournalV1>(
      'year-end-closing',
      { ...payload, checksum: preview.checksum },
      undefined,
      f.actor,
      key,
    );
    expect(
      (
        await f.command<AccountingJournalV1>(
          'year-end-closing',
          { ...payload, checksum: preview.checksum },
          undefined,
          f.actor,
          key,
        )
      ).id,
    ).toBe(closing.id);
    await f.post(closing);
    const finalPayload = {
      operation: 'year-end-final',
      periodId: f.period.id,
      retainedAccountId: f.bridge.id,
      typeId: f.type.id,
      documentDate: '2026-12-31',
      fxCarryPolicy: 'HISTORICAL_LOTS',
    };
    const finalPreview = await f.command<{ checksum: string }>(
      'year-end-preview',
      finalPayload,
    );
    const final = await f.command<AccountingJournalV1>('year-end-final', {
      ...finalPayload,
      checksum: finalPreview.checksum,
    });
    await f.post(final);
    const late = await f.command<AccountingJournalV1>('journal-save', {
      periodId: f.period.id,
      typeId: f.type.id,
      documentDate: '2026-12-31',
      lines: [
        { accountId: f.cash.id, debit: '1', credit: '0' },
        { accountId: f.retained.id, debit: '0', credit: '1' },
      ],
    });
    await expect(f.post(late)).rejects.toThrow('اختتامیه');
    await f.command('cancel', { id: late.id }, late.version);
    await f.command('close-period', { id: f.period.id }, 1);
    const year = await f.command<{ id: string }>('save-configuration', {
      kind: 'fiscal-years',
      code: '2027',
      title: 'Synthetic 2027',
    });
    const next = await f.command<{ id: string }>('save-period', {
      fiscalYearId: year.id,
      startDate: '2027-01-01',
      endDate: '2027-12-31',
    });
    const openingPayload = {
      operation: 'year-end-opening',
      periodId: f.period.id,
      nextPeriodId: next.id,
      typeId: f.type.id,
      documentDate: '2027-01-01',
      fxCarryPolicy: 'HISTORICAL_LOTS',
    };
    const openingPreview = await f.command<{ checksum: string }>(
      'year-end-preview',
      openingPayload,
    );
    const opening = await f.command<AccountingJournalV1>('year-end-opening', {
      ...openingPayload,
      checksum: openingPreview.checksum,
    });
    expect(
      opening.lines.find((l) => l.accountId === f.cash.id)?.debit.toString(),
    ).toBe('1001');
    expect(
      opening.lines
        .find((l) => l.accountId === f.retained.id)
        ?.credit.toString(),
    ).toBe('601');
    expect(
      opening.lines.some(
        (l) => l.accountId === f.income.id || l.accountId === f.bridge.id,
      ),
    ).toBe(false);
    await f.post(opening);
  }, 30000);
  it('rejects stale preview, unfinished final, cross-branch reads and missing adjustment rules', async () => {
    const f = await fixture();
    const payload = {
      operation: 'year-end-closing',
      periodId: f.period.id,
      retainedAccountId: f.retained.id,
      typeId: f.type.id,
      documentDate: '2026-12-31',
      fxCarryPolicy: 'HISTORICAL_LOTS',
    };
    const preview = await f.command<{ checksum: string }>(
      'year-end-preview',
      payload,
    );
    await f.command(
      'save-account',
      {
        id: f.cash.id,
        code: '1101',
        title: 'Changed source',
        parentId: (
          await f.db.accountingAccount.findUniqueOrThrow({
            where: { id: f.cash.id },
          })
        ).parentId,
        level: 'SUBSIDIARY',
        nature: 'ANY',
        permanent: true,
      },
      1,
    );
    await expect(
      f.command('year-end-closing', { ...payload, checksum: preview.checksum }),
    ).rejects.toThrow('پیش‌نمایش');
    await expect(
      f.command('year-end-preview', {
        ...payload,
        operation: 'year-end-final',
        retainedAccountId: f.bridge.id,
      }),
    ).rejects.toThrow('موقت');
    await expect(
      f.service.command(
        f.book.id,
        'year-end-preview',
        { key: randomUUID(), payload },
        { ...f.actor, branchIds: [] },
      ),
    ).rejects.toThrow();
    await expect(
      f.command('year-end-preview', {
        ...payload,
        operation: 'year-end-nature-adjustment',
        accountIds: [f.cash.id],
      }),
    ).rejects.toThrow('ماهیت');
    expect(
      await f.db.accountingJournal.count({
        where: { bookId: f.book.id, sourceKey: { startsWith: 'CLOSE:' } },
      }),
    ).toBe(0);
  });
  it('reissues a cancelled generated draft without erasing history or restoring its old copy', async () => {
    const f = await fixture();
    const payload = {
      operation: 'year-end-closing',
      periodId: f.period.id,
      retainedAccountId: f.retained.id,
      typeId: f.type.id,
      documentDate: '2026-12-31',
      fxCarryPolicy: 'HISTORICAL_LOTS',
    };
    const preview = await f.command<{ checksum: string }>(
      'year-end-preview',
      payload,
    );
    const first = await f.command<AccountingJournalV1>('year-end-closing', {
      ...payload,
      checksum: preview.checksum,
    });
    await f.command(
      'cancel',
      { id: first.id, reason: 'Synthetic cancelled preview' },
      first.version,
    );
    const refreshed = await f.command<{ checksum: string }>(
      'year-end-preview',
      payload,
    );
    const second = await f.command<AccountingJournalV1>('year-end-closing', {
      ...payload,
      checksum: refreshed.checksum,
    });
    expect(second.id).not.toBe(first.id);
    expect(second.attributes.reissueOfId).toBe(first.id);
    const old = await db.accountingJournal.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(old.status).toBe('CANCELLED');
    expect(old.sourceKey).toContain(':CANCELLED:');
    await expect(
      f.command('restore', { id: old.id }, old.version),
    ).rejects.toThrow('جایگزین‌شده');
    await f.post(second);
  });
  it('adjusts only explicitly selected contrary-nature accounts with a distinct permanent counterpart', async () => {
    const f = await fixture('CREDIT');
    const cash = await db.accountingAccount.findUniqueOrThrow({
      where: { id: f.cash.id },
    });
    const payload = {
      operation: 'year-end-nature-adjustment',
      periodId: f.period.id,
      accountIds: [cash.id],
      retainedAccountId: f.bridge.id,
      typeId: f.type.id,
      documentDate: '2026-12-31',
      fxCarryPolicy: 'HISTORICAL_LOTS',
    };
    await expect(
      f.command('year-end-preview', { ...payload, retainedAccountId: cash.id }),
    ).rejects.toThrow('طرف مقابل');
    const preview = await f.command<{ checksum: string }>(
      'year-end-preview',
      payload,
    );
    const adjustment = await f.command<AccountingJournalV1>(
      'year-end-nature-adjustment',
      { ...payload, checksum: preview.checksum },
    );
    expect(
      adjustment.lines.find((l) => l.accountId === cash.id)?.credit.toString(),
    ).toBe('1001');
    expect(
      adjustment.lines
        .find((l) => l.accountId === f.bridge.id)
        ?.debit.toString(),
    ).toBe('1001');
    expect(adjustment.lines.some((l) => l.accountId === f.income.id)).toBe(
      false,
    );
    await f.post(adjustment);
  });
});
