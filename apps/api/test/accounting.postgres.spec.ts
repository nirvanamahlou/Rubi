import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import {
  ACCOUNTING_PERMISSIONS,
  type AuthenticatedActor,
  type AccountingJournalV1,
} from '@nora/contracts';
import { AccountingService } from '../src/finance/accounting/accounting.service';

const url = process.env.ACCOUNTING_TEST_DATABASE_URL;
describe.skipIf(!url)('accounting on isolated PostgreSQL', () => {
  let db: DatabaseClient,
    service: AccountingService,
    bookId: string,
    periodId: string,
    typeId: string,
    debitId: string,
    creditId: string;
  const branchId = randomUUID(),
    makerId = randomUUID(),
    checkerId = randomUUID();
  const maker: AuthenticatedActor = {
    userId: makerId,
    sessionId: randomUUID(),
    branchIds: [branchId],
    permissions: [
      'finance.read',
      'finance.account.manage',
      ...ACCOUNTING_PERMISSIONS,
    ],
  };
  const checker: AuthenticatedActor = { ...maker, userId: checkerId };
  const command = async <T = Record<string, unknown>>(
    action: string,
    payload: Record<string, unknown>,
    expectedVersion?: number,
    actor = maker,
    key = randomUUID(),
  ) =>
    JSON.parse(
      JSON.stringify(
        await service.command(
          bookId,
          action,
          {
            key,
            payload,
            ...(expectedVersion !== undefined ? { expectedVersion } : {}),
          },
          actor,
        ),
      ),
    ) as T;
  beforeAll(async () => {
    const target = new URL(url!);
    if (
      target.hostname !== '127.0.0.1' ||
      target.port !== '55437' ||
      !['/accounting_test', '/accounting_clean'].includes(target.pathname)
    )
      throw new Error('Dedicated accounting test container required.');
    db = createDatabaseClient(url);
    await db.branch.create({
      data: {
        id: branchId,
        code: branchId,
        name: 'Synthetic accounting branch',
      },
    });
    for (const id of [makerId, checkerId])
      await db.user.create({
        data: {
          id,
          username: id,
          displayName: 'Synthetic accountant',
          passwordHash: 'not-a-login-credential',
        },
      });
    service = new AccountingService(
      { client: db } as never,
      {
        branches: async (ids: string[]) =>
          ids.includes(branchId)
            ? [{ id: branchId, name: 'Synthetic', code: 'A' }]
            : [],
      } as never,
    );
    bookId = (
      await service.createBook(
        {
          id: randomUUID(),
          branchId,
          code: '01',
          title: 'Synthetic book',
          baseCurrency: 'IRR',
          approvalPolicy: 'DUAL_CONTROL',
        },
        maker,
      )
    ).id;
    const year = await command('save-configuration', {
      kind: 'fiscal-years',
      code: '2026',
      title: 'Fiscal 2026',
      attributes: { startDate: '2026-01-01', endDate: '2026-12-31' },
    });
    periodId = String(
      (
        await command('save-period', {
          fiscalYearId: year.id,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        })
      ).id,
    );
    typeId = String(
      (
        await command('save-configuration', {
          kind: 'voucher-types',
          code: '01',
          title: 'Manual journal',
        })
      ).id,
    );
    const group = await command('save-account', {
      code: '1',
      title: 'Assets',
      level: 'GROUP',
      nature: 'DEBIT',
    });
    const general = await command('save-account', {
      code: '11',
      title: 'Cash',
      level: 'GENERAL',
      nature: 'DEBIT',
      parentId: group.id,
    });
    debitId = String(
      (
        await command('save-account', {
          code: '1101',
          title: 'Bank cash',
          level: 'SUBSIDIARY',
          nature: 'DEBIT',
          parentId: general.id,
        })
      ).id,
    );
    creditId = String(
      (
        await command('save-account', {
          code: '1102',
          title: 'Clearing',
          level: 'SUBSIDIARY',
          nature: 'CREDIT',
          parentId: general.id,
        })
      ).id,
    );
  }, 60000);
  afterAll(async () => {
    await db?.$disconnect();
  });
  const draft = () =>
    command<AccountingJournalV1>('journal-save', {
      periodId,
      typeId,
      documentDate: '2026-05-01',
      description: 'Synthetic transfer',
      lines: [
        { accountId: debitId, debit: '100', credit: '0' },
        { accountId: creditId, debit: '0', credit: '100' },
      ],
    });
  const post = async () => {
    let j = await draft();
    j = await command<AccountingJournalV1>('submit', { id: j.id }, j.version);
    j = await command<AccountingJournalV1>(
      'approve',
      { id: j.id },
      j.version,
      checker,
    );
    return command<AccountingJournalV1>('post', { id: j.id }, j.version);
  };
  it('persists incomplete drafts without effects', async () => {
    const j = await command<AccountingJournalV1>('journal-save', { lines: [] });
    expect(j.status).toBe('DRAFT');
    await expect(command('submit', { id: j.id }, j.version)).rejects.toThrow();
    await command('cancel', { id: j.id }, j.version);
  });
  it('preserves command audit evidence at the database boundary', async () => {
    const audit = await db.accountingCommand.findFirstOrThrow({
      where: { bookId },
    });
    await expect(
      db.accountingCommand.update({
        where: { id: audit.id },
        data: { hash: 'tampered' },
      }),
    ).rejects.toThrow();
    await expect(
      db.accountingCommand.delete({ where: { id: audit.id } }),
    ).rejects.toThrow();
  });
  it('denies another branch and denies missing action permissions', async () => {
    await expect(
      service.snapshot(bookId, { ...maker, branchIds: [randomUUID()] }),
    ).rejects.toThrow();
    await expect(
      command('save-account', {}, undefined, {
        ...maker,
        permissions: ['finance.read', 'finance.journal.read'],
      }),
    ).rejects.toThrow();
  });
  it('requires balanced rows and independent checker', async () => {
    let j = await draft();
    j = await command<AccountingJournalV1>('submit', { id: j.id }, j.version);
    await expect(command('approve', { id: j.id }, j.version)).rejects.toThrow();
    await command('cancel', { id: j.id }, j.version);
  });
  it('replays same command, rejects key reuse and stale changes', async () => {
    const key = randomUUID();
    const j = await command<AccountingJournalV1>(
      'journal-save',
      { lines: [] },
      undefined,
      maker,
      key,
    );
    expect(
      (
        await command<AccountingJournalV1>(
          'journal-save',
          { lines: [] },
          undefined,
          maker,
          key,
        )
      ).id,
    ).toBe(j.id);
    await expect(
      command(
        'journal-save',
        { lines: [{ debit: '1', credit: '0' }] },
        undefined,
        maker,
        key,
      ),
    ).rejects.toThrow();
    await expect(
      command('journal-save', { id: j.id, lines: [] }, 0),
    ).rejects.toThrow();
    await command('cancel', { id: j.id }, j.version);
  });
  it('posts atomically and database rejects modification of posted effects', async () => {
    const j = await post();
    expect(j.number).toBeGreaterThan(0);
    await expect(
      command('journal-save', { id: j.id, lines: [] }, j.version),
    ).rejects.toThrow();
    await expect(
      db.accountingJournal.update({
        where: { id: j.id },
        data: { description: 'Tampered' },
      }),
    ).rejects.toThrow();
    await expect(
      db.accountingJournalLine.updateMany({
        where: { journalId: j.id },
        data: { debit: '0' },
      }),
    ).rejects.toThrow();
  });
  it('permits only one concurrent post with unique serial', async () => {
    let j = await draft();
    j = await command<AccountingJournalV1>('submit', { id: j.id }, j.version);
    j = await command<AccountingJournalV1>(
      'approve',
      { id: j.id },
      j.version,
      checker,
    );
    const outcomes = await Promise.allSettled([
      command('post', { id: j.id }, j.version),
      command('post', { id: j.id }, j.version),
    ]);
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
  });
  it('reversal retains original and offsets only once posted', async () => {
    const original = await post();
    const before = await service.report(bookId, {}, maker);
    let reversal = await command<AccountingJournalV1>(
      'reverse',
      {
        id: original.id,
        periodId,
        documentDate: '2026-05-02',
        reason: 'Synthetic correction',
      },
      original.version,
    );
    expect((await service.report(bookId, {}, maker)).rows).toEqual(before.rows);
    reversal = await command<AccountingJournalV1>(
      'submit',
      { id: reversal.id },
      reversal.version,
    );
    reversal = await command<AccountingJournalV1>(
      'approve',
      { id: reversal.id },
      reversal.version,
      checker,
    );
    await command('post', { id: reversal.id }, reversal.version);
    expect(
      (
        await db.accountingJournal.findUniqueOrThrow({
          where: { id: original.id },
        })
      ).status,
    ).toBe('POSTED');
    await expect(
      command(
        'reverse',
        {
          id: original.id,
          periodId,
          documentDate: '2026-05-02',
          reason: 'Second correction',
        },
        original.version,
      ),
    ).rejects.toThrow();
  });
  it('canonical request replay tolerates property order and cancelled drafts restore', async () => {
    const key = randomUUID();
    let j = await command<AccountingJournalV1>(
      'journal-save',
      { description: 'Canonical replay', lines: [] },
      undefined,
      maker,
      key,
    );
    expect(
      (
        await command<AccountingJournalV1>(
          'journal-save',
          { lines: [], description: 'Canonical replay' },
          undefined,
          maker,
          key,
        )
      ).id,
    ).toBe(j.id);
    j = await command<AccountingJournalV1>('cancel', { id: j.id }, j.version);
    j = await command<AccountingJournalV1>('restore', { id: j.id }, j.version);
    expect(j.status).toBe('DRAFT');
    await command('cancel', { id: j.id }, j.version);
  });
  it('checks live approval policy version again before posting', async () => {
    let j = await draft();
    j = await command<AccountingJournalV1>('submit', { id: j.id }, j.version);
    j = await command<AccountingJournalV1>(
      'approve',
      { id: j.id },
      j.version,
      checker,
    );
    const policy = await db.accountingConfiguration.findFirstOrThrow({
      where: { bookId, kind: 'approval-policies' },
    });
    await command(
      'save-configuration',
      { ...policy, attributes: policy.attributes },
      policy.version,
    );
    await expect(command('post', { id: j.id }, j.version)).rejects.toThrow();
    await command('cancel', { id: j.id }, j.version);
  });
  it('enforces detail type classification and parent rules and allocates codes atomically', async () => {
    const root = await command('save-configuration', {
      kind: 'detail-types',
      code: '01',
      title: 'Cost centre',
      attributes: { classificationNumberLength: '2', defaultFirstCode: '001' },
    });
    const child = await command('save-configuration', {
      kind: 'detail-types',
      code: '02',
      title: 'Project',
      attributes: {
        classificationNumberLength: '3',
        parentTypeId: root.id,
        enforceParent: true,
        defaultFirstCode: '010',
      },
    });
    const parent = await command('save-detail', {
      typeId: root.id,
      title: 'Root',
      attributes: { classificationNumber: '01' },
    });
    await expect(
      command('save-detail', {
        typeId: child.id,
        title: 'Invalid',
        attributes: { classificationNumber: '001' },
      }),
    ).rejects.toThrow();
    await expect(
      command('save-detail', {
        typeId: child.id,
        parentId: parent.id,
        title: 'Invalid',
        attributes: { classificationNumber: '01' },
      }),
    ).rejects.toThrow();
    const children = await Promise.all([
      command('save-detail', {
        typeId: child.id,
        parentId: parent.id,
        title: 'First',
        attributes: { classificationNumber: '001' },
      }),
      command('save-detail', {
        typeId: child.id,
        parentId: parent.id,
        title: 'Second',
        attributes: { classificationNumber: '002' },
      }),
    ]);
    expect(new Set(children.map((c) => c.code)).size).toBe(2);
    expect(children.map((c) => c.code).sort()).toEqual(['010', '011']);
  }, 30000);
  it('conserves allocation, deduplicates source basis, and leaves draft effects out of reports', async () => {
    const template = await command('save-configuration', {
      kind: 'allocation-templates',
      code: '01',
      title: 'Allocation',
      attributes: {
        sourceAccountId: creditId,
        targets: JSON.stringify([{ accountId: debitId, percentage: '100' }]),
      },
    });
    const payload = {
      templateId: template.id,
      templateVersion: template.version,
      amount: '51',
      basisReference: 'SYNTHETIC-BASIS',
      periodId,
      typeId,
      documentDate: '2026-05-10',
    };
    const before = await service.report(bookId, {}, maker);
    const j = await command<AccountingJournalV1>('allocation-run', payload);
    const replay = await command<AccountingJournalV1>(
      'allocation-run',
      payload,
    );
    expect(replay.id).toBe(j.id);
    expect(j.lines.map((r) => String(r.debit))).toContain('51');
    expect((await service.report(bookId, {}, maker)).rows).toEqual(before.rows);
    await command('cancel', { id: j.id }, j.version);
  });
  it('uses confirmed finance source amount, branch scope and deduplication', async () => {
    const sourceId = randomUUID();
    let scoped: string[] = [];
    const sourceService = new AccountingService(
      { client: db } as never,
      {} as never,
      {
        history: async (_query: unknown, actor: AuthenticatedActor) => {
          scoped = actor.branchIds;
          return {
            items: [
              {
                id: sourceId,
                source: 'OPERATIONAL',
                title: 'Synthetic receipt',
                requestId: randomUUID(),
                amount: '75',
                currencyCode: 'IRR',
                reference: 'SYNTHETIC',
              },
            ],
          };
        },
      } as never,
    );
    const payload = {
      source: 'OPERATIONAL',
      recordId: sourceId,
      periodId,
      typeId,
      documentDate: '2026-05-10',
      debitAccountId: debitId,
      creditAccountId: creditId,
      amount: '999',
    };
    const call = () =>
      sourceService.command(
        bookId,
        'source-journal',
        { key: randomUUID(), payload },
        maker,
      ) as Promise<AccountingJournalV1>;
    const j = await call();
    expect(scoped).toEqual([branchId]);
    expect(String(j.lines[0]!.debit)).toBe('75');
    expect((await call()).id).toBe(j.id);
    await expect(
      command(
        'journal-save',
        {
          ...j,
          lines: j.lines.map((l) => ({
            ...l,
            debit: l.debit === '75' ? '76' : l.debit,
          })),
        },
        j.version,
      ),
    ).rejects.toThrow();
    await command('cancel', { id: j.id }, j.version);
  });
  it('uses immutable approved FX snapshots, revalues exact quantities, and rejects changed basis', async () => {
    const base = await db.accountingAccount.findUniqueOrThrow({
      where: { id: debitId },
    });
    const account = await command('save-account', {
      code: '1103',
      title: 'Foreign cash',
      parentId: base.parentId,
      level: 'SUBSIDIARY',
      nature: 'DEBIT',
      attributes: { multiCurrency: true, revaluable: true },
    });
    const saveRate = async (rate: string) => {
      let fx = await command('save-fx', {
        currency: 'USD',
        rate,
        source: 'Synthetic rate',
        validFrom: new Date(Date.now() - 60000).toISOString(),
        validTo: new Date(Date.now() + 86400000).toISOString(),
      });
      await expect(
        command('approve-fx', { id: fx.id }, Number(fx.version)),
      ).rejects.toThrow();
      fx = await command(
        'approve-fx',
        { id: fx.id },
        Number(fx.version),
        checker,
      );
      return fx;
    };
    const fx = await saveRate('100.123456789012345678');
    expect(String(fx.rate)).toBe('100.123456789012345678');
    await expect(
      db.accountingFxSnapshot.update({
        where: { id: String(fx.id) },
        data: { rate: '101' },
      }),
    ).rejects.toThrow();
    let j = await command<AccountingJournalV1>('journal-save', {
      periodId,
      typeId,
      documentDate: '2026-05-10',
      description: 'Synthetic FX',
      lines: [
        {
          accountId: account.id,
          debit: '1001',
          credit: '0',
          currency: 'USD',
          foreignAmount: '10',
          rate: String(fx.rate),
          fxSnapshotId: fx.id,
        },
        { accountId: creditId, debit: '0', credit: '1001' },
      ],
    });
    j = await command<AccountingJournalV1>('submit', { id: j.id }, j.version);
    j = await command<AccountingJournalV1>(
      'approve',
      { id: j.id },
      j.version,
      checker,
    );
    await command('post', { id: j.id }, j.version);
    const next = await saveRate('110');
    const payload = {
      periodId,
      asOfDate: '2026-05-11',
      typeId,
      gainAccountId: creditId,
      lossAccountId: debitId,
      rates: { USD: next.id },
      reason: 'Synthetic revaluation',
    };
    const preview = await command<{
      basisChecksum: string;
      rows: { difference: string }[];
    }>('revaluation-preview', payload);
    expect(preview.rows[0]!.difference).toBe('99');
    let revalue = await command<AccountingJournalV1>('revaluation-run', {
      ...payload,
      basisChecksum: preview.basisChecksum,
    });
    expect(revalue.status).toBe('DRAFT');
    revalue = await command<AccountingJournalV1>(
      'submit',
      { id: revalue.id },
      revalue.version,
    );
    revalue = await command<AccountingJournalV1>(
      'approve',
      { id: revalue.id },
      revalue.version,
      checker,
    );
    await command('post', { id: revalue.id }, revalue.version);
    const after = await command<{ rows: { difference: string }[] }>(
      'revaluation-preview',
      payload,
    );
    expect(after.rows[0]!.difference).toBe('0');
    const rate120 = await saveRate('120'),
      changed = { ...payload, rates: { USD: rate120.id } };
    const p2 = await command<{ basisChecksum: string }>(
      'revaluation-preview',
      changed,
    );
    const stale = await command<AccountingJournalV1>('revaluation-run', {
      ...changed,
      basisChecksum: p2.basisChecksum,
    });
    let extra = await command<AccountingJournalV1>('journal-save', {
      periodId,
      typeId,
      documentDate: '2026-05-10',
      description: 'Extra FX',
      lines: [
        {
          accountId: account.id,
          debit: '1001',
          credit: '0',
          currency: 'USD',
          foreignAmount: '10',
          rate: String(fx.rate),
          fxSnapshotId: fx.id,
        },
        { accountId: creditId, debit: '0', credit: '1001' },
      ],
    });
    extra = await command<AccountingJournalV1>(
      'submit',
      { id: extra.id },
      extra.version,
    );
    extra = await command<AccountingJournalV1>(
      'approve',
      { id: extra.id },
      extra.version,
      checker,
    );
    await command('post', { id: extra.id }, extra.version);
    await expect(
      command('submit', { id: stale.id }, stale.version),
    ).rejects.toThrow();
    await command('cancel', { id: stale.id }, stale.version);
  }, 30000);
  it('exports immutable mapped batches and rejects missing export permission', async () => {
    const accounts = await db.accountingAccount.findMany({
      where: { bookId, level: 'SUBSIDIARY' },
    });
    const mapping = await command('save-configuration', {
      kind: 'account-mappings',
      code: 'M1',
      title: 'Mapping',
      attributes: {
        effectiveFrom: '2026-01-01',
        reason: 'Synthetic external mapping',
        rows: JSON.stringify(
          accounts.map((a) => ({ accountId: a.id, targetCode: 'E' + a.code })),
        ),
      },
    });
    const batch = await command('create-batch', {
      mappingId: mapping.id,
      mappingVersion: mapping.version,
      periodId,
    });
    expect(
      (
        await command('create-batch', {
          mappingId: mapping.id,
          mappingVersion: mapping.version,
          periodId,
        })
      ).id,
    ).toBe(batch.id);
    await expect(
      command('export-batch', { id: batch.id }, Number(batch.version)),
    ).rejects.toThrow();
    const result = await command<{ content: string }>(
      'export-batch',
      { id: batch.id },
      Number(batch.version),
      { ...maker, permissions: [...maker.permissions, 'finance.export'] },
    );
    const data = JSON.parse(result.content);
    expect(data.checksum).toBe(
      (batch.attributes as Record<string, string>).checksum,
    );
    expect(data.payload.journals.length).toBeGreaterThan(0);
    await expect(
      command(
        'save-configuration',
        { ...batch, kind: 'posting-batches' },
        Number(batch.version),
      ),
    ).rejects.toThrow();
  });
  it('keeps report totals at leaf level and paged turnover running balances consistent', async () => {
    const report = await service.report(bookId, {}, maker),
      leaf = await service.report(bookId, { level: 'SUBSIDIARY' }, maker);
    expect(report.debit).toBe(leaf.debit);
    const turnover = await service.turnover(
      bookId,
      { accountId: debitId },
      maker,
    );
    expect(turnover.closing).toBe(
      leaf.rows.find((r) => r.accountId === debitId)?.balance,
    );
    expect(turnover.rows.length).toBeGreaterThan(0);
  });
  it('rejects fake tax receipts and incomplete connector activation', async () => {
    await expect(
      command('save-configuration', {
        kind: 'tax-invoices',
        code: 'FAKE',
        title: 'Fake',
        attributes: {},
      }),
    ).rejects.toThrow();
    await expect(
      command('save-configuration', {
        kind: 'tax-settings',
        code: 'FAKE',
        title: 'Fake',
        active: true,
        attributes: {},
      }),
    ).rejects.toThrow();
  });
  it('allows editorial changes on used accounts while protecting posting rules', async () => {
    const account = await db.accountingAccount.findUniqueOrThrow({
      where: { id: debitId },
    });
    const updated = await command(
      'save-account',
      {
        ...account,
        title: 'Renamed bank',
        active: false,
        attributes: {
          traceable: false,
          multiCurrency: false,
          revaluable: false,
          zeroBalanceAtClose: false,
          natureControl: 'NONE',
          detail4Required: false,
          detail5Required: false,
          detail6Required: false,
          detail4TypeId: '',
          detail5TypeId: '',
          detail6TypeId: '',
          description: 'Editorial description',
        },
      },
      account.version,
    );
    expect(updated.title).toBe('Renamed bank');
    expect(updated.active).toBe(false);
    await expect(
      command(
        'save-account',
        { ...updated, attributes: { multiCurrency: true } },
        Number(updated.version),
      ),
    ).rejects.toThrow();
    await command(
      'save-account',
      { ...updated, active: true },
      Number(updated.version),
    );
  });
  it('carries turnover balances across pages within one journal', async () => {
    let j = await command<AccountingJournalV1>('journal-save', {
      periodId,
      typeId,
      documentDate: '2026-06-01',
      description: 'Paged turnover',
      lines: Array.from({ length: 36 }, () => [
        { accountId: debitId, debit: '1', credit: '0' },
        { accountId: creditId, debit: '0', credit: '1' },
      ]).flat(),
    });
    j = await command<AccountingJournalV1>('submit', { id: j.id }, j.version);
    j = await command<AccountingJournalV1>(
      'approve',
      { id: j.id },
      j.version,
      checker,
    );
    await command('post', { id: j.id }, j.version, checker);
    const first = await service.turnover(
      bookId,
      { accountId: debitId, page: '1' },
      maker,
    );
    const second = await service.turnover(
      bookId,
      { accountId: debitId, page: '2' },
      maker,
    );
    expect(first.rows).toHaveLength(30);
    expect(second.rows.length).toBeGreaterThan(0);
    expect(second.rows[0]?.balance).toBe(
      String(Number(first.rows.at(-1)!.balance) + 1),
    );
    expect(second.closing).toBe(first.closing);
  });
  it('enforces traceability and blocking nature checks on posting', async () => {
    const base = await db.accountingAccount.findUniqueOrThrow({
      where: { id: debitId },
    });
    const account = await command('save-account', {
      code: '1104',
      title: 'Controlled account',
      parentId: base.parentId,
      level: 'SUBSIDIARY',
      nature: 'DEBIT',
      attributes: { traceable: true, natureControl: 'BLOCK' },
    });
    let j = await command<AccountingJournalV1>('journal-save', {
      periodId,
      typeId,
      documentDate: '2026-05-12',
      description: 'Controlled journal',
      lines: [
        { accountId: account.id, debit: '0', credit: '1' },
        { accountId: debitId, debit: '1', credit: '0' },
      ],
    });
    await expect(command('submit', { id: j.id }, j.version)).rejects.toThrow();
    j = await command<AccountingJournalV1>(
      'journal-save',
      {
        ...j,
        lines: j.lines.map((l) => ({
          ...l,
          attributes: {
            trackingNumber: 'SYNTHETIC',
            trackingDate: '2026-05-12',
          },
        })),
      },
      j.version,
    );
    await expect(command('submit', { id: j.id }, j.version)).rejects.toThrow();
    await command('cancel', { id: j.id }, j.version);
  });
  it('rejects closure with pending documents and rejects posting after closure', async () => {
    let j = await draft();
    await expect(
      command('close-period', { id: periodId }, 1),
    ).rejects.toThrow();
    await command('cancel', { id: j.id }, j.version);
    await command('close-period', { id: periodId }, 1);
    j = await command<AccountingJournalV1>('journal-save', { lines: [] });
    await expect(
      command('journal-save', { id: j.id, periodId, lines: [] }, j.version),
    ).rejects.toThrow();
  });
  it('opens the next year with historical FX lots after rates expire and reports only the selected period', async () => {
    const year = await command('save-configuration', {
      kind: 'fiscal-years',
      code: '2027',
      title: 'Fiscal 2027',
      attributes: { startDate: '2027-01-01', endDate: '2027-12-31' },
    });
    const next = await command('save-period', {
      fiscalYearId: year.id,
      startDate: '2027-01-01',
      endDate: '2027-12-31',
    });
    const source = await service.report(bookId, { periodId }, maker);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    try {
      let opening = await command<AccountingJournalV1>('year-end-opening', {
        periodId,
        nextPeriodId: next.id,
        typeId,
        documentDate: '2027-01-01',
        fxCarryPolicy: 'HISTORICAL_LOTS',
      });
      expect(opening.lines.some((l) => l.currency === 'USD')).toBe(true);
      opening = await command<AccountingJournalV1>(
        'submit',
        { id: opening.id },
        opening.version,
      );
      opening = await command<AccountingJournalV1>(
        'approve',
        { id: opening.id },
        opening.version,
        checker,
      );
      await command('post', { id: opening.id }, opening.version);
      const report = await service.report(
        bookId,
        { periodId: String(next.id) },
        maker,
      );
      expect(report.rows.map((r) => [r.accountId, r.balance])).toEqual(
        source.rows.map((r) => [r.accountId, r.balance]),
      );
      expect((await service.report(bookId, {}, maker)).rows).toEqual(
        report.rows,
      );
      await expect(
        service.report(
          bookId,
          { periodId: String(next.id), from: '2026-01-01' },
          maker,
        ),
      ).rejects.toThrow();
    } finally {
      vi.useRealTimers();
    }
  }, 30000);
});
