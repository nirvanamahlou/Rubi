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
    key: string = randomUUID(),
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
        displayNames: async (ids: string[]) =>
          ids.map((id) => ({ id, displayName: 'Synthetic accountant' })),
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
  const mutationState = async (id: string) =>
    JSON.parse(
      JSON.stringify({
        journal: await db.accountingJournal.findUniqueOrThrow({
          where: { id },
          include: { lines: { orderBy: { position: 'asc' } } },
        }),
        events: await db.accountingJournalStateEvent.findMany({
          where: { journalId: id },
          orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
        }),
      }),
    ) as Record<string, unknown>;
  const emptyPeriod = async (label: string, year: number) => {
    const fiscalYear = await command('save-configuration', {
      kind: 'fiscal-years',
      code: `${label}-${randomUUID().slice(0, 6)}`,
      title: `${label} fiscal year`,
    });
    return command<{ id: string; version: number; status: string }>(
      'save-period',
      {
        fiscalYearId: fiscalYear.id,
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      },
    );
  };
  const waitForBookLockWaiters = async (expected: number) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const [row] = await db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND wait_event_type = 'Lock'
          AND query ILIKE '%accounting_books%FOR UPDATE%'`;
      if (Number(row?.count ?? 0) >= expected) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Expected ${expected} accounting book lock waiters.`);
  };
  const orderedBookRace = async <T, U>(
    first: () => Promise<T>,
    second: () => Promise<U>,
  ) => {
    let acquired!: () => void, release!: () => void;
    const acquiredPromise = new Promise<void>((resolve) => {
        acquired = resolve;
      }),
      releasePromise = new Promise<void>((resolve) => {
        release = resolve;
      }),
      holder = db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM accounting_books WHERE id=${bookId}::uuid FOR UPDATE`;
          acquired();
          await releasePromise;
        },
        { timeout: 20000 },
      );
    await acquiredPromise;
    const firstPromise = first();
    await waitForBookLockWaiters(1);
    const secondPromise = second();
    await waitForBookLockWaiters(2);
    release();
    await holder;
    return Promise.allSettled([firstPromise, secondPromise]);
  };
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
  it('persists same-book groups and typed templates with atomic CAS membership', async () => {
    const otherBook = await service.createBook(
      {
        id: randomUUID(),
        branchId,
        code: `OTHER-${randomUUID().slice(0, 6)}`,
        title: 'Other synthetic book',
        baseCurrency: 'IRR',
        approvalPolicy: 'DUAL_CONTROL',
      },
      maker,
    );
    const foreignAccount = (await service.command(
      otherBook.id,
      'save-account',
      {
        key: randomUUID(),
        payload: {
          code: '9',
          title: 'Foreign account',
          level: 'GROUP',
          nature: 'DEBIT',
        },
      },
      maker,
    )) as { id: string };
    await expect(
      command('save-account-group', {
        code: 'FOREIGN',
        title: 'Foreign member',
        memberIds: [foreignAccount.id],
      }),
    ).rejects.toThrow();
    const group = await command<{
      id: string;
      version: number;
      members: { accountId: string }[];
    }>('save-account-group', {
      code: 'CURRENT',
      title: 'Current assets',
      memberIds: [debitId, creditId],
    });
    expect(group.members).toHaveLength(2);
    await expect(
      command('save-account-group', {
        code: 'DUPLICATE',
        title: 'Invalid duplicate',
        memberIds: [debitId, debitId],
      }),
    ).rejects.toThrow();
    const updated = await command<{
      id: string;
      version: number;
      members: { accountId: string }[];
    }>(
      'save-account-group',
      { ...group, memberIds: [debitId] },
      Number(group.version),
    );
    expect(
      updated.members.map((member: { accountId: string }) => member.accountId),
    ).toEqual([debitId]);
    await expect(
      command(
        'save-account-group',
        { ...group, memberIds: [creditId] },
        Number(group.version),
      ),
    ).rejects.toThrow();
    const automatic = await command<{
      id: string;
      version: number;
      lines: { percentage: string }[];
    }>('save-template', {
      kind: 'AUTOMATIC',
      code: 'AUTO-1',
      title: 'Synthetic automatic template',
      voucherTypeId: typeId,
      lines: [
        {
          accountId: debitId,
          side: 'DEBIT',
          percentage: '100',
        },
      ],
    });
    expect(automatic.lines[0]!.percentage.toString()).toBe('100');
    await expect(
      command('automatic-run', {
        templateId: automatic.id,
        templateVersion: automatic.version,
      }),
    ).rejects.toThrow();
    await expect(
      command('save-template', {
        kind: 'CLOSING',
        code: 'BAD-PERCENT',
        title: 'Bad percentage',
        voucherTypeId: typeId,
        retainedAccountId: debitId,
        lines: [
          {
            accountId: debitId,
            side: 'DEBIT',
            percentage: '101',
          },
        ],
      }),
    ).rejects.toThrow();
  });
  it('enforces concurrent group/template CAS, exact percentages, replacement rollback and same-book database constraints', async () => {
    const group = await command<{
      id: string;
      version: number;
      members: { accountId: string }[];
    }>('save-account-group', {
      code: `CAS-${randomUUID().slice(0, 6)}`,
      title: 'Concurrent group',
      memberIds: [debitId],
    });
    const groupKeys = [randomUUID(), randomUUID()];
    const groupRace = await Promise.allSettled([
      command(
        'save-account-group',
        {
          id: group.id,
          code: group.id.slice(0, 20),
          title: 'Winner A',
          memberIds: [debitId],
        },
        group.version,
        maker,
        groupKeys[0],
      ),
      command(
        'save-account-group',
        {
          id: group.id,
          code: group.id.slice(0, 20),
          title: 'Winner B',
          memberIds: [creditId],
        },
        group.version,
        maker,
        groupKeys[1],
      ),
    ]);
    expect(
      groupRace.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      groupRace.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      await db.accountingCommand.count({
        where: { bookId, key: { in: groupKeys } },
      }),
    ).toBe(1);
    const storedGroup = await db.accountingAccountGroup.findUniqueOrThrow({
      where: { id: group.id },
      include: { members: true },
    });
    expect(storedGroup.version).toBe(2);
    expect(storedGroup.members).toHaveLength(1);

    const template = await command<{
      id: string;
      version: number;
      lines: { percentage: { toString(): string } | string }[];
    }>('save-template', {
      kind: 'AUTOMATIC',
      code: `PCT-${randomUUID().slice(0, 6)}`,
      title: 'Exact percentage template',
      voucherTypeId: typeId,
      lines: [{ accountId: debitId, side: 'DEBIT', percentage: '1.12345678' }],
    });
    expect(template.lines[0]!.percentage.toString()).toBe('1.12345678');
    const tiny = await command<{
      id: string;
      version: number;
      lines: { percentage: string }[];
    }>('save-template', {
      kind: 'AUTOMATIC',
      code: `TINY-${randomUUID().slice(0, 6)}`,
      title: 'Tiny exact percentage',
      voucherTypeId: typeId,
      lines: [{ accountId: debitId, side: 'DEBIT', percentage: '0.00000001' }],
    });
    expect(tiny.lines[0]!.percentage).toBe('0.00000001');
    const tinyUpdated = await command<typeof tiny>(
      'save-template',
      {
        id: tiny.id,
        kind: 'AUTOMATIC',
        code: `TINY-${tiny.id.slice(0, 6)}`,
        title: 'Tiny exact percentage saved again',
        voucherTypeId: typeId,
        lines: [
          {
            accountId: debitId,
            side: 'DEBIT',
            percentage: tiny.lines[0]!.percentage,
          },
        ],
      },
      tiny.version,
    );
    expect(tinyUpdated.lines[0]!.percentage).toBe('0.00000001');
    const tinySnapshot = await service.snapshot(bookId, maker);
    expect(
      tinySnapshot.templates.find((item) => item.id === tiny.id)?.lines[0]
        ?.percentage,
    ).toBe('0.00000001');
    const normalized = await command<typeof template>(
      'save-template',
      {
        id: template.id,
        kind: 'AUTOMATIC',
        code: `PCT-${template.id.slice(0, 6)}`,
        title: 'Exact percentage template',
        voucherTypeId: typeId,
        lines: [
          { accountId: debitId, side: 'DEBIT', percentage: '1.123456780000' },
        ],
      },
      template.version,
    );
    expect(normalized.lines[0]!.percentage.toString()).toBe('1.12345678');
    for (const percentage of ['1.123456789', '0.000000001'])
      await expect(
        command(
          'save-template',
          {
            id: template.id,
            kind: 'AUTOMATIC',
            code: `PCT-${template.id.slice(0, 6)}`,
            title: 'Rejected replacement',
            voucherTypeId: typeId,
            lines: [{ accountId: creditId, side: 'CREDIT', percentage }],
          },
          normalized.version,
        ),
      ).rejects.toThrow();
    const afterRejectedReplacement =
      await db.accountingTemplate.findUniqueOrThrow({
        where: { id: template.id },
        include: { lines: true },
      });
    expect(afterRejectedReplacement.version).toBe(normalized.version);
    expect(afterRejectedReplacement.lines).toHaveLength(1);
    expect(afterRejectedReplacement.lines[0]!.accountId).toBe(debitId);
    expect(afterRejectedReplacement.lines[0]!.percentage.toString()).toBe(
      '1.12345678',
    );

    const templateKeys = [randomUUID(), randomUUID()];
    const templateRace = await Promise.allSettled([
      command(
        'save-template',
        {
          id: template.id,
          kind: 'AUTOMATIC',
          code: `PCT-${template.id.slice(0, 6)}`,
          title: 'Template winner A',
          voucherTypeId: typeId,
          lines: [{ accountId: debitId, side: 'DEBIT', percentage: '25' }],
        },
        normalized.version,
        maker,
        templateKeys[0],
      ),
      command(
        'save-template',
        {
          id: template.id,
          kind: 'AUTOMATIC',
          code: `PCT-${template.id.slice(0, 6)}`,
          title: 'Template winner B',
          voucherTypeId: typeId,
          lines: [{ accountId: creditId, side: 'CREDIT', percentage: '75' }],
        },
        normalized.version,
        maker,
        templateKeys[1],
      ),
    ]);
    expect(
      templateRace.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      templateRace.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      await db.accountingCommand.count({
        where: { bookId, key: { in: templateKeys } },
      }),
    ).toBe(1);
    const storedTemplate = await db.accountingTemplate.findUniqueOrThrow({
      where: { id: template.id },
      include: { lines: true },
    });
    expect(storedTemplate.version).toBe(normalized.version + 1);
    expect(storedTemplate.lines).toHaveLength(1);

    const otherBook = await service.createBook(
      {
        id: randomUUID(),
        branchId,
        code: `FK-${randomUUID().slice(0, 6)}`,
        title: 'Foreign FK book',
        baseCurrency: 'IRR',
        approvalPolicy: 'DUAL_CONTROL',
      },
      maker,
    );
    const foreignType = (await service.command(
      otherBook.id,
      'save-configuration',
      {
        key: randomUUID(),
        payload: {
          kind: 'detail-types',
          code: '01',
          title: 'Foreign type',
          attributes: {
            classificationNumberLength: '2',
            defaultFirstCode: '01',
          },
        },
      },
      maker,
    )) as { id: string };
    const foreignDetail = (await service.command(
      otherBook.id,
      'save-detail',
      {
        key: randomUUID(),
        payload: {
          typeId: foreignType.id,
          code: '01',
          title: 'Foreign detail',
        },
      },
      maker,
    )) as { id: string };
    const detailGroup = await command<{ id: string }>('save-detail-group', {
      code: `DG-${randomUUID().slice(0, 6)}`,
      title: 'Database FK group',
      memberIds: [],
    });
    await expect(
      db.accountingDetailGroupMember.create({
        data: {
          bookId,
          groupId: detailGroup.id,
          detailId: foreignDetail.id,
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.accountingTemplateLine.create({
        data: {
          bookId,
          templateId: template.id,
          position: 20,
          accountId: debitId,
          detail4Id: foreignDetail.id,
          side: 'DEBIT',
          percentage: '1',
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.accountingTemplateLine.create({
        data: {
          bookId,
          templateId: template.id,
          position: storedTemplate.lines[0]!.position,
          accountId: debitId,
          side: 'DEBIT',
          percentage: '1',
        },
      }),
    ).rejects.toThrow();

    const foreignJournal = (await service.command(
      otherBook.id,
      'journal-save',
      { key: randomUUID(), payload: { lines: [] } },
      maker,
    )) as { id: string; version: number };
    const foreignCommand = await db.accountingCommand.findFirstOrThrow({
      where: { bookId: otherBook.id, action: 'journal-save' },
      orderBy: { createdAt: 'desc' },
    });
    await expect(
      db.accountingJournalStateEvent.create({
        data: {
          bookId: otherBook.id,
          journalId: foreignJournal.id,
          commandId: foreignCommand.id,
          actorId: makerId,
          sequence: 99,
          eventType: 'MOVE',
          fromStatus: 'DRAFT',
          toStatus: 'DRAFT',
          journalVersion: 99,
          oldPeriodId: periodId,
        },
      }),
    ).rejects.toThrow();
  }, 30000);
  it('moves returned drafts atomically, resets approval residue and appends immutable events once', async () => {
    let journal = await draft();
    journal = await command<AccountingJournalV1>(
      'submit',
      { id: journal.id },
      journal.version,
    );
    journal = await command<AccountingJournalV1>(
      'approve',
      { id: journal.id },
      journal.version,
      checker,
    );
    journal = await command<AccountingJournalV1>(
      'return',
      { id: journal.id, reason: 'Synthetic correction' },
      journal.version,
      checker,
    );
    expect(journal.approverId).toBeNull();
    expect(journal.attributes).not.toHaveProperty('approvalPolicyId');
    expect(journal.attributes).not.toHaveProperty('approvalPolicyVersion');
    expect(journal.attributes).not.toHaveProperty('warnings');
    const key = randomUUID();
    const payload = {
      items: [{ id: journal.id, expectedVersion: journal.version }],
      periodId,
      documentDate: '2026-05-03',
      reason: 'Move after return',
    };
    const moved = await command<{ items: AccountingJournalV1[] }>(
      'move-drafts',
      payload,
      undefined,
      checker,
      key,
    );
    expect(moved.items[0]!.makerId).toBe(checkerId);
    expect(moved.items[0]!.documentDate).toBe('2026-05-03');
    const eventCount = await db.accountingJournalStateEvent.count({
      where: { journalId: journal.id },
    });
    await command('move-drafts', payload, undefined, checker, key);
    expect(
      await db.accountingJournalStateEvent.count({
        where: { journalId: journal.id },
      }),
    ).toBe(eventCount);
    const events = await db.accountingJournalStateEvent.findMany({
      where: { journalId: journal.id },
      include: { command: true },
      orderBy: { sequence: 'asc' },
    });
    expect(events.some((event) => event.eventType === 'MOVE')).toBe(true);
    expect(
      events.every((event) => event.actorId === event.command.actorId),
    ).toBe(true);
    await expect(
      db.accountingJournalStateEvent.update({
        where: { id: events[0]!.id },
        data: { reason: 'tampered' },
      }),
    ).rejects.toThrow();
    await command(
      'cancel',
      { id: journal.id },
      moved.items[0]!.version,
      checker,
    );
    const first = await draft(),
      second = await draft();
    await expect(
      command(
        'journal-save',
        {
          id: first.id,
          description: first.description,
          typeId,
          lines: first.lines,
        },
        first.version,
      ),
    ).rejects.toThrow();
    await expect(
      command(
        'journal-save',
        {
          ...first,
          documentDate: '2027-01-01',
          attributes: {},
          lines: first.lines,
        },
        first.version,
      ),
    ).rejects.toThrow();
    const closedYear = await command('save-configuration', {
        kind: 'fiscal-years',
        code: `CLOSED-${randomUUID().slice(0, 6)}`,
        title: 'Closed synthetic year',
      }),
      closedPeriod = await command('save-period', {
        fiscalYearId: closedYear.id,
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      });
    await command('close-period', { id: closedPeriod.id }, 1);
    await expect(
      command(
        'journal-save',
        {
          ...first,
          periodId: closedPeriod.id,
          documentDate: '2025-06-01',
          attributes: {},
          lines: first.lines,
        },
        first.version,
      ),
    ).rejects.toThrow();
    await expect(
      command('move-drafts', {
        items: [
          { id: first.id, expectedVersion: first.version },
          { id: second.id, expectedVersion: second.version + 1 },
        ],
        periodId,
        documentDate: '2026-05-04',
        reason: 'Atomic failure',
      }),
    ).rejects.toThrow();
    expect(
      (
        await db.accountingJournal.findUniqueOrThrow({
          where: { id: first.id },
        })
      ).documentDate,
    ).toBe('2026-05-01');
    await command('cancel', { id: first.id }, first.version);
    await command('cancel', { id: second.id }, second.version);
  });
  it('rejects move authority/provenance violations and serializes both move entrypoints against transitions', async () => {
    const unprivileged: AuthenticatedActor = {
      userId: makerId,
      sessionId: randomUUID(),
      branchIds: [branchId],
      permissions: ['finance.read'],
    };
    const permissionDraft = await draft();
    await expect(
      command(
        'move-drafts',
        {
          items: [
            {
              id: permissionDraft.id,
              expectedVersion: permissionDraft.version,
            },
          ],
          periodId,
          documentDate: '2026-05-07',
          reason: 'Must not move',
        },
        undefined,
        unprivileged,
      ),
    ).rejects.toThrow();
    expect(
      await db.accountingJournal.findUniqueOrThrow({
        where: { id: permissionDraft.id },
      }),
    ).toMatchObject({
      version: permissionDraft.version,
      documentDate: '2026-05-01',
    });

    const foreignActorId = randomUUID();
    await db.user.create({
      data: {
        id: foreignActorId,
        username: foreignActorId,
        displayName: 'Synthetic restricted accountant',
        passwordHash: 'not-a-login-credential',
      },
    });
    const foreignActor: AuthenticatedActor = {
      userId: foreignActorId,
      sessionId: randomUUID(),
      branchIds: [branchId],
      permissions: ['finance.read', 'finance.journal.create'],
    };
    await expect(
      command(
        'move-drafts',
        {
          items: [
            {
              id: permissionDraft.id,
              expectedVersion: permissionDraft.version,
            },
          ],
          periodId,
          documentDate: '2026-05-07',
          reason: 'Foreign maker',
        },
        undefined,
        foreignActor,
      ),
    ).rejects.toThrow();
    await expect(
      command('move-drafts', {
        items: [
          { id: permissionDraft.id, expectedVersion: permissionDraft.version },
          { id: permissionDraft.id, expectedVersion: permissionDraft.version },
        ],
        periodId,
        documentDate: '2026-05-07',
        reason: 'Duplicate ids',
      }),
    ).rejects.toThrow();

    await db.accountingJournal.update({
      where: { id: permissionDraft.id },
      data: { number: 991001 },
    });
    await expect(
      command('move-drafts', {
        items: [
          { id: permissionDraft.id, expectedVersion: permissionDraft.version },
        ],
        periodId,
        documentDate: '2026-05-07',
        reason: 'Numbered draft',
      }),
    ).rejects.toThrow();
    await db.accountingJournal.update({
      where: { id: permissionDraft.id },
      data: { number: null, sourceKey: `GENERATED:${randomUUID()}` },
    });
    await expect(
      command(
        'journal-save',
        {
          id: permissionDraft.id,
          periodId,
          typeId,
          documentDate: '2026-05-07',
          description: permissionDraft.description,
          lines: permissionDraft.lines,
        },
        permissionDraft.version,
      ),
    ).rejects.toThrow();
    await db.accountingJournal.update({
      where: { id: permissionDraft.id },
      data: { sourceKey: null },
    });

    const ownApproval = await command<AccountingJournalV1>(
      'submit',
      { id: permissionDraft.id },
      permissionDraft.version,
    );
    await expect(
      command('approve', { id: ownApproval.id }, ownApproval.version),
    ).rejects.toThrow();
    expect(
      await db.accountingJournal.findUniqueOrThrow({
        where: { id: ownApproval.id },
      }),
    ).toMatchObject({
      status: 'PENDING_APPROVAL',
      version: ownApproval.version,
    });
    const returned = await command<AccountingJournalV1>(
      'return',
      { id: ownApproval.id, reason: 'Cleanup' },
      ownApproval.version,
      checker,
    );
    await command('cancel', { id: returned.id }, returned.version);

    const saveRaceDraft = await draft();
    const saveMoveKey = randomUUID(),
      submitKey = randomUUID();
    const saveMoveRace = await Promise.allSettled([
      command<AccountingJournalV1>(
        'journal-save',
        {
          id: saveRaceDraft.id,
          periodId,
          typeId,
          documentDate: '2026-05-08',
          description: saveRaceDraft.description,
          lines: saveRaceDraft.lines,
          moveReason: 'Concurrent save move',
        },
        saveRaceDraft.version,
        maker,
        saveMoveKey,
      ),
      command<AccountingJournalV1>(
        'submit',
        { id: saveRaceDraft.id },
        saveRaceDraft.version,
        maker,
        submitKey,
      ),
    ]);
    expect(
      saveMoveRace.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      saveMoveRace.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      await db.accountingCommand.count({
        where: { bookId, key: { in: [saveMoveKey, submitKey] } },
      }),
    ).toBe(1);
    const saveRaceState = await command<AccountingJournalV1>(
      'cancel',
      { id: saveRaceDraft.id, reason: 'Race cleanup' },
      (
        await db.accountingJournal.findUniqueOrThrow({
          where: { id: saveRaceDraft.id },
        })
      ).version,
      checker,
    );
    expect(saveRaceState.status).toBe('CANCELLED');

    const batchRaceDraft = await draft();
    const batchMoveKey = randomUUID(),
      closeKey = randomUUID();
    const batchCloseRace = await Promise.allSettled([
      command(
        'move-drafts',
        {
          items: [
            { id: batchRaceDraft.id, expectedVersion: batchRaceDraft.version },
          ],
          periodId,
          documentDate: '2026-05-09',
          reason: 'Concurrent batch move',
        },
        undefined,
        maker,
        batchMoveKey,
      ),
      command('close-period', { id: periodId }, 1, maker, closeKey),
    ]);
    expect(batchCloseRace[0]!.status).toBe('fulfilled');
    expect(batchCloseRace[1]!.status).toBe('rejected');
    expect(
      await db.accountingCommand.count({
        where: { bookId, key: { in: [batchMoveKey, closeKey] } },
      }),
    ).toBe(1);
    expect(
      await db.accountingPeriod.findUniqueOrThrow({ where: { id: periodId } }),
    ).toMatchObject({ status: 'OPEN', version: 1 });
    const batchRaceState = await db.accountingJournal.findUniqueOrThrow({
      where: { id: batchRaceDraft.id },
    });
    expect(batchRaceState.documentDate).toBe('2026-05-09');
    await command('cancel', { id: batchRaceState.id }, batchRaceState.version);
  }, 30000);

  it.each([
    {
      entrypoint: 'move-drafts' as const,
      winner: 'close' as const,
      year: 2015,
    },
    { entrypoint: 'move-drafts' as const, winner: 'move' as const, year: 2016 },
    {
      entrypoint: 'journal-save' as const,
      winner: 'close' as const,
      year: 2017,
    },
    {
      entrypoint: 'journal-save' as const,
      winner: 'move' as const,
      year: 2018,
    },
  ])(
    'orders $winner before the competing $entrypoint command on a distinct empty target',
    async ({ entrypoint, winner, year }) => {
      const target = await emptyPeriod(`ORDERED-${entrypoint}-${winner}`, year),
        source = await draft(),
        before = await mutationState(source.id),
        moveKey = randomUUID(),
        closeKey = randomUUID(),
        move = () =>
          entrypoint === 'move-drafts'
            ? command(
                'move-drafts',
                {
                  items: [{ id: source.id, expectedVersion: source.version }],
                  periodId: target.id,
                  documentDate: `${year}-06-15`,
                  reason: `Ordered ${winner} race`,
                },
                undefined,
                maker,
                moveKey,
              )
            : command(
                'journal-save',
                {
                  id: source.id,
                  periodId: target.id,
                  typeId,
                  documentDate: `${year}-06-15`,
                  description: source.description,
                  lines: source.lines,
                  moveReason: `Ordered ${winner} race`,
                },
                source.version,
                maker,
                moveKey,
              ),
        close = () =>
          command(
            'close-period',
            { id: target.id },
            target.version,
            maker,
            closeKey,
          );
      expect(
        await db.accountingJournal.count({ where: { periodId: target.id } }),
      ).toBe(0);
      expect(target).toMatchObject({ status: 'OPEN', version: 1 });
      const results =
        winner === 'close'
          ? await orderedBookRace(close, move)
          : await orderedBookRace(move, close);
      expect(results[0]!.status).toBe('fulfilled');
      expect(results[1]!.status).toBe('rejected');

      const storedPeriod = await db.accountingPeriod.findUniqueOrThrow({
          where: { id: target.id },
        }),
        storedJournal = await db.accountingJournal.findUniqueOrThrow({
          where: { id: source.id },
        });
      if (winner === 'close') {
        expect(storedPeriod.status).toBe('CLOSED');
        expect(storedJournal).toMatchObject({
          periodId,
          documentDate: '2026-05-01',
          version: source.version,
        });
        expect(await mutationState(source.id)).toEqual(before);
      } else {
        expect(storedPeriod.status).toBe('OPEN');
        expect(storedJournal).toMatchObject({
          periodId: target.id,
          documentDate: `${year}-06-15`,
          version: source.version + 1,
        });
      }
      expect(
        await db.accountingJournal.count({
          where: {
            periodId: target.id,
            status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] },
            period: { status: 'CLOSED' },
          },
        }),
      ).toBe(0);
      expect(
        await db.accountingCommand.count({
          where: { bookId, key: { in: [moveKey, closeKey] } },
        }),
      ).toBe(1);
      await command(
        'cancel',
        { id: source.id, reason: 'Ordered race cleanup' },
        storedJournal.version,
      );
    },
    30000,
  );

  it.each(['move-drafts', 'journal-save'] as const)(
    'serializes %s into a distinct otherwise-closable target period',
    async (entrypoint) => {
      const targetYear = entrypoint === 'move-drafts' ? 2023 : 2024,
        target = await emptyPeriod(`RACE-${entrypoint}`, targetYear),
        source = await draft(),
        before = await mutationState(source.id),
        moveKey = randomUUID(),
        closeKey = randomUUID();
      expect(
        await db.accountingJournal.count({ where: { periodId: target.id } }),
      ).toBe(0);
      expect(target).toMatchObject({ status: 'OPEN', version: 1 });

      const move =
        entrypoint === 'move-drafts'
          ? command(
              'move-drafts',
              {
                items: [{ id: source.id, expectedVersion: source.version }],
                periodId: target.id,
                documentDate: `${targetYear}-06-15`,
                reason: 'Distinct target close race',
              },
              undefined,
              maker,
              moveKey,
            )
          : command(
              'journal-save',
              {
                id: source.id,
                periodId: target.id,
                typeId,
                documentDate: `${targetYear}-06-15`,
                description: source.description,
                lines: source.lines,
                moveReason: 'Distinct target close race',
              },
              source.version,
              maker,
              moveKey,
            );
      const [moveResult, closeResult] = await Promise.allSettled([
        move,
        command(
          'close-period',
          { id: target.id },
          target.version,
          maker,
          closeKey,
        ),
      ]);
      expect(
        [moveResult, closeResult].filter(
          (result) => result.status === 'fulfilled',
        ),
      ).toHaveLength(1);
      expect(
        [moveResult, closeResult].filter(
          (result) => result.status === 'rejected',
        ),
      ).toHaveLength(1);

      const storedPeriod = await db.accountingPeriod.findUniqueOrThrow({
          where: { id: target.id },
        }),
        storedJournal = await db.accountingJournal.findUniqueOrThrow({
          where: { id: source.id },
        });
      if (closeResult.status === 'fulfilled') {
        expect(moveResult.status).toBe('rejected');
        expect(storedPeriod.status).toBe('CLOSED');
        expect(storedJournal).toMatchObject({
          periodId,
          documentDate: '2026-05-01',
          version: source.version,
        });
        expect(await mutationState(source.id)).toEqual(before);
      } else {
        expect(moveResult.status).toBe('fulfilled');
        expect(storedPeriod.status).toBe('OPEN');
        expect(storedJournal).toMatchObject({
          periodId: target.id,
          documentDate: `${targetYear}-06-15`,
          version: source.version + 1,
        });
      }
      expect(
        await db.accountingJournal.count({
          where: {
            periodId: target.id,
            status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] },
            period: { status: 'CLOSED' },
          },
        }),
      ).toBe(0);
      expect(
        await db.accountingCommand.count({
          where: { bookId, key: { in: [moveKey, closeKey] } },
        }),
      ).toBe(1);
      await command(
        'cancel',
        { id: source.id, reason: 'Distinct race cleanup' },
        storedJournal.version,
      );
    },
    30000,
  );

  it.each(['move-drafts', 'journal-save'] as const)(
    'reassigns maker after a successful other-actor %s and enforces independent approval',
    async (entrypoint) => {
      const source = await draft(),
        moved =
          entrypoint === 'move-drafts'
            ? (
                await command<{ items: AccountingJournalV1[] }>(
                  'move-drafts',
                  {
                    items: [{ id: source.id, expectedVersion: source.version }],
                    periodId,
                    documentDate: '2026-05-12',
                    reason: 'Authorized maker reassignment',
                  },
                  undefined,
                  checker,
                )
              ).items[0]!
            : await command<AccountingJournalV1>(
                'journal-save',
                {
                  id: source.id,
                  periodId,
                  typeId,
                  documentDate: '2026-05-12',
                  description: source.description,
                  lines: source.lines,
                  moveReason: 'Authorized maker reassignment',
                },
                source.version,
                checker,
              );
      expect(moved).toMatchObject({
        makerId: checkerId,
        documentDate: '2026-05-12',
        version: source.version + 1,
      });
      const submitted = await command<AccountingJournalV1>(
          'submit',
          { id: moved.id },
          moved.version,
          checker,
        ),
        selfApprovalKey = randomUUID();
      await expect(
        command(
          'approve',
          { id: submitted.id },
          submitted.version,
          checker,
          selfApprovalKey,
        ),
      ).rejects.toThrow('ایجادکننده نمی‌تواند سند خودش را تأیید کند');
      expect(
        await db.accountingCommand.count({
          where: { bookId, key: selfApprovalKey },
        }),
      ).toBe(0);
      expect(
        await db.accountingJournal.findUniqueOrThrow({
          where: { id: submitted.id },
        }),
      ).toMatchObject({
        makerId: checkerId,
        approverId: null,
        status: 'PENDING_APPROVAL',
        version: submitted.version,
      });
      const approved = await command<AccountingJournalV1>(
        'approve',
        { id: submitted.id },
        submitted.version,
        maker,
      );
      expect(approved).toMatchObject({
        makerId: checkerId,
        approverId: makerId,
        status: 'APPROVED',
      });
      await command(
        'cancel',
        { id: approved.id, reason: 'Approval cleanup' },
        approved.version,
        checker,
      );
    },
  );

  it.each(['move-drafts', 'journal-save'] as const)(
    'rejects missing permission and foreign maker through %s without effects',
    async (entrypoint) => {
      const source = await draft(),
        before = await mutationState(source.id),
        noPermission: AuthenticatedActor = {
          userId: makerId,
          sessionId: randomUUID(),
          branchIds: [branchId],
          permissions: ['finance.read'],
        },
        foreignActorId = randomUUID();
      await db.user.create({
        data: {
          id: foreignActorId,
          username: foreignActorId,
          displayName: 'Synthetic foreign maker',
          passwordHash: 'not-a-login-credential',
        },
      });
      const foreignMaker: AuthenticatedActor = {
          userId: foreignActorId,
          sessionId: randomUUID(),
          branchIds: [branchId],
          permissions: ['finance.read', 'finance.journal.create'],
        },
        keys = [randomUUID(), randomUUID()];
      const attempt = (actor: AuthenticatedActor, key: string) =>
        entrypoint === 'move-drafts'
          ? command(
              'move-drafts',
              {
                items: [{ id: source.id, expectedVersion: source.version }],
                periodId,
                documentDate: '2026-05-13',
                reason: 'Denied actor',
              },
              undefined,
              actor,
              key,
            )
          : command(
              'journal-save',
              {
                id: source.id,
                periodId,
                typeId,
                documentDate: '2026-05-13',
                description: source.description,
                lines: source.lines,
                moveReason: 'Denied actor',
              },
              source.version,
              actor,
              key,
            );
      await expect(attempt(noPermission, keys[0]!)).rejects.toThrow();
      expect(await mutationState(source.id)).toEqual(before);
      await expect(attempt(foreignMaker, keys[1]!)).rejects.toThrow();
      expect(await mutationState(source.id)).toEqual(before);
      expect(
        await db.accountingCommand.count({
          where: { bookId, key: { in: keys } },
        }),
      ).toBe(0);
      await command('cancel', { id: source.id }, source.version);
    },
  );

  it('rejects every numbered/source/generated provenance shape through both move paths without effects', async () => {
    const cases = [
      { name: 'numbered', data: { number: 880000001 } },
      {
        name: 'revaluation source',
        data: { sourceKey: `REVALUE:${randomUUID()}` },
      },
      { name: 'opening source', data: { sourceKey: `OPEN:${randomUUID()}` } },
      { name: 'closing source', data: { sourceKey: `CLOSE:${randomUUID()}` } },
      {
        name: 'reversal source',
        data: { sourceKey: `REVERSE:${randomUUID()}` },
      },
      {
        name: 'allocation source',
        data: { sourceKey: `ALLOC:${randomUUID()}` },
      },
      {
        name: 'operational source',
        data: { sourceKey: `OPERATIONAL:${randomUUID()}` },
      },
      {
        name: 'operation attribute',
        data: { attributes: { operation: 'generated' } },
      },
      {
        name: 'template attribute',
        data: { attributes: { templateId: randomUUID() } },
      },
      {
        name: 'request attribute',
        data: { attributes: { sourceRequestId: randomUUID() } },
      },
    ] as const;
    for (const [index, provenance] of cases.entries()) {
      const source = await draft();
      await db.accountingJournal.update({
        where: { id: source.id },
        data: provenance.data,
      });
      const before = await mutationState(source.id),
        keys = [randomUUID(), randomUUID()];
      await expect(
        command(
          'move-drafts',
          {
            items: [{ id: source.id, expectedVersion: source.version }],
            periodId,
            documentDate: '2026-05-14',
            reason: provenance.name,
          },
          undefined,
          maker,
          keys[0],
        ),
      ).rejects.toThrow();
      expect(await mutationState(source.id)).toEqual(before);
      await expect(
        command(
          'journal-save',
          {
            id: source.id,
            periodId,
            typeId,
            documentDate: '2026-05-14',
            description: source.description,
            lines: source.lines,
            moveReason: provenance.name,
          },
          source.version,
          maker,
          keys[1],
        ),
      ).rejects.toThrow();
      expect(await mutationState(source.id)).toEqual(before);
      expect(
        await db.accountingCommand.count({
          where: { bookId, key: { in: keys } },
        }),
      ).toBe(0);
      await db.accountingJournal.update({
        where: { id: source.id },
        data: { number: null, sourceKey: null, attributes: {} },
      });
      await command(
        'cancel',
        { id: source.id, reason: `Provenance cleanup ${index}` },
        source.version,
      );
    }

    const reversalBasis = await draft(),
      reversal = await draft();
    await db.accountingJournal.update({
      where: { id: reversal.id },
      data: { reversalOfId: reversalBasis.id },
    });
    const before = await mutationState(reversal.id),
      keys = [randomUUID(), randomUUID()];
    await expect(
      command(
        'move-drafts',
        {
          items: [{ id: reversal.id, expectedVersion: reversal.version }],
          periodId,
          documentDate: '2026-05-14',
          reason: 'Reversal provenance',
        },
        undefined,
        maker,
        keys[0],
      ),
    ).rejects.toThrow();
    expect(await mutationState(reversal.id)).toEqual(before);
    await expect(
      command(
        'journal-save',
        {
          id: reversal.id,
          periodId,
          typeId,
          documentDate: '2026-05-14',
          description: reversal.description,
          lines: reversal.lines,
          moveReason: 'Reversal provenance',
        },
        reversal.version,
        maker,
        keys[1],
      ),
    ).rejects.toThrow();
    expect(await mutationState(reversal.id)).toEqual(before);
    expect(
      await db.accountingCommand.count({
        where: { bookId, key: { in: keys } },
      }),
    ).toBe(0);
    await db.accountingJournal.update({
      where: { id: reversal.id },
      data: { reversalOfId: null },
    });
    await command('cancel', { id: reversal.id }, reversal.version);
    await command('cancel', { id: reversalBasis.id }, reversalBasis.version);
  }, 30000);

  it('rolls duplicate and mixed eligible/forbidden batch moves back completely', async () => {
    const duplicate = await draft(),
      duplicateBefore = await mutationState(duplicate.id),
      duplicateKey = randomUUID();
    await expect(
      command(
        'move-drafts',
        {
          items: [
            { id: duplicate.id, expectedVersion: duplicate.version },
            { id: duplicate.id, expectedVersion: duplicate.version },
          ],
          periodId,
          documentDate: '2026-05-15',
          reason: 'Duplicate rollback',
        },
        undefined,
        maker,
        duplicateKey,
      ),
    ).rejects.toThrow();
    expect(await mutationState(duplicate.id)).toEqual(duplicateBefore);
    expect(
      await db.accountingCommand.count({
        where: { bookId, key: duplicateKey },
      }),
    ).toBe(0);

    const eligible = await draft();
    let forbidden = await draft();
    forbidden = await command<AccountingJournalV1>(
      'submit',
      { id: forbidden.id },
      forbidden.version,
    );
    const eligibleBefore = await mutationState(eligible.id),
      forbiddenBefore = await mutationState(forbidden.id),
      mixedKey = randomUUID();
    await expect(
      command(
        'move-drafts',
        {
          items: [
            { id: eligible.id, expectedVersion: eligible.version },
            { id: forbidden.id, expectedVersion: forbidden.version },
          ],
          periodId,
          documentDate: '2026-05-15',
          reason: 'Mixed status rollback',
        },
        undefined,
        maker,
        mixedKey,
      ),
    ).rejects.toThrow();
    expect(await mutationState(eligible.id)).toEqual(eligibleBefore);
    expect(await mutationState(forbidden.id)).toEqual(forbiddenBefore);
    expect(
      await db.accountingCommand.count({
        where: { bookId, key: mixedKey },
      }),
    ).toBe(0);
    await command('cancel', { id: duplicate.id }, duplicate.version);
    await command('cancel', { id: eligible.id }, eligible.version);
    await command(
      'cancel',
      { id: forbidden.id, reason: 'Mixed cleanup' },
      forbidden.version,
    );
  });

  it('rolls journal, command and events back when prospective event insertion fails', async () => {
    const journal = await draft(),
      key = randomUUID(),
      beforeEventCount = await db.accountingJournalStateEvent.count({
        where: { journalId: journal.id },
      });
    await db.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION accounting_test_reject_event() RETURNS trigger AS $$
      BEGIN
        IF NEW.reason = 'FORCE_EVENT_FAILURE' THEN
          RAISE EXCEPTION 'forced accounting event failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS accounting_test_reject_event_trigger ON accounting_journal_state_events;
      CREATE TRIGGER accounting_test_reject_event_trigger
      BEFORE INSERT ON accounting_journal_state_events
      FOR EACH ROW EXECUTE FUNCTION accounting_test_reject_event();
    `);
    try {
      await expect(
        command(
          'journal-save',
          {
            id: journal.id,
            periodId,
            typeId,
            documentDate: '2026-05-10',
            description: journal.description,
            lines: journal.lines,
            moveReason: 'FORCE_EVENT_FAILURE',
          },
          journal.version,
          maker,
          key,
        ),
      ).rejects.toThrow('forced accounting event failure');
    } finally {
      await db.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS accounting_test_reject_event_trigger ON accounting_journal_state_events;
        DROP FUNCTION IF EXISTS accounting_test_reject_event();
      `);
    }
    expect(
      await db.accountingJournal.findUniqueOrThrow({
        where: { id: journal.id },
      }),
    ).toMatchObject({ version: journal.version, documentDate: '2026-05-01' });
    expect(await db.accountingCommand.count({ where: { bookId, key } })).toBe(
      0,
    );
    expect(
      await db.accountingJournalStateEvent.count({
        where: { journalId: journal.id },
      }),
    ).toBe(beforeEventCount);
    await command('cancel', { id: journal.id }, journal.version);
  }, 30000);
  it('marks a pre-event cancelled journal as historical and records only prospective restore evidence', async () => {
    const journal = await db.accountingJournal.create({
      data: {
        bookId,
        periodId,
        typeId,
        documentDate: '2026-05-06',
        description: 'Historical cancelled journal',
        status: 'CANCELLED',
        makerId,
        attributes: {
          approvalPolicyId: randomUUID(),
          approvalPolicyVersion: '9',
          warnings: ['historical'],
        },
      },
    });
    const before = await service.journalEvents(bookId, journal.id, maker);
    expect(before).toMatchObject({ events: [], historicalGap: true });
    const restoredAt = new Date();
    const restored = await command<AccountingJournalV1>(
      'restore',
      { id: journal.id, reason: 'Prospective recovery' },
      journal.version,
    );
    expect(restored.status).toBe('DRAFT');
    expect(restored.attributes).not.toHaveProperty('approvalPolicyId');
    expect(restored.attributes).not.toHaveProperty('approvalPolicyVersion');
    expect(restored.attributes).not.toHaveProperty('warnings');
    const after = await service.journalEvents(bookId, journal.id, maker);
    expect(after.historicalGap).toBe(false);
    expect(after.events).toHaveLength(1);
    expect(after.events[0]).toMatchObject({
      actorId: makerId,
      actorName: 'Synthetic accountant',
      eventType: 'STATUS',
      fromStatus: 'CANCELLED',
      toStatus: 'DRAFT',
      reason: 'Prospective recovery',
    });
    expect(
      new Date(after.events[0]!.occurredAt).getTime(),
    ).toBeGreaterThanOrEqual(restoredAt.getTime());
    await command('cancel', { id: journal.id }, restored.version);
  });
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
    let j = await call();
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
    j = await command<AccountingJournalV1>(
      'journal-save',
      {
        ...j,
        attributes: { descriptionEn: 'Confirmed source journal' },
        lines: j.lines.map((line) => ({
          accountId: line.accountId,
          detail4Id: line.detail4Id,
          detail5Id: line.detail5Id,
          detail6Id: line.detail6Id,
          description: line.description,
          debit: String(line.debit),
          credit: String(line.credit),
          currency: line.currency,
          foreignAmount:
            line.foreignAmount === null ? null : String(line.foreignAmount),
          rate: line.rate === null ? null : String(line.rate),
          fxSnapshotId: line.fxSnapshotId ?? null,
          attributes: {},
        })),
      },
      j.version,
    );
    expect(j.attributes.sourceRequestId).toBeTruthy();
    expect(j.attributes.descriptionEn).toBe('Confirmed source journal');
    j = await command<AccountingJournalV1>('submit', { id: j.id }, j.version);
    j = await command<AccountingJournalV1>(
      'approve',
      { id: j.id },
      j.version,
      checker,
    );
    await command('post', { id: j.id }, j.version);
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
    const revaluationTemplate = await command<{
      id: string;
      version: number;
    }>('save-template', {
      kind: 'REVALUATION',
      code: 'REVALUE-1',
      title: 'Synthetic revaluation template',
      voucherTypeId: typeId,
      gainAccountId: creditId,
      lossAccountId: debitId,
      lines: [],
    });
    const payload = {
      periodId,
      asOfDate: '2026-05-11',
      templateId: revaluationTemplate.id,
      templateVersion: revaluationTemplate.version,
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
  it('computes dormant, nature-conflict and comparative reports in one scoped snapshot', async () => {
    const base = await db.accountingAccount.findUniqueOrThrow({
      where: { id: debitId },
    });
    const saveLeaf = (code: string, title: string, nature = 'DEBIT') =>
      command<{
        id: string;
        code: string;
        title: string;
        level: string;
        nature: string;
        parentId: string;
        version: number;
      }>('save-account', {
        code,
        title,
        parentId: base.parentId,
        level: 'SUBSIDIARY',
        nature,
      });
    const postJournal = async (
      documentDate: string,
      lines: { accountId: string; debit: string; credit: string }[],
    ) => {
      let journal = await command<AccountingJournalV1>('journal-save', {
        periodId,
        typeId,
        documentDate,
        description: 'Synthetic analytical evidence',
        lines,
      });
      journal = await command<AccountingJournalV1>(
        'submit',
        { id: journal.id },
        journal.version,
      );
      journal = await command<AccountingJournalV1>(
        'approve',
        { id: journal.id },
        journal.version,
        checker,
      );
      return command<AccountingJournalV1>(
        'post',
        { id: journal.id },
        journal.version,
      );
    };
    const dormant = await saveLeaf('1180', 'Dormant synthetic account');
    const zeroEnding = await saveLeaf('1181', 'Active with zero ending');
    const temporaryConflict = await saveLeaf(
      '1182',
      'Temporary credit-nature conflict',
      'CREDIT',
    );
    const nettedInOneJournal = await saveLeaf(
      '1183',
      'Same-journal net zero',
      'CREDIT',
    );
    const carriedConflict = await saveLeaf(
      '1184',
      'Conflict carried into range',
      'CREDIT',
    );
    const inactiveConflict = await saveLeaf(
      '1185',
      'Inactive historical conflict',
      'CREDIT',
    );
    await postJournal('2026-06-02', [
      { accountId: zeroEnding.id, debit: '5', credit: '0' },
      { accountId: zeroEnding.id, debit: '0', credit: '5' },
    ]);
    await postJournal('2026-06-03', [
      { accountId: nettedInOneJournal.id, debit: '8', credit: '0' },
      { accountId: nettedInOneJournal.id, debit: '0', credit: '8' },
    ]);
    await postJournal('2026-06-04', [
      { accountId: temporaryConflict.id, debit: '10', credit: '0' },
      { accountId: creditId, debit: '0', credit: '10' },
    ]);
    await postJournal('2026-06-05', [
      { accountId: creditId, debit: '10', credit: '0' },
      { accountId: temporaryConflict.id, debit: '0', credit: '10' },
    ]);
    await postJournal('2026-05-20', [
      { accountId: carriedConflict.id, debit: '10', credit: '0' },
      { accountId: creditId, debit: '0', credit: '10' },
    ]);
    await postJournal('2026-06-10', [
      { accountId: creditId, debit: '4', credit: '0' },
      { accountId: carriedConflict.id, debit: '0', credit: '4' },
    ]);
    await postJournal('2026-06-15', [
      { accountId: inactiveConflict.id, debit: '3', credit: '0' },
      { accountId: creditId, debit: '0', credit: '3' },
    ]);
    const inactiveState = await command<{ version: number }>(
      'save-account',
      {
        ...inactiveConflict,
        active: false,
        attributes: {},
      },
      inactiveConflict.version,
    );
    const primaryGroup = await command<{ id: string }>('save-account-group', {
      code: 'AN-1',
      title: 'Primary analytical group',
      memberIds: [carriedConflict.id],
    });
    await command('save-account-group', {
      code: 'AN-2',
      title: 'Second analytical group',
      memberIds: [carriedConflict.id],
    });
    const bulkDormantIds = Array.from({ length: 52 }, () => randomUUID()),
      bulkConflictIds = Array.from({ length: 52 }, () => randomUUID());
    await db.accountingAccount.createMany({
      data: [
        ...bulkDormantIds.map((id, index) => ({
          id,
          bookId,
          parentId: base.parentId,
          code: `11D${String(index).padStart(3, '0')}`,
          title: `Dormant page evidence ${index}`,
          level: 'SUBSIDIARY',
          nature: 'DEBIT',
          attributes: {},
        })),
        ...bulkConflictIds.map((id, index) => ({
          id,
          bookId,
          parentId: base.parentId,
          code: `11C${String(index).padStart(3, '0')}`,
          title: `Conflict page evidence ${index}`,
          level: 'SUBSIDIARY',
          nature: 'CREDIT',
          attributes: {},
        })),
      ],
    });
    await postJournal('2026-06-18', [
      ...bulkConflictIds.map((accountId) => ({
        accountId,
        debit: '1',
        credit: '0',
      })),
      {
        accountId: creditId,
        debit: '0',
        credit: String(bulkConflictIds.length),
      },
    ]);
    const dormantReport = (await service.analyticalReport(
      bookId,
      'dormant',
      { periodId, from: '2026-06-01', to: '2026-06-30' },
      maker,
    )) as unknown as {
      page: number;
      pageSize: number;
      total: number;
      rows: { id: string }[];
    };
    const dormantPage2 = (await service.analyticalReport(
      bookId,
      'dormant',
      { periodId, from: '2026-06-01', to: '2026-06-30', page: '2' },
      maker,
    )) as {
      page: number;
      pageSize: number;
      total: number;
      rows: { id: string }[];
    };
    expect(dormantReport).toMatchObject({ page: 1, pageSize: 50 });
    expect(dormantReport.total).toBe(dormantPage2.total);
    expect(dormantReport.rows).toHaveLength(50);
    expect(
      dormantPage2.rows.some((row) =>
        dormantReport.rows.some((first) => first.id === row.id),
      ),
    ).toBe(false);
    expect(dormantReport.rows.map((row) => row.id)).toContain(dormant.id);
    expect(dormantReport.rows.map((row) => row.id)).not.toContain(
      zeroEnding.id,
    );
    const periodConflict = (await service.analyticalReport(
      bookId,
      'nature-conflict-period',
      { periodId, to: '2026-06-30' },
      maker,
    )) as unknown as {
      page: number;
      pageSize: number;
      total: number;
      rows: { id: string; balance: string }[];
    };
    const periodConflictPage2 = (await service.analyticalReport(
      bookId,
      'nature-conflict-period',
      { periodId, to: '2026-06-30', page: '2' },
      maker,
    )) as { total: number; rows: { id: string }[] };
    expect(periodConflict).toMatchObject({ page: 1, pageSize: 50 });
    expect(periodConflict.total).toBe(periodConflictPage2.total);
    expect(periodConflict.rows).toHaveLength(50);
    expect(
      periodConflictPage2.rows.some((row) =>
        periodConflict.rows.some((first) => first.id === row.id),
      ),
    ).toBe(false);
    expect(periodConflict.rows.map((row) => row.id)).not.toContain(
      temporaryConflict.id,
    );
    expect(periodConflict.rows.map((row) => row.id)).not.toContain(
      nettedInOneJournal.id,
    );
    expect(periodConflict.rows.map((row) => row.id)).toContain(
      inactiveConflict.id,
    );
    const activeOnly = (await service.analyticalReport(
      bookId,
      'nature-conflict-period',
      { periodId, to: '2026-06-30', activeOnly: 'true' },
      maker,
    )) as { rows: { id: string }[] };
    expect(activeOnly.rows.map((row) => row.id)).not.toContain(
      inactiveConflict.id,
    );
    const grouped = (await service.analyticalReport(
      bookId,
      'nature-conflict-period',
      { periodId, to: '2026-06-30', groupId: primaryGroup.id },
      maker,
    )) as unknown as { rows: { id: string; balance: string }[] };
    expect(grouped.rows).toEqual([
      expect.objectContaining({ id: carriedConflict.id, balance: '6' }),
    ]);
    const runningConflict = (await service.analyticalReport(
      bookId,
      'nature-conflict-running',
      { periodId, from: '2026-06-01', to: '2026-06-30' },
      maker,
    )) as unknown as {
      page: number;
      pageSize: number;
      total: number;
      rows: { id: string; firstConflictDate: string; balance: string }[];
    };
    const runningPage2 = (await service.analyticalReport(
      bookId,
      'nature-conflict-running',
      { periodId, from: '2026-06-01', to: '2026-06-30', page: '2' },
      maker,
    )) as unknown as { total: number; rows: { id: string }[] };
    expect(runningConflict).toMatchObject({ page: 1, pageSize: 50 });
    expect(runningConflict.total).toBe(runningPage2.total);
    expect(runningConflict.rows).toHaveLength(50);
    expect(
      runningPage2.rows.some((row) =>
        runningConflict.rows.some((first) => first.id === row.id),
      ),
    ).toBe(false);
    expect(runningConflict.rows.map((row) => row.id)).toContain(
      temporaryConflict.id,
    );
    expect(runningConflict.rows.map((row) => row.id)).not.toContain(
      nettedInOneJournal.id,
    );
    expect(runningConflict.rows).toContainEqual(
      expect.objectContaining({
        id: carriedConflict.id,
        firstConflictDate: '2026-06-10',
        balance: '6',
      }),
    );
    let pending = await command<AccountingJournalV1>('journal-save', {
      periodId,
      typeId,
      documentDate: '2026-06-25',
      description: 'Concurrent comparative post',
      lines: [
        { accountId: dormant.id, debit: '2', credit: '0' },
        { accountId: creditId, debit: '0', credit: '2' },
      ],
    });
    pending = await command<AccountingJournalV1>(
      'submit',
      { id: pending.id },
      pending.version,
    );
    pending = await command<AccountingJournalV1>(
      'approve',
      { id: pending.id },
      pending.version,
      checker,
    );
    type ReportRow = {
      accountId: string;
      code: string;
      title: string;
      opening: string;
      debit: string;
      credit: string;
      balance: string;
    };
    type HiddenReportData = (...args: never[]) => Promise<{
      generatedAt: string;
      rows: ReportRow[];
      debit: string;
      credit: string;
    }>;
    const hidden = service as unknown as { reportData: HiddenReportData },
      originalReportData = hidden.reportData.bind(service);
    let reportCalls = 0;
    hidden.reportData = async (...args) => {
      const result = await originalReportData(...args);
      reportCalls += 1;
      if (reportCalls === 1)
        await command('post', { id: pending.id }, pending.version);
      return result;
    };
    let comparative: {
      page: number;
      pageSize: number;
      total: number;
      rows: { accountId: string; difference: { balance: string } }[];
    };
    try {
      comparative = (await service.analyticalReport(
        bookId,
        'comparative',
        {
          leftPeriodId: periodId,
          leftFrom: '2026-06-01',
          leftTo: '2026-06-30',
          rightPeriodId: periodId,
          rightFrom: '2026-06-01',
          rightTo: '2026-06-30',
        },
        maker,
      )) as {
        page: number;
        pageSize: number;
        total: number;
        rows: { accountId: string; difference: { balance: string } }[];
      };
    } finally {
      hidden.reportData = originalReportData;
    }
    expect(reportCalls).toBe(2);
    expect(comparative).toMatchObject({ page: 1, pageSize: 50 });
    expect(
      comparative.rows.every((row) => row.difference.balance === '0'),
    ).toBe(true);
    const comparativePage2 = (await service.analyticalReport(
      bookId,
      'comparative',
      {
        leftPeriodId: periodId,
        leftFrom: '2026-06-01',
        leftTo: '2026-06-30',
        rightPeriodId: periodId,
        rightFrom: '2026-06-01',
        rightTo: '2026-06-30',
        page: '2',
      },
      maker,
    )) as {
      total: number;
      rows: { accountId: string; difference: { balance: string } }[];
    };
    expect(comparativePage2.total).toBe(comparative.total);
    expect(
      comparativePage2.rows.some((row) =>
        comparative.rows.some((first) => first.accountId === row.accountId),
      ),
    ).toBe(false);
    expect(
      comparativePage2.rows.every((row) => row.difference.balance === '0'),
    ).toBe(true);
    await command(
      'save-account',
      { ...inactiveConflict, active: true, attributes: {} },
      inactiveState.version,
    );
  });
  it('records direct reversal and nested generated journal creation prospectively', async () => {
    const generated = await db.accountingJournal.findMany({
      where: {
        bookId,
        OR: [
          { sourceKey: { startsWith: 'REVALUE:' } },
          { sourceKey: { startsWith: 'REVERSE:' } },
          { sourceKey: { startsWith: 'OPERATIONAL:' } },
        ],
      },
      select: { id: true },
    });
    expect(generated.length).toBeGreaterThan(0);
    for (const journal of generated)
      expect(
        await db.accountingJournalStateEvent.count({
          where: { journalId: journal.id, eventType: 'CREATE' },
        }),
      ).toBe(1);
  });
  it('rejects selected or percentage closing and revaluation template execution without effects', async () => {
    const closing = await command<{ id: string; version: number }>(
      'save-template',
      {
        kind: 'CLOSING',
        code: `CLOSE-SELECTED-${randomUUID().slice(0, 6)}`,
        title: 'Unsupported selected closing',
        voucherTypeId: typeId,
        retainedAccountId: debitId,
        lines: [
          { accountId: creditId, side: 'CREDIT', percentage: '50.00000000' },
        ],
      },
    );
    const revaluation = await command<{ id: string; version: number }>(
      'save-template',
      {
        kind: 'REVALUATION',
        code: `REVALUE-SELECTED-${randomUUID().slice(0, 6)}`,
        title: 'Unsupported selected revaluation',
        voucherTypeId: typeId,
        gainAccountId: debitId,
        lossAccountId: creditId,
        lines: [
          { accountId: debitId, side: 'DEBIT', percentage: '100.00000000' },
        ],
      },
    );
    const before = await db.accountingJournal.count({ where: { bookId } }),
      closingKey = randomUUID(),
      revaluationKey = randomUUID();
    await expect(
      command(
        'year-end-closing',
        {
          periodId,
          templateId: closing.id,
          templateVersion: closing.version,
          documentDate: '2026-12-31',
          fxCarryPolicy: 'HISTORICAL_LOTS',
        },
        undefined,
        maker,
        closingKey,
      ),
    ).rejects.toThrow('دارای ردیف انتخابی یا درصدی هنوز پشتیبانی نمی‌شود');
    await expect(
      command(
        'revaluation-preview',
        {
          periodId,
          asOfDate: '2026-10-07',
          templateId: revaluation.id,
          templateVersion: revaluation.version,
          rates: {},
        },
        undefined,
        maker,
        revaluationKey,
      ),
    ).rejects.toThrow('دارای ردیف انتخابی یا درصدی هنوز پشتیبانی نمی‌شود');
    expect(await db.accountingJournal.count({ where: { bookId } })).toBe(
      before,
    );
    expect(
      await db.accountingCommand.count({
        where: { bookId, key: { in: [closingKey, revaluationKey] } },
      }),
    ).toBe(0);
  });
  it('executes only the supported all-temporary closing template shape', async () => {
    const base = await db.accountingAccount.findUniqueOrThrow({
      where: { id: debitId },
    });
    const temporary = await command('save-account', {
      code: '1197',
      title: 'Temporary synthetic account',
      parentId: base.parentId,
      level: 'SUBSIDIARY',
      nature: 'CREDIT',
      permanent: false,
    });
    let source = await command<AccountingJournalV1>('journal-save', {
      periodId,
      typeId,
      documentDate: '2026-12-20',
      description: 'Temporary balance',
      lines: [
        { accountId: debitId, debit: '20', credit: '0' },
        { accountId: temporary.id, debit: '0', credit: '20' },
      ],
    });
    source = await command<AccountingJournalV1>(
      'submit',
      { id: source.id },
      source.version,
    );
    source = await command<AccountingJournalV1>(
      'approve',
      { id: source.id },
      source.version,
      checker,
    );
    await command('post', { id: source.id }, source.version);
    const template = await command<{ id: string; version: number }>(
      'save-template',
      {
        kind: 'CLOSING',
        code: 'CLOSE-ALL',
        title: 'Close all temporary accounts',
        voucherTypeId: typeId,
        retainedAccountId: creditId,
        lines: [],
      },
    );
    let closing = await command<AccountingJournalV1>('year-end-closing', {
      periodId,
      templateId: template.id,
      templateVersion: template.version,
      documentDate: '2026-12-31',
      fxCarryPolicy: 'HISTORICAL_LOTS',
    });
    expect(closing.attributes.templateId).toBe(template.id);
    closing = await command<AccountingJournalV1>(
      'submit',
      { id: closing.id },
      closing.version,
    );
    closing = await command<AccountingJournalV1>(
      'approve',
      { id: closing.id },
      closing.version,
      checker,
    );
    await command('post', { id: closing.id }, closing.version);
    expect(
      await db.accountingJournalStateEvent.count({
        where: { journalId: closing.id, eventType: 'CREATE' },
      }),
    ).toBe(1);
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
