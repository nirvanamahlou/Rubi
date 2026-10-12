import { randomUUID } from 'node:crypto';
import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import {
  ACCOUNTING_PERMISSIONS,
  type AuthenticatedActor,
  type AccountingJournalV1,
  type AccountingStatementBasisV1,
  type AccountingStatementV1,
} from '@nora/contracts';
import { AccountingService } from '../src/finance/accounting/accounting.service';
import { MasterDataService } from '../src/master-data/master-data.service';
import { MasterDataRepository } from '../src/master-data/master-data.repository';

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
  const documentFixtureTests = new Set([
    'issues statements from selected saved articles with immutable snapshots and version guards',
    'imports journal batches atomically with regular validation and command replay',
    'filters document lines before pagination and guards source numbering preview versions',
    'separates memorandum saving from complete temporary documents and audits the transition',
    'reviews a temporary document atomically while preserving independent checker and version guards',
    'reviews selected documents as one transaction and audits the supplied explanation',
    'generates automatic temporary transfers from real source balances and rejects stale bases',
    'posts the complete reviewed interval atomically and rejects stale previews',
    'calculates document turnover from complete temporary records and excludes memorandum and legacy drafts',
  ]);
  let priorDocumentIds: string[] = [];
  beforeEach(async (context) => {
    if (!documentFixtureTests.has(context.task.name)) return;
    priorDocumentIds = (
      await db.accountingJournal.findMany({
        where: { bookId },
        select: { id: true },
      })
    ).map((row) => row.id);
  });
  afterEach(async (context) => {
    if (!documentFixtureTests.has(context.task.name)) return;
    const fixtures = await db.accountingJournal.findMany({
      where: {
        bookId,
        id: { notIn: priorDocumentIds },
        status: { notIn: ['POSTED', 'CANCELLED'] },
      },
    });
    for (const row of fixtures)
      await command('cancel', { id: row.id }, row.version, checker);
  });
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
      undefined,
      new MasterDataService(new MasterDataRepository({ client: db } as never)),
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
  it('persists observed detail setup, zero classification length and server-authored notes', async () => {
    const noteId = randomUUID();
    const type = await command<{ id: string; version: number }>(
      'save-configuration',
      {
        kind: 'detail-types',
        title: 'Synthetic user type',
        attributes: {
          classificationNumberLength: '0',
          defaultFirstCode: '88000',
          notes: JSON.stringify([
            {
              id: noteId,
              title: 'Note',
              date: '2026-10-11',
              text: 'Observed note fields',
              createdBy: 'forged',
              createdAt: '1900-01-01',
            },
          ]),
        },
      },
    );
    const detail = await command<{ id: string; version: number }>(
      'save-detail',
      {
        typeId: type.id,
        title: 'Synthetic detail',
        code: '',
        currency: 'IRR',
        titleEn: 'Second language',
        description: 'Description',
        attributes: { classificationNumber: '' },
      },
    );
    const stored = await db.accountingDetail.findUniqueOrThrow({
      where: { id: detail.id },
    });
    expect(stored.code).toBe('88000');
    expect(stored.attributes).toMatchObject({
      titleEn: 'Second language',
      description: 'Description',
    });
    const config = await db.accountingConfiguration.findUniqueOrThrow({
      where: { id: type.id },
    });
    const notes = JSON.parse(
      String((config.attributes as Record<string, unknown>).notes),
    );
    expect(notes[0]).toMatchObject({
      title: 'Note',
      createdBy: 'Synthetic accountant',
    });
    expect(notes[0].createdAt).not.toBe('1900-01-01');
    await expect(
      command('save-detail', {
        typeId: type.id,
        title: 'Wrong classification',
        code: '88002',
        attributes: { classificationNumber: '1' },
      }),
    ).rejects.toMatchObject({ status: 422 });
    const group = await command<{ id: string; version: number }>(
      'save-detail-group',
      {
        code: 'NOTE-GROUP',
        title: 'Synthetic group',
        memberIds: [detail.id],
        notes: [
          { id: randomUUID(), title: 'Group note', text: 'Text', date: '' },
        ],
      },
    );
    expect(
      (
        await db.accountingDetailGroup.findUniqueOrThrow({
          where: { id: group.id },
        })
      ).notes,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Group note',
          createdBy: 'Synthetic accountant',
        }),
      ]),
    );
  });
  it('registers conversion definitions with scoped type FKs, version checks and immutable system titles', async () => {
    const user = await command<{ id: string }>('save-configuration', {
      kind: 'detail-types',
      title: 'Synthetic conversion user',
      attributes: { classificationNumberLength: '0' },
    });
    const system = await command<{ id: string; version: number }>(
      'save-configuration',
      {
        kind: 'detail-types',
        title: 'شخص',
        titleEn: 'Person',
        attributes: { classificationNumberLength: '0', isSystem: true },
      },
    );
    const conversion = await command<{
      id: string;
      version: number;
      entity: string;
      date: string;
    }>('save-detail-type-conversion', {
      userTypeId: user.id,
      systemTypeId: system.id,
      description: 'Definition only',
      date: '1900-01-01',
      state: 'CONVERTED',
    });
    expect(conversion.entity).toBe('شخص/شرکت');
    expect(conversion.date).toBe(new Date().toISOString().slice(0, 10));
    expect(
      (
        await db.accountingDetailTypeConversion.findUniqueOrThrow({
          where: { id: conversion.id },
        })
      ).state,
    ).toBe('REGISTERED');
    await expect(
      command(
        'save-detail-type-conversion',
        { id: conversion.id, userTypeId: user.id, systemTypeId: system.id },
        0,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      command('save-detail-type-conversion', {
        userTypeId: system.id,
        systemTypeId: user.id,
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      command(
        'save-configuration',
        {
          id: system.id,
          kind: 'detail-types',
          title: 'Changed',
          attributes: { classificationNumberLength: '0', isSystem: true },
        },
        system.version,
      ),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      command(
        'delete-base-record',
        { id: system.id, entity: 'configuration' },
        system.version,
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect((await service.snapshot(bookId, maker)).detailConversions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: conversion.id })]),
    );
    await command(
      'delete-detail-type-conversion',
      { id: conversion.id },
      conversion.version,
    );
  });
  it('saves FK-backed subsidiary mappings atomically and rejects stale or out-of-scope rows', async () => {
    const targetBook = await service.createBook(
      {
        id: randomUUID(),
        branchId,
        code: 'MAP-SECONDARY',
        title: 'Synthetic secondary',
        baseCurrency: 'IRR',
        approvalPolicy: 'DUAL_CONTROL',
      },
      maker,
    );
    const targetCommand = async (
      action: string,
      payload: Record<string, unknown>,
    ) =>
      (await service.command(
        targetBook.id,
        action,
        { key: randomUUID(), payload },
        maker,
      )) as { id: string };
    const group = await targetCommand('save-account', {
      code: '7',
      title: 'Target group',
      level: 'GROUP',
      nature: 'DEBIT',
    });
    const general = await targetCommand('save-account', {
      code: '71',
      title: 'Target general',
      level: 'GENERAL',
      nature: 'DEBIT',
      parentId: group.id,
    });
    const subsidiary = await targetCommand('save-account', {
      code: '7101',
      title: 'Target subsidiary',
      level: 'SUBSIDIARY',
      nature: 'DEBIT',
      parentId: general.id,
    });
    const initial = await command<{ rows: { id: string; version: number }[] }>(
      'save-subsidiary-mappings',
      {
        rows: [{ sourceAccountId: debitId, targetAccountId: subsidiary.id }],
        versions: [],
      },
    );
    expect(initial.rows).toHaveLength(1);
    await expect(
      command('save-subsidiary-mappings', { rows: [], versions: [] }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      command('save-subsidiary-mappings', {
        rows: [{ sourceAccountId: debitId, targetAccountId: creditId }],
        versions: initial.rows,
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      command('save-subsidiary-mappings', {
        rows: [
          {
            sourceAccountId: debitId,
            targetAccountId: subsidiary.id,
            detail4Id: randomUUID(),
          },
        ],
        versions: initial.rows,
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      command('save-subsidiary-mappings', {
        rows: [{ sourceAccountId: subsidiary.id, targetAccountId: debitId }],
        versions: initial.rows,
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(
      await db.accountingSubsidiaryMapping.count({ where: { bookId } }),
    ).toBe(1);
    await expect(
      command(
        'save-subsidiary-mappings',
        { rows: [], versions: initial.rows },
        undefined,
        { ...maker, permissions: ['finance.read', 'finance.journal.read'] },
      ),
    ).rejects.toMatchObject({ status: 403 });
    const localType = await command('save-configuration', {
      kind: 'detail-types',
      title: 'Synthetic mapping detail type',
      attributes: { classificationNumberLength: '0' },
    });
    const sourceDetail = await command('save-detail', {
      typeId: localType.id,
      code: '99300',
      title: 'Synthetic source path',
    });
    const pathRows = [
      { sourceAccountId: debitId, targetAccountId: subsidiary.id },
      {
        sourceAccountId: debitId,
        sourceDetail4Id: sourceDetail.id,
        targetAccountId: subsidiary.id,
      },
      {
        sourceAccountId: debitId,
        sourceDetail4Id: sourceDetail.id,
        sourceDetail5Id: sourceDetail.id,
        targetAccountId: subsidiary.id,
      },
    ];
    const pathResult = await command<{
      rows: { id: string; version: number }[];
    }>('save-subsidiary-mappings', { rows: pathRows, versions: initial.rows });
    expect(pathResult.rows).toHaveLength(3);
    await expect(
      command('save-subsidiary-mappings', {
        rows: [
          {
            sourceAccountId: debitId,
            sourceDetail5Id: sourceDetail.id,
            targetAccountId: subsidiary.id,
          },
        ],
        versions: pathResult.rows,
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      command('save-subsidiary-mappings', {
        rows: [
          pathRows[0],
          { ...pathRows[0], sourceAccountId: debitId.toUpperCase() },
        ],
        versions: pathResult.rows,
      }),
    ).rejects.toMatchObject({ status: 422 });
    const allocated = await command<{
      id: string;
      version: number;
      detailAllocations: unknown[];
    }>('save-account-group', {
      code: 'PATH-GROUP',
      title: 'Synthetic detail allocation',
      memberIds: [debitId],
      detailAllocations: [{ accountId: debitId, detailId: sourceDetail.id }],
    });
    expect(allocated.detailAllocations).toHaveLength(1);
    expect(
      (await service.snapshot(bookId, maker)).accountGroups.find(
        (row) => row.id === allocated.id,
      )?.detailAllocations,
    ).toHaveLength(1);
    await expect(
      command(
        'save-account-group',
        {
          id: allocated.id,
          code: 'PATH-GROUP',
          title: 'Synthetic detail allocation',
          memberIds: [debitId],
          detailAllocations: [
            { accountId: creditId, detailId: sourceDetail.id },
          ],
        },
        allocated.version,
      ),
    ).rejects.toMatchObject({ status: 422 });
    await command('save-subsidiary-mappings', {
      rows: [],
      versions: pathResult.rows,
    });
    expect(
      await db.accountingSubsidiaryMapping.count({ where: { bookId } }),
    ).toBe(0);
  });
  it('persists observed chart form tabs, neutral nature and scoped type references', async () => {
    const parent = await db.accountingAccount.findUniqueOrThrow({
      where: { id: debitId },
    });
    const detailType = await command('save-configuration', {
      kind: 'detail-types',
      code: 'FORM-TYPE',
      title: 'Synthetic form detail type',
      attributes: { classificationNumberLength: '6' },
    });
    const payload = {
      code: '119990',
      title: 'Synthetic observed form',
      titleEn: 'Second language',
      description: 'Description survives reload',
      level: 'SUBSIDIARY',
      parentId: parent.parentId,
      nature: 'ANY',
      permanent: true,
      active: true,
      attributes: {
        accountType: 'MEMORANDUM',
        natureControl: 'BLOCK',
        natureControlScope: 'SELECTED_DETAIL',
        detail4TypeIds: [String(detailType.id)],
        detail4NatureTypeIds: [String(detailType.id)],
        detailLevels: ['4', '5', '6'],
        counterpartId: creditId,
        taxAccountKind: 'TAX',
        taxType: 'مالیات تکلیفی',
        defaultDescriptions: '[{"text":"شرح","textEn":"Description"}]',
      },
    };
    const saved = await command<{ id: string; version: number }>(
      'save-account',
      payload,
    );
    const stored = await db.accountingAccount.findUniqueOrThrow({
      where: { id: saved.id },
    });
    expect(stored.nature).toBe('ANY');
    expect(stored.attributes).toMatchObject({
      ...payload.attributes,
      description: payload.description,
    });
    await expect(
      command(
        'save-account',
        {
          ...payload,
          id: saved.id,
          attributes: { ...payload.attributes, counterpartId: randomUUID() },
        },
        saved.version,
      ),
    ).rejects.toMatchObject({ response: { code: 'ACCOUNTING_RULE_FAILED' } });
    await expect(
      command(
        'save-account',
        {
          ...payload,
          id: saved.id,
          attributes: {
            ...payload.attributes,
            detail4TypeIds: [randomUUID()],
            detail4NatureTypeIds: [],
          },
        },
        saved.version,
      ),
    ).rejects.toMatchObject({ response: { code: 'ACCOUNTING_RULE_FAILED' } });
    const unchanged = await db.accountingAccount.findUniqueOrThrow({
      where: { id: saved.id },
    });
    expect(unchanged.version).toBe(saved.version);
  });
  const draft = (description = 'Synthetic transfer') =>
    command<AccountingJournalV1>('journal-save', {
      periodId,
      typeId,
      documentDate: '2026-05-01',
      description,
      lines: [
        { accountId: debitId, debit: '100', credit: '0' },
        { accountId: creditId, debit: '0', credit: '100' },
      ],
    });
  it('persists observed document template roles with scoped FKs and optional-date notes', async () => {
    const note = {
      id: randomUUID(),
      title: 'Synthetic note',
      text: 'Synthetic content',
      date: '',
      createdBy: 'forged',
    };
    const source = { accountId: debitId, role: 'SOURCE', parentPosition: 1 };
    const target = { accountId: creditId, role: 'TARGET', percentage: '100' };
    const payload = {
      kind: 'AUTOMATIC',
      sourceForm: 'rahkaran-documents-v1',
      code: randomUUID(),
      title: 'Synthetic source template',
      description: 'Default',
      descriptionEn: 'Default EN',
      lines: [source, target],
      notes: [note],
    };
    const saved = await command<{
      id: string;
      version: number;
      attributes: Record<string, string>;
      lines: { role: string; accountId: string; percentage: string }[];
    }>('save-template', payload);
    expect(saved.lines.map((line) => line.role)).toEqual(['SOURCE', 'TARGET']);
    expect(saved.lines[0]!.percentage).toBe('100');
    expect(JSON.parse(saved.attributes.notes!).at(0)).toMatchObject({
      date: '',
      createdBy: 'Synthetic accountant',
    });
    await expect(
      command(
        'save-template',
        {
          ...payload,
          id: saved.id,
          lines: [source, { ...target, role: 'BASIS' }],
        },
        saved.version,
      ),
    ).rejects.toThrow();
    expect(
      (
        await db.accountingTemplate.findUniqueOrThrow({
          where: { id: saved.id },
          include: { lines: true },
        })
      ).lines,
    ).toHaveLength(2);
    await expect(
      command(
        'save-template',
        {
          ...payload,
          id: saved.id,
          lines: [source, { ...target, accountId: randomUUID() }],
        },
        saved.version,
      ),
    ).rejects.toThrow();
    await expect(
      command(
        'save-template',
        { ...payload, id: saved.id, voucherTypeId: typeId },
        saved.version,
      ),
    ).rejects.toThrow();
    await expect(
      command('save-template', { ...payload, id: saved.id }, saved.version + 1),
    ).rejects.toThrow();
    const fx = await command<{ id: string; lines: { role: string }[] }>(
      'save-template',
      {
        kind: 'REVALUATION',
        sourceForm: 'rahkaran-documents-v1',
        code: randomUUID(),
        title: 'Synthetic FX pattern',
        lines: [
          { accountId: debitId, role: 'OFFSET' },
          { accountId: creditId, role: 'BASIS', parentPosition: 0 },
        ],
      },
    );
    expect(fx.lines.map((line) => line.role)).toEqual(['OFFSET', 'BASIS']);
    await expect(
      command('save-template', {
        kind: 'REVALUATION',
        code: randomUUID(),
        title: 'Incomplete legacy',
        lines: [],
      }),
    ).rejects.toThrow();
  });
  it('issues statements from selected saved articles with immutable snapshots and version guards', async () => {
    const parent = await db.accountingAccount.findUniqueOrThrow({
      where: { id: debitId },
    });
    const detailType = await command<{ id: string }>('save-configuration', {
      kind: 'detail-types',
      code: 'STATEMENT-TYPE',
      title: 'Synthetic statement type',
      attributes: { classificationNumberLength: '6' },
    });
    const firstRecipient = await command<{ id: string }>('save-detail', {
      typeId: detailType.id,
      title: 'Synthetic statement A',
      code: '987901',
      currency: 'IRR',
      attributes: { classificationNumber: '' },
    });
    const secondRecipient = await command<{ id: string }>('save-detail', {
      typeId: detailType.id,
      title: 'Synthetic statement B',
      code: '987902',
      currency: 'IRR',
      attributes: { classificationNumber: '' },
    });
    const account = await command<{ id: string }>('save-account', {
      code: '11998701',
      title: 'Synthetic statement account',
      level: 'SUBSIDIARY',
      nature: 'ANY',
      parentId: parent.parentId,
      attributes: { detail4TypeIds: [detailType.id], detailLevels: ['4'] },
    });
    const payload = {
      periodId,
      typeId,
      documentDate: '2026-05-02',
      description: 'Synthetic statement basis',
      lines: [
        {
          accountId: account.id,
          detail4Id: firstRecipient.id,
          debit: '60',
          credit: '0',
          description: 'Synthetic A',
        },
        {
          accountId: account.id,
          detail4Id: firstRecipient.id,
          debit: '0',
          credit: '100',
          description: 'Synthetic B',
        },
        {
          accountId: account.id,
          detail4Id: firstRecipient.id,
          debit: '40',
          credit: '0',
          description: 'Synthetic C',
        },
      ],
    };
    const journal = await command<AccountingJournalV1>(
      'journal-document-save',
      payload,
    );
    const selection = {
      journalId: journal.id,
      lineIds: [journal.lines[2]!.id, journal.lines[0]!.id],
      level: 4,
      currencyMode: false,
    };
    const basis = await command<AccountingStatementBasisV1>(
      'journal-statement-preview',
      selection,
    );
    expect(basis.rows.map((row) => row.position)).toEqual([1, 3]);
    expect(basis.balance).toBe('100');
    expect(basis.type).toBe('DEBIT');
    const mixed = await command<AccountingStatementBasisV1>(
      'journal-statement-preview',
      { ...selection, lineIds: journal.lines.map((line) => line.id) },
    );
    expect(mixed.type).toBe('BOTH');
    expect(mixed.balance).toBe('0');
    const baseCurrency = await db.masterCurrency.upsert({
      where: { code: 'IRR' },
      update: {},
      create: {
        code: 'IRR',
        name: 'Synthetic statement currency',
        decimalDigits: 0,
        createdByUserId: makerId,
        updatedByUserId: makerId,
      },
    });
    const currencyBasis = await command<AccountingStatementBasisV1>(
      'journal-statement-preview',
      { ...selection, currencyMode: true },
    );
    expect(
      currencyBasis.rows.every(
        (row) =>
          row.currency === 'IRR' &&
          row.currencyName === baseCurrency.name &&
          row.foreignDebit === row.debit,
      ),
    ).toBe(true);
    expect(currencyBasis.balance).toBe('100');
    await expect(
      command('journal-statement-preview', { ...selection, level: 5 }),
    ).rejects.toThrow();
    await expect(
      command('journal-statement-preview', {
        ...selection,
        lineIds: [randomUUID()],
      }),
    ).rejects.toThrow();
    const write = {
      ...selection,
      checksum: basis.checksum,
      periodId,
      documentDate: '2026-05-03',
      description: 'Synthetic statement',
      status: 'CREATED',
      notes: [],
    };
    await expect(
      command('journal-statement-save', { ...write, checksum: 'stale' }),
    ).rejects.toThrow();
    const key = randomUUID();
    const saved = await command<AccountingStatementV1>(
      'journal-statement-save',
      write,
      undefined,
      maker,
      key,
    );
    expect(
      await command('journal-statement-save', write, undefined, maker, key),
    ).toEqual(saved);
    expect(saved.snapshot.rows.map((row) => row.position)).toEqual([1, 3]);
    const repeated = await command<AccountingStatementV1>(
      'journal-statement-save',
      write,
    );
    expect(repeated.number).toBe(saved.number + 1);
    expect(repeated.recipientNumber).toBe(saved.recipientNumber + 1);
    await expect(
      command(
        'journal-statement-save',
        {
          id: saved.id,
          documentDate: saved.documentDate,
          status: 'SENT',
          description: saved.description,
          notes: [],
        },
        saved.version + 1,
      ),
    ).rejects.toThrow();
    const updated = await command<AccountingStatementV1>(
      'journal-statement-save',
      {
        id: saved.id,
        documentDate: saved.documentDate,
        status: 'SENT',
        description: 'Changed',
        notes: [],
      },
      saved.version,
    );
    expect(updated.status).toBe('SENT');
    expect(updated.snapshot).toEqual(saved.snapshot);
    await expect(
      db.accountingStatement.update({
        where: { id: saved.id },
        data: { snapshot: { forged: true } },
      }),
    ).rejects.toThrow();
    const cancelled = await command<AccountingStatementV1>(
      'journal-statement-cancel',
      { id: saved.id },
      updated.version,
    );
    expect(cancelled.status).toBe('CANCELLED');
    const changed = await command<AccountingJournalV1>(
      'journal-document-save',
      {
        ...payload,
        id: journal.id,
        lines: payload.lines.map((line, index) =>
          index === 1 ? { ...line, detail4Id: secondRecipient.id } : line,
        ),
      },
      journal.version,
    );
    await expect(command('journal-statement-save', write)).rejects.toThrow();
    await expect(
      command('journal-statement-preview', {
        ...selection,
        lineIds: changed.lines.map((line) => line.id),
      }),
    ).rejects.toThrow();
    const list = await service.analyticalReport(
      bookId,
      'document-statements',
      { journalId: journal.id },
      maker,
    );
    expect((list as { items: unknown[] }).items).toHaveLength(2);
    await expect(
      service.analyticalReport(
        bookId,
        'document-statements',
        { journalId: journal.id },
        { ...maker, branchIds: [] },
      ),
    ).rejects.toThrow();
  });
  it('sorts exact document amounts before paging and uses public identity names', async () => {
    const marker = randomUUID();
    const created: AccountingJournalV1[] = [];
    const save = async (amount: string) => {
      const result = await command<AccountingJournalV1>('journal-save', {
        periodId,
        typeId,
        documentDate: '2026-05-02',
        description: marker,
        lines: [
          { accountId: debitId, debit: amount, credit: '0' },
          { accountId: creditId, debit: '0', credit: amount },
        ],
      });
      created.push(result);
      return result;
    };
    try {
      const high = await save('9007199254740994');
      const low = await save('9007199254740993');
      for (let index = 0; index < 29; index++) await save('1');
      const filter = JSON.stringify({
        type: 'rule',
        field: 'description',
        operator: 'equals',
        value: marker,
      });
      const descending = await service.journals(
        bookId,
        { filter, sort: 'amount', direction: 'desc', pageSize: '30' },
        maker,
      );
      expect(descending.total).toBe(31);
      expect(descending.items[0]?.id).toBe(high.id);
      const ascending = await service.journals(
        bookId,
        { filter, sort: 'amount', direction: 'asc', pageSize: '30' },
        maker,
      );
      expect(ascending.items.at(-1)?.id).toBe(low.id);
      const last = await service.journals(
        bookId,
        { filter, sort: 'amount', direction: 'asc', pageSize: '30', page: '2' },
        maker,
      );
      expect(last.items[0]?.id).toBe(high.id);
      for (const sort of [
        'isCurrency',
        'typeId',
        'makerId',
        'lastModifierId',
        'approverId',
      ]) {
        const result = await service.journals(
          bookId,
          { filter, sort, direction: 'asc' },
          maker,
        );
        expect(result.total).toBe(31);
        const grouped = await service.journals(
          bookId,
          { filter, group: sort, direction: 'asc' },
          maker,
        );
        expect(grouped.total).toBe(31);
      }
    } finally {
      for (const record of created)
        await command('cancel', { id: record.id }, record.version);
    }
  });
  it('filters document lines before pagination and guards source numbering preview versions', async () => {
    const marker = randomUUID();
    const create = () =>
      command<AccountingJournalV1>('journal-save', {
        periodId,
        typeId,
        documentDate: '2026-05-03',
        description: marker,
        lines: [
          { accountId: debitId, debit: '123.45', credit: '0' },
          { accountId: creditId, debit: '0', credit: '123.45' },
        ],
      });
    const first = await create(),
      second = await create();
    const condition = {
      type: 'rule',
      field: 'description',
      operator: 'equals',
      value: marker,
    };
    const filtered = await service.journals(
      bookId,
      {
        pageSize: '50',
        filter: JSON.stringify({
          type: 'group',
          mode: 'all',
          children: [
            condition,
            {
              type: 'lines',
              mode: 'any',
              condition: {
                type: 'group',
                mode: 'all',
                children: [
                  {
                    type: 'rule',
                    field: 'debit',
                    operator: 'equals',
                    value: '123.45',
                  },
                  {
                    type: 'rule',
                    field: 'accountId',
                    operator: 'equals',
                    value: debitId,
                  },
                ],
              },
            },
          ],
        }),
      },
      maker,
    );
    expect(filtered.total).toBe(2);
    expect(filtered.pageSize).toBe(50);
    await expect(
      service.journals(
        bookId,
        { export: 'true' },
        {
          ...maker,
          permissions: maker.permissions.filter(
            (permission) => permission !== 'finance.export',
          ),
        },
      ),
    ).rejects.toThrow();
    const exported = await service.journals(
      bookId,
      {
        export: 'true',
        filter: JSON.stringify(condition),
        group: 'documentDate',
      },
      { ...maker, permissions: [...maker.permissions, 'finance.export'] },
    );
    expect(exported.total).toBe(2);
    expect(exported.items.map((row) => row.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
    await expect(
      service.journals(
        bookId,
        { group: 'j.id; DROP TABLE accounting_journals' },
        maker,
      ),
    ).rejects.toThrow();
    const emptyDescription = await service.journals(
      bookId,
      {
        filter: JSON.stringify({
          type: 'group',
          mode: 'all',
          children: [
            condition,
            { type: 'rule', field: 'description', operator: 'empty' },
          ],
        }),
      },
      maker,
    );
    expect(emptyDescription.total).toBe(0);
    const sourceFilter = async (node: unknown) =>
      service.journals(
        bookId,
        {
          filter: JSON.stringify({
            type: 'group',
            mode: 'all',
            children: [condition, node],
          }),
        },
        maker,
      );
    expect(
      (
        await sourceFilter({
          type: 'rule',
          field: 'referenceNumber',
          operator: 'empty',
        })
      ).total,
    ).toBe(2);
    expect(
      (
        await sourceFilter({
          type: 'rule',
          field: 'referenceNumber',
          operator: 'not-equals',
          value: 'absent',
        })
      ).total,
    ).toBe(2);
    expect(
      (
        await sourceFilter({
          type: 'rule',
          field: 'dailyNumber',
          operator: 'between',
          value: String(first.attributes.dailyNumber),
          end: String(second.attributes.dailyNumber),
        })
      ).total,
    ).toBe(2);
    expect(
      (
        await sourceFilter({
          type: 'rule',
          field: 'branchId',
          operator: 'equals',
          value: branchId,
        })
      ).total,
    ).toBe(2);
    expect(
      (
        await sourceFilter({
          type: 'lines',
          mode: 'any',
          condition: {
            type: 'rule',
            field: 'position',
            operator: 'equals',
            value: '1',
          },
        })
      ).total,
    ).toBe(2);
    expect(
      (
        await sourceFilter({
          type: 'lines',
          mode: 'all',
          condition: {
            type: 'rule',
            field: 'debit',
            operator: 'equals',
            value: '123.45',
          },
        })
      ).total,
    ).toBe(0);
    const before = await db.accountingJournal.findUniqueOrThrow({
      where: { id: first.id },
    });
    await expect(
      command('number-journal-preview', {
        periodId,
        filter: condition,
        items: [
          { id: first.id, expectedVersion: first.version + 1 },
          { id: second.id, expectedVersion: second.version },
        ],
      }),
    ).rejects.toThrow();
    expect(
      (
        await db.accountingJournal.findUniqueOrThrow({
          where: { id: first.id },
        })
      ).version,
    ).toBe(before.version);
    const key = randomUUID();
    const payload = {
      filter: condition,
      periodId,
      items: [
        { id: first.id, expectedVersion: first.version },
        { id: second.id, expectedVersion: second.version },
      ],
    };
    const numbered = await command<{
      rows: { id: string; newNumber: number }[];
    }>('number-journal-preview', payload, undefined, maker, key);
    expect(numbered.rows.map((row) => row.id)).toEqual([first.id, second.id]);
    expect(numbered.rows[1]!.newNumber).toBe(numbered.rows[0]!.newNumber + 1);
    expect(
      await command('number-journal-preview', payload, undefined, maker, key),
    ).toEqual(numbered);
    expect(
      (
        await db.accountingJournal.findUniqueOrThrow({
          where: { id: first.id },
        })
      ).version,
    ).toBe(first.version + 1);
    await expect(
      service.journals(
        bookId,
        { filter: JSON.stringify(condition) },
        { ...maker, branchIds: [] },
      ),
    ).rejects.toThrow();
  });
  it('separates memorandum saving from complete temporary documents and audits the transition', async () => {
    const payload = {
      periodId,
      typeId,
      documentDate: '2026-01-04',
      description: '',
      lines: [{ accountId: null, debit: '0', credit: '0' }],
    };
    const memo = await command<AccountingJournalV1>(
      'journal-memorandum-save',
      payload,
    );
    expect(memo.status).toBe('MEMORANDUM');
    expect(memo.lines[0]?.accountId).toBeNull();
    await expect(
      command('submit', { id: memo.id }, memo.version),
    ).rejects.toThrow();
    await expect(
      command('review-document', { id: memo.id }, memo.version, checker),
    ).rejects.toThrow();
    await expect(
      command(
        'journal-document-save',
        { ...payload, id: memo.id },
        memo.version,
      ),
    ).rejects.toThrow();
    expect(
      (await db.accountingJournal.findUniqueOrThrow({ where: { id: memo.id } }))
        .version,
    ).toBe(memo.version);
    const complete = {
      ...payload,
      id: memo.id,
      lines: [
        {
          accountId: debitId,
          debit: '20',
          credit: '0',
          description: 'Synthetic debit',
        },
        {
          accountId: creditId,
          debit: '0',
          credit: '20',
          description: 'Synthetic credit',
        },
      ],
    };
    const temporary = await command<AccountingJournalV1>(
      'journal-document-save',
      complete,
      memo.version,
    );
    expect(temporary.status).toBe('DRAFT');
    expect(temporary.description).toBe('');
    expect(temporary.version).toBe(memo.version + 1);
    expect(
      await db.accountingJournalStateEvent.count({
        where: {
          journalId: memo.id,
          fromStatus: 'MEMORANDUM',
          toStatus: 'DRAFT',
        },
      }),
    ).toBe(1);
    await expect(
      command(
        'journal-document-save',
        {
          ...complete,
          lines: complete.lines.map((line) => ({ ...line, description: '' })),
        },
        temporary.version,
      ),
    ).rejects.toThrow();
    const second = await command<AccountingJournalV1>(
      'journal-memorandum-save',
      payload,
    );
    const cancelled = await command<AccountingJournalV1>(
      'cancel',
      { id: second.id },
      second.version,
    );
    const restored = await command<AccountingJournalV1>(
      'restore',
      { id: second.id },
      cancelled.version,
    );
    expect(restored.status).toBe('MEMORANDUM');
  });
  it('reviews a temporary document atomically while preserving independent checker and version guards', async () => {
    const row = await draft();
    await expect(
      command('review-document', { id: row.id }, row.version),
    ).rejects.toThrow();
    expect(
      (await db.accountingJournal.findUniqueOrThrow({ where: { id: row.id } }))
        .status,
    ).toBe('DRAFT');
    const reviewed = await command<AccountingJournalV1>(
      'review-document',
      { id: row.id },
      row.version,
      checker,
    );
    expect(reviewed.status).toBe('APPROVED');
    expect(reviewed.approverId).toBe(checkerId);
    expect(reviewed.lines).toEqual(row.lines);
    expect(reviewed.version).toBe(row.version + 2);
    const events = await db.accountingJournalStateEvent.findMany({
      where: { journalId: row.id, eventType: 'STATUS' },
      orderBy: { journalVersion: 'asc' },
    });
    expect(events.map((event) => event.toStatus)).toEqual([
      'PENDING_APPROVAL',
      'APPROVED',
    ]);
    await expect(
      command('unreview-document', { id: row.id }, row.version, checker),
    ).rejects.toThrow();
    const unreviewed = await command<AccountingJournalV1>(
      'unreview-document',
      { id: row.id },
      reviewed.version,
      checker,
    );
    expect(unreviewed.status).toBe('DRAFT');
    expect(unreviewed.lines).toEqual(row.lines);
  });
  it('transfers mapped main-ledger journals atomically with destination audit and duplicate protection', async () => {
    const createBook = async (isMain: boolean) =>
      service.createBook(
        {
          id: randomUUID(),
          branchId,
          code: randomUUID().slice(0, 8),
          title: 'Synthetic transfer book',
          baseCurrency: 'IRR',
          approvalPolicy: 'DUAL_CONTROL',
          isMain,
          allowsPosting: true,
        },
        maker,
      );
    const source = await createBook(true),
      target = await createBook(false);
    const scoped = <T = Record<string, unknown>>(
      id: string,
      action: string,
      payload: Record<string, unknown>,
      expectedVersion?: number,
      actor = maker,
      key = randomUUID(),
    ) =>
      service
        .command(
          id,
          action,
          {
            key,
            payload,
            ...(expectedVersion === undefined ? {} : { expectedVersion }),
          },
          actor,
        )
        .then((result) => JSON.parse(JSON.stringify(result)) as T);
    const setup = async (id: string) => {
      const year = await scoped<{ id: string }>(id, 'save-configuration', {
        kind: 'fiscal-years',
        code: '1998',
        title: 'Synthetic year',
      });
      const period = await scoped<{ id: string }>(id, 'save-period', {
        fiscalYearId: year.id,
        startDate: '1998-01-01',
        endDate: '1998-12-31',
      });
      const type = await scoped<{ id: string }>(id, 'save-configuration', {
        kind: 'voucher-types',
        code: '1',
        title: 'Synthetic manual',
      });
      const group = await scoped<{ id: string }>(id, 'save-account', {
        code: '1',
        title: 'Synthetic group',
        level: 'GROUP',
        nature: 'ANY',
      });
      const general = await scoped<{ id: string }>(id, 'save-account', {
        code: '11',
        title: 'Synthetic general',
        level: 'GENERAL',
        nature: 'ANY',
        parentId: group.id,
      });
      const debit = await scoped<{ id: string }>(id, 'save-account', {
        code: '1101',
        title: 'Synthetic debit',
        level: 'SUBSIDIARY',
        nature: 'ANY',
        parentId: general.id,
      });
      const credit = await scoped<{ id: string }>(id, 'save-account', {
        code: '1102',
        title: 'Synthetic credit',
        level: 'SUBSIDIARY',
        nature: 'ANY',
        parentId: general.id,
      });
      return { period, type, debit, credit };
    };
    const a = await setup(source.id),
      b = await setup(target.id);
    await scoped(source.id, 'save-subsidiary-mappings', {
      versions: [],
      rows: [
        { sourceAccountId: a.debit.id, targetAccountId: b.debit.id },
        { sourceAccountId: a.credit.id, targetAccountId: b.credit.id },
      ],
    });
    let journal = await scoped<AccountingJournalV1>(
      source.id,
      'journal-document-save',
      {
        periodId: a.period.id,
        typeId: a.type.id,
        documentDate: '1998-01-05',
        description: 'Synthetic transfer origin',
        lines: [
          {
            accountId: a.debit.id,
            description: 'Synthetic debit',
            debit: '100',
            credit: '0',
          },
          {
            accountId: a.credit.id,
            description: 'Synthetic credit',
            debit: '0',
            credit: '100',
          },
        ],
      },
    );
    journal = await scoped<AccountingJournalV1>(
      source.id,
      'review-document',
      { id: journal.id },
      journal.version,
      checker,
    );
    const input = {
      periodId: a.period.id,
      filterMode: 'date',
      fromDate: '1998-01-01',
      toDate: '1998-01-31',
      dateMode: 'source',
      aggregate: false,
      ids: [journal.id],
    };
    const preview = await scoped<{
      checksum: string;
      documents: { targetBookId: string }[];
    }>(source.id, 'document-transfer-preview', input);
    expect(preview.documents[0]?.targetBookId).toBe(target.id);
    const basis = await scoped<{ checksum: string }>(
      source.id,
      'document-transfer-preview',
      { ...input, ids: undefined },
    );
    await expect(
      scoped(source.id, 'document-transfer-run', {
        ...input,
        checksum: preview.checksum,
        basisChecksum: 'stale-reviewed-list',
      }),
    ).rejects.toThrow('فهرست بررسی‌شده تغییر کرده است');
    expect(
      await db.accountingJournalTransfer.count({
        where: { sourceJournalId: journal.id },
      }),
    ).toBe(0);
    const key = randomUUID();
    const result = await scoped<{
      items: { bookId: string; journal: AccountingJournalV1 }[];
    }>(
      source.id,
      'document-transfer-run',
      { ...input, checksum: preview.checksum, basisChecksum: basis.checksum },
      undefined,
      maker,
      key,
    );
    expect(result.items[0]?.bookId).toBe(target.id);
    expect(result.items[0]?.journal.status).toBe('DRAFT');
    expect(result.items[0]?.journal.lines[0]?.accountId).toBe(b.debit.id);
    const received = result.items[0]!.journal;
    expect(
      await db.accountingJournalStateEvent.count({
        where: {
          bookId: target.id,
          journalId: received.id,
          eventType: 'CREATE',
        },
      }),
    ).toBe(1);
    expect(
      (
        await scoped<{ items: { journal: { id: string } }[] }>(
          source.id,
          'document-transfer-run',
          {
            ...input,
            checksum: preview.checksum,
            basisChecksum: basis.checksum,
          },
          undefined,
          maker,
          key,
        )
      ).items[0]?.journal.id,
    ).toBe(received.id);
    await expect(
      scoped(source.id, 'document-transfer-run', {
        ...input,
        checksum: preview.checksum,
      }),
    ).rejects.toThrow();
    await expect(
      scoped(
        source.id,
        'unreview-document',
        { id: journal.id },
        journal.version,
        checker,
      ),
    ).rejects.toThrow();
    await expect(
      db.accountingJournalTransfer.deleteMany({
        where: { sourceJournalId: journal.id },
      }),
    ).rejects.toThrow();
  }, 60000);
  it('adds current line descriptions to its scoped subsidiary without lost updates', async () => {
    const account = await db.accountingAccount.findUniqueOrThrow({
      where: { id: debitId },
    });
    const payload = {
      accountId: debitId,
      description: 'Synthetic default description',
      descriptionEn: 'Synthetic second language',
    };
    const saved = await command<{
      version: number;
      attributes: { defaultDescriptions: string };
    }>('add-line-default-description', payload, account.version);
    expect(JSON.parse(saved.attributes.defaultDescriptions)).toContainEqual({
      text: payload.description,
      textEn: payload.descriptionEn,
    });
    await expect(
      command(
        'add-line-default-description',
        { ...payload, description: 'Different' },
        account.version,
      ),
    ).rejects.toThrow();
    await expect(
      command('add-line-default-description', payload, saved.version),
    ).rejects.toThrow();
    expect(
      (await db.accountingAccount.findUniqueOrThrow({ where: { id: debitId } }))
        .version,
    ).toBe(saved.version);
  });
  it('reviews selected documents as one transaction and audits the supplied explanation', async () => {
    const description = `Synthetic review all ${randomUUID()}`;
    const first = await draft(description),
      second = await draft(description);
    const items = [first, second].map((row) => ({
      id: row.id,
      expectedVersion: row.version,
    }));
    await expect(
      command(
        'review-documents',
        {
          items: [
            items[0],
            { ...items[1], expectedVersion: second.version + 1 },
          ],
          reason: 'Synthetic review',
        },
        undefined,
        checker,
      ),
    ).rejects.toThrow();
    expect(
      (
        await db.accountingJournal.findMany({
          where: { id: { in: [first.id, second.id] } },
        })
      ).map((row) => row.status),
    ).toEqual(['DRAFT', 'DRAFT']);
    expect(
      await db.accountingJournalStateEvent.count({
        where: {
          journalId: { in: [first.id, second.id] },
          eventType: 'STATUS',
        },
      }),
    ).toBe(0);
    const result = await command<{ total: number }>(
      'review-documents',
      { items, reason: 'Synthetic review' },
      undefined,
      checker,
    );
    expect(result.total).toBe(2);
    const events = await db.accountingJournalStateEvent.findMany({
      where: { journalId: { in: [first.id, second.id] }, eventType: 'STATUS' },
    });
    expect(events).toHaveLength(4);
    expect(events.every((event) => event.reason === 'Synthetic review')).toBe(
      true,
    );
    const allPayload = {
      periodId,
      undo: true,
      filter: {
        type: 'rule',
        field: 'description',
        operator: 'equals',
        value: description,
      },
    };
    const basis = await command<{ checksum: string; total: number }>(
      'review-all-preview',
      allPayload,
      undefined,
      checker,
    );
    expect(basis.total).toBe(2);
    const firstReviewed = await db.accountingJournal.findUniqueOrThrow({
      where: { id: first.id },
    });
    await command(
      'unreview-document',
      { id: first.id },
      firstReviewed.version,
      checker,
    );
    await expect(
      command(
        'review-all-documents',
        { ...allPayload, checksum: basis.checksum },
        undefined,
        checker,
      ),
    ).rejects.toThrow();
    const fresh = await command<{ checksum: string; total: number }>(
      'review-all-preview',
      allPayload,
      undefined,
      checker,
    );
    expect(fresh.total).toBe(1);
    expect(
      (
        await command<{ total: number }>(
          'review-all-documents',
          {
            ...allPayload,
            checksum: fresh.checksum,
            reason: 'Synthetic undo all',
          },
          undefined,
          checker,
        )
      ).total,
    ).toBe(1);
  });
  it('generates automatic temporary transfers from real source balances and rejects stale bases', async () => {
    await db.masterCurrency.upsert({
      where: { code: 'IRR' },
      update: {},
      create: {
        code: 'IRR',
        name: 'Synthetic currency',
        decimalDigits: 0,
        createdByUserId: makerId,
        updatedByUserId: makerId,
      },
    });
    const parent = await db.accountingAccount.findUniqueOrThrow({
      where: { id: debitId },
    });
    const createAccount = (code: string) =>
      command<{ id: string }>('save-account', {
        code,
        title: 'Synthetic automatic transfer',
        level: 'SUBSIDIARY',
        nature: 'ANY',
        parentId: parent.parentId,
      });
    const source = await createAccount('11998802');
    const target = await createAccount('11998803');
    const origin = {
      periodId,
      typeId,
      documentDate: '2026-01-07',
      description: '',
      lines: [
        {
          accountId: source.id,
          description: 'Synthetic source',
          debit: '100',
          credit: '0',
        },
        {
          accountId: creditId,
          description: 'Synthetic offset',
          debit: '0',
          credit: '100',
        },
      ],
    };
    await command('journal-document-save', origin);
    const template = await command<{ id: string }>('save-template', {
      kind: 'AUTOMATIC',
      sourceForm: 'rahkaran-documents-v1',
      code: randomUUID(),
      title: 'Synthetic automatic template',
      active: true,
      lines: [
        { accountId: target.id, role: 'TARGET', percentage: '25' },
        { accountId: source.id, role: 'SOURCE', parentPosition: 0 },
      ],
    });
    const input = {
      templateId: template.id,
      asOf: '2026-01-07',
      documentDate: '2026-01-07',
      typeId,
      description: 'Synthetic transfer',
      trackingNumber: 'Synthetic tracking',
    };
    type Preview = {
      checksum: string;
      lines: { accountId: string; debit: string; credit: string }[];
    };
    const first = await command<Preview>('automatic-preview', input);
    expect(
      first.lines.map((line) => [line.accountId, line.debit, line.credit]),
    ).toEqual([
      [source.id, '0', '25'],
      [target.id, '25', '0'],
    ]);
    await command('journal-document-save', origin);
    await expect(
      command('automatic-run', { ...input, checksum: first.checksum }),
    ).rejects.toThrow('پیش‌نمایش');
    const ready = await command<Preview>('automatic-preview', input);
    const key = randomUUID();
    const payload = { ...input, checksum: ready.checksum };
    const generated = await command<AccountingJournalV1>(
      'automatic-run',
      payload,
      undefined,
      maker,
      key,
    );
    expect(generated.status).toBe('DRAFT');
    expect(generated.lines.map((line) => [line.debit, line.credit])).toEqual([
      ['0', '50'],
      ['50', '0'],
    ]);
    expect(
      generated.lines.every(
        (line) => line.attributes.trackingNumber === 'Synthetic tracking',
      ),
    ).toBe(true);
    expect(
      await command('automatic-run', payload, undefined, maker, key),
    ).toEqual(generated);
    const edited = await command<AccountingJournalV1>(
      'journal-document-save',
      {
        ...generated,
        lines: generated.lines.map((line) => ({
          ...line,
          attributes: { trackingNumber: 'Synthetic tracking' },
          description: 'Edited transfer',
        })),
        attributes: {},
      },
      generated.version,
    );
    expect(edited.lines[0]?.description).toBe('Edited transfer');
    expect(edited.attributes.automaticTemplateId).toBe(template.id);
  }, 60000);
  it('generates source revaluation from currency balances and protects its immutable basis', async () => {
    await db.masterCurrency.upsert({
      where: { code: 'USD' },
      update: { isActive: true },
      create: {
        code: 'USD',
        name: 'Synthetic dollar',
        englishName: 'Synthetic dollar',
        decimalDigits: 2,
        createdByUserId: makerId,
        updatedByUserId: makerId,
      },
    });
    await db.masterCurrency.upsert({
      where: { code: 'IRR' },
      update: {},
      create: {
        code: 'IRR',
        name: 'Synthetic currency',
        decimalDigits: 0,
        createdByUserId: makerId,
        updatedByUserId: makerId,
      },
    });
    const year = await command<{ id: string }>('save-configuration', {
      kind: 'fiscal-years',
      code: '1999',
      title: 'Synthetic revaluation year',
    });
    const period = await command<{ id: string }>('save-period', {
      fiscalYearId: year.id,
      startDate: '1999-01-01',
      endDate: '1999-12-31',
    });
    const base = await db.accountingAccount.findUniqueOrThrow({
      where: { id: debitId },
    });
    const account = await command<{ id: string }>('save-account', {
      code: '11998804',
      title: 'Synthetic FX basis',
      parentId: base.parentId,
      level: 'SUBSIDIARY',
      nature: 'ANY',
      attributes: { multiCurrency: true, revaluable: true },
    });
    await command('save-configuration', {
      kind: 'voucher-types',
      code: randomUUID(),
      title: 'تسعیر ارز',
      active: true,
    });
    const makeRate = async (rate: string) => {
      const draft = await command<{ id: string; version: number }>('save-fx', {
        currency: 'USD',
        rate,
        source: 'Synthetic rate',
        validFrom: new Date(Date.now() - 60000).toISOString(),
        validTo: new Date(Date.now() + 86400000).toISOString(),
      });
      return command<{ id: string }>(
        'approve-fx',
        { id: draft.id },
        draft.version,
        checker,
      );
    };
    const originalRate = await makeRate('100');
    const input = {
      periodId: period.id,
      typeId,
      documentDate: '1999-01-05',
      description: 'Synthetic FX origin',
      lines: [
        {
          accountId: account.id,
          description: 'Synthetic basis',
          debit: '1000',
          credit: '0',
          currency: 'USD',
          foreignAmount: '10',
          rate: '100',
          fxSnapshotId: originalRate.id,
        },
        {
          accountId: creditId,
          description: 'Synthetic offset',
          debit: '0',
          credit: '1000',
        },
      ],
    };
    await command('journal-document-save', input);
    expect(
      await service.analyticalReport(
        bookId,
        'document-revaluation-currencies',
        {},
        maker,
      ),
    ).toEqual([{ value: 'USD', label: 'Synthetic dollar' }]);
    const template = await command<{ id: string }>('save-template', {
      kind: 'REVALUATION',
      sourceForm: 'rahkaran-documents-v1',
      code: randomUUID(),
      title: 'Synthetic source revaluation',
      active: true,
      lines: [
        { accountId: creditId, role: 'OFFSET' },
        { accountId: account.id, role: 'BASIS', parentPosition: 0 },
      ],
    });
    const nextRate = await makeRate('110');
    const payload = {
      templateId: template.id,
      currency: 'USD',
      rateId: nextRate.id,
      asOf: '1999-01-06',
      description: 'Synthetic valuation',
      notes: [
        {
          id: randomUUID(),
          title: 'Synthetic note',
          date: '1999-01-06',
          text: 'Synthetic valuation note',
        },
      ],
    };
    const preview = await command<{
      checksum: string;
      lines: { debit: string; credit: string }[];
    }>('document-revaluation-preview', payload);
    const defaultDescription = await command<{
      description: string;
      attributes: { descriptionEn: string };
    }>('document-revaluation-preview', { ...payload, description: '' });
    expect(defaultDescription.description).toBe(
      'ثبت بابت سند تسعیر ارز Synthetic dollar',
    );
    expect(defaultDescription.attributes.descriptionEn).toBe(
      'Conversion Voucher for Synthetic dollar',
    );
    expect(preview.lines.map((line) => [line.debit, line.credit])).toEqual([
      ['100', '0'],
      ['0', '100'],
    ]);
    const key = randomUUID();
    const created = await command<AccountingJournalV1>(
      'document-revaluation-run',
      { ...payload, checksum: preview.checksum },
      undefined,
      maker,
      key,
    );
    expect(created.status).toBe('DRAFT');
    expect(created.lines[0]?.currency).toBeNull();
    expect(created.lines[0]?.attributes.valuationCurrency).toBe('USD');
    const revaluations = await service.journals(
      bookId,
      {
        sourceKind: 'revaluation',
        periodId: period.id,
        excludeCancelled: 'true',
        filter: JSON.stringify({
          type: 'rule',
          field: 'revaluationRate',
          operator: 'equals',
          value: '110',
        }),
      },
      maker,
    );
    expect(revaluations.total).toBe(1);
    expect(revaluations.items[0]?.id).toBe(created.id);
    const named = await service.journals(
      bookId,
      {
        sourceKind: 'revaluation',
        periodId: period.id,
        filter: JSON.stringify({
          type: 'rule',
          field: 'revaluationCurrency',
          operator: 'equals',
          value: 'Synthetic dollar',
        }),
      },
      maker,
    );
    expect(named.items.map((row) => row.id)).toEqual([created.id]);
    for (const group of [
      'auxiliaryNumber',
      'documentDate',
      'number',
      'reference',
      'revaluationCurrency',
      'revaluationRate',
    ]) {
      const grouped = await service.journals(
        bookId,
        {
          sourceKind: 'revaluation',
          periodId: period.id,
          group,
          filter: JSON.stringify({
            type: 'group',
            mode: 'all',
            children: [
              {
                type: 'rule',
                field: 'periodId',
                operator: 'equals',
                value: period.id,
              },
              {
                type: 'group',
                domain: 'journal',
                mode: 'all',
                children: [
                  {
                    type: 'rule',
                    field: 'number',
                    operator: 'equals',
                    value: String(created.number),
                  },
                  {
                    type: 'lines',
                    mode: 'any',
                    condition: {
                      type: 'group',
                      mode: 'all',
                      children: [
                        {
                          type: 'rule',
                          field: 'accountId',
                          operator: 'equals',
                          value: account.id,
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          }),
        },
        maker,
      );
      expect(grouped.items.map((row) => row.id)).toEqual([created.id]);
    }
    expect(
      (
        await service.journals(
          bookId,
          { sourceKind: 'revaluation', id: created.id },
          maker,
        )
      ).items[0]?.id,
    ).toBe(created.id);
    expect(JSON.parse(String(created.attributes.notes))[0]).toMatchObject({
      title: 'Synthetic note',
      text: 'Synthetic valuation note',
      createdBy: 'Synthetic accountant',
    });
    await expect(
      command('journal-document-save', { ...created }, created.version),
    ).rejects.toThrow();
    expect(
      (
        await command<AccountingJournalV1>(
          'document-revaluation-run',
          { ...payload, checksum: preview.checksum },
          undefined,
          maker,
          key,
        )
      ).id,
    ).toBe(created.id);
    await command('journal-document-save', {
      ...input,
      lines: input.lines.map((line) => ({
        ...line,
        debit: line.debit === '0' ? '0' : '200',
        credit: line.credit === '0' ? '0' : '200',
        ...(line.currency ? { foreignAmount: '2' } : {}),
      })),
    });
    await expect(
      command('submit', { id: created.id }, created.version),
    ).rejects.toThrow();
    await command('cancel', { id: created.id }, created.version, checker);
  });
  it('imports journal batches atomically with regular validation and command replay', async () => {
    const document = {
      periodId,
      documentDate: '2026-01-07',
      description: 'Synthetic imported journal',
      auxiliaryNumber: '0041',
      descriptionEn: 'Synthetic import',
      lines: [
        {
          accountId: debitId,
          description: 'Synthetic debit',
          debit: '12',
          credit: '0',
        },
        {
          accountId: creditId,
          description: 'Synthetic credit',
          debit: '0',
          credit: '12',
        },
      ],
    };
    const before = await db.accountingJournal.count({ where: { bookId } });
    await expect(
      command('document-import-run', {
        typeId,
        saveMode: 'TEMP',
        documents: [
          document,
          {
            ...document,
            lines: [{ ...document.lines[0], accountId: randomUUID() }],
          },
        ],
      }),
    ).rejects.toThrow();
    expect(await db.accountingJournal.count({ where: { bookId } })).toBe(
      before,
    );
    const key = randomUUID(),
      payload = { typeId, saveMode: 'TEMP', documents: [document, document] };
    const result = await command<{
      items: AccountingJournalV1[];
      total: number;
    }>('document-import-run', payload, undefined, maker, key);
    expect(result.total).toBe(2);
    expect(result.items.every((item) => item.status === 'DRAFT')).toBe(true);
    expect(result.items[0]?.attributes.auxiliaryNumber).toBe('0041');
    expect(result.items[1]!.number).toBe(result.items[0]!.number! + 1);
    expect(
      (
        await command<{ items: AccountingJournalV1[] }>(
          'document-import-run',
          payload,
          undefined,
          maker,
          key,
        )
      ).items[0]?.id,
    ).toBe(result.items[0]?.id);
    const memo = await command<{ items: AccountingJournalV1[] }>(
      'document-import-run',
      {
        typeId,
        saveMode: 'MEMORANDUM',
        documents: [{ ...document, lines: [] }],
      },
    );
    expect(memo.items[0]?.status).toBe('MEMORANDUM');
    const selected = result.items.map((item) => ({
      id: item.id,
      expectedVersion: item.version,
    }));
    await expect(
      command('journal-delete-documents', {
        items: [selected[0], { ...selected[1], expectedVersion: 999999 }],
      }),
    ).rejects.toThrow();
    expect(
      (
        await db.accountingJournal.findUniqueOrThrow({
          where: { id: result.items[0]!.id },
        })
      ).status,
    ).toBe('DRAFT');
    const deleteKey = randomUUID();
    const deleted = await command<{ total: number }>(
      'journal-delete-documents',
      { items: selected },
      undefined,
      maker,
      deleteKey,
    );
    expect(deleted.total).toBe(2);
    expect(
      await db.accountingJournal.count({
        where: {
          id: { in: selected.map((item) => item.id) },
          status: 'CANCELLED',
        },
      }),
    ).toBe(2);
    expect(
      await command(
        'journal-delete-documents',
        { items: selected },
        undefined,
        maker,
        deleteKey,
      ),
    ).toEqual(deleted);
    await expect(
      command('document-import-run', { ...payload, saveMode: 'APPROVED' }),
    ).rejects.toThrow();
  });
  it('registers general documents from posted journals without posting financial effects twice', async () => {
    const year = await command<{ id: string }>('save-configuration', {
      kind: 'fiscal-years',
      code: '2000',
      title: 'Synthetic general document year',
    });
    const period = await command<{ id: string }>('save-period', {
      fiscalYearId: year.id,
      startDate: '2000-01-01',
      endDate: '2000-12-31',
    });
    const journalPayload = {
      periodId: period.id,
      typeId,
      documentDate: '2000-01-03',
      description: 'Synthetic general document basis',
      lines: [
        { accountId: debitId, debit: '25', credit: '0' },
        { accountId: creditId, debit: '0', credit: '25' },
      ],
    };
    let source = await command<AccountingJournalV1>(
      'journal-save',
      journalPayload,
    );
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
    source = await command<AccountingJournalV1>(
      'post',
      { id: source.id },
      source.version,
    );
    const input = {
      periodId: period.id,
      filter: 'date',
      fromDate: '2000-01-01',
      toDate: '2000-01-31',
      method: 'DAILY',
      separateYearEnd: false,
    };
    const preview = await command<{
      checksum: string;
      documents: {
        amount: string;
        lines: { accountId: string; debit: string; credit: string }[];
      }[];
    }>('general-document-preview', input);
    expect(preview.documents).toHaveLength(1);
    expect(preview.documents[0]?.amount).toBe('25');
    const effectsBefore = await db.accountingJournalLine.count({
      where: { journal: { bookId } },
    });
    const key = randomUUID();
    const result = await command<{
      documents: { id: string; number: number }[];
    }>(
      'general-document-issue',
      { ...input, checksum: preview.checksum },
      undefined,
      maker,
      key,
    );
    expect(result.documents[0]?.number).toBe(1);
    const listed = (await service.analyticalReport(
      bookId,
      'general-document-list',
      {
        periodId: period.id,
        filter: JSON.stringify({
          type: 'group',
          mode: 'all',
          children: [
            { type: 'rule', field: 'amount', operator: 'equals', value: '25' },
          ],
        }),
      },
      maker,
    )) as { total: number; rows: { amount: string; makerName: string }[] };
    expect(listed.total).toBe(1);
    expect(listed.rows[0]?.amount).toBe('25');
    expect(listed.rows[0]?.makerName).toBe('Synthetic accountant');
    const exported = (await service.analyticalReport(
      bookId,
      'general-document-list',
      { export: 'true', periodId: period.id, page: '999' },
      { ...maker, permissions: [...maker.permissions, 'finance.export'] },
    )) as { total: number; page: number; rows: { amount: string }[] };
    expect(exported.page).toBe(1);
    expect(exported.rows).toHaveLength(exported.total);
    expect(exported.rows[0]?.amount).toBe('25');
    for (const groupBy of ['number', 'documentDate', 'amount', 'makerId']) {
      const grouped = (await service.analyticalReport(
        bookId,
        'general-document-list',
        { periodId: period.id, groupBy, pageSize: '1' },
        maker,
      )) as { groups: { key: string; count: number; amount: string }[] };
      expect(grouped.groups).toHaveLength(1);
      expect(grouped.groups[0]?.count).toBe(1);
      expect(grouped.groups[0]?.amount).toBe('25');
      if (groupBy === 'amount') expect(grouped.groups[0]?.key).toBe('25');
    }
    await expect(
      service.analyticalReport(
        bookId,
        'general-document-list',
        { groupBy: '__proto__' },
        maker,
      ),
    ).rejects.toThrow();
    await expect(
      service.analyticalReport(
        bookId,
        'general-document-list',
        { export: 'true' },
        { ...maker, permissions: ['finance.read'] },
      ),
    ).rejects.toThrow();
    const absent = (await service.analyticalReport(
      bookId,
      'general-document-list',
      {
        periodId: period.id,
        filter: JSON.stringify({
          type: 'group',
          mode: 'none',
          children: [
            { type: 'rule', field: 'number', operator: 'equals', value: '1' },
          ],
        }),
      },
      maker,
    )) as { total: number };
    expect(absent.total).toBe(0);
    expect(
      await db.accountingJournalLine.count({ where: { journal: { bookId } } }),
    ).toBe(effectsBefore);
    expect(
      await command(
        'general-document-issue',
        { ...input, checksum: preview.checksum },
        undefined,
        maker,
        key,
      ),
    ).toEqual(result);
    expect(
      await db.accountingGeneralDocumentMember.count({ where: { bookId } }),
    ).toBe(1);
    await expect(
      db.accountingGeneralDocumentMember.delete({
        where: { journalId: source.id },
      }),
    ).rejects.toThrow('immutable');
    await expect(command('journal-save', journalPayload)).rejects.toThrow(
      'آخرین سند کل',
    );
    await expect(
      command('general-document-issue', {
        ...input,
        checksum: preview.checksum,
      }),
    ).rejects.toThrow();
    expect(
      await db.accountingGeneralDocument.count({ where: { bookId } }),
    ).toBe(1);
    const id = result.documents[0]!.id;
    await expect(
      command('general-document-date', { id, documentDate: '2000-01-02' }, 1),
    ).rejects.toThrow('بزرگترین تاریخ');
    const moved = await command<{ version: number }>(
      'general-document-date',
      { id, documentDate: '2000-01-04' },
      1,
    );
    expect(moved.version).toBe(2);
    await expect(
      command('general-document-date', { id, documentDate: '2000-01-04' }, 1),
    ).rejects.toThrow();
    const intervening = await command<AccountingJournalV1>('journal-save', {
      ...journalPayload,
      documentDate: '2000-01-05',
    });
    await expect(
      command(
        'general-document-date',
        { id, documentDate: '2000-01-06' },
        moved.version,
      ),
    ).rejects.toThrow('بین تاریخ');
    expect(
      (await db.accountingGeneralDocument.findUniqueOrThrow({ where: { id } }))
        .version,
    ).toBe(moved.version);
    await command('cancel', { id: intervening.id }, intervening.version);
  }, 60000);
  it('posts the complete reviewed interval atomically and rejects stale previews', async () => {
    const year = await command<{ id: string }>('save-configuration', {
      kind: 'fiscal-years',
      code: '2001',
      title: 'Synthetic posting year',
    });
    const period = await command<{ id: string }>('save-period', {
      fiscalYearId: year.id,
      startDate: '2001-01-01',
      endDate: '2001-12-31',
    });
    const header = {
      periodId: period.id,
      typeId,
      documentDate: '2001-01-05',
      description: '',
      lines: [
        {
          accountId: debitId,
          description: 'Synthetic debit',
          debit: '100',
          credit: '0',
        },
        {
          accountId: creditId,
          description: 'Synthetic credit',
          debit: '0',
          credit: '100',
        },
      ],
    };
    const first = await command<AccountingJournalV1>(
      'journal-document-save',
      header,
    );
    await expect(
      command('document-posting-preview', { toDate: '2001-01-05' }),
    ).rejects.toThrow('بررسی');
    const second = await command<AccountingJournalV1>(
      'journal-document-save',
      header,
    );
    for (const row of [first, second])
      await command('review-document', { id: row.id }, row.version, checker);
    type PostingPreview = {
      checksum: string;
      fromDate: string;
      rows: { id: string; version: number }[];
    };
    const preview = await command<PostingPreview>('document-posting-preview', {
      toDate: '2001-01-05',
    });
    expect(preview.fromDate).toBe('2001-01-01');
    expect(preview.rows).toHaveLength(2);
    const reviewedSecond = await db.accountingJournal.findUniqueOrThrow({
      where: { id: second.id },
    });
    const approvedAttributes = reviewedSecond.attributes as Record<
      string,
      string
    >;
    await db.accountingJournal.update({
      where: { id: second.id },
      data: {
        version: { increment: 1 },
        attributes: { ...approvedAttributes, approvalPolicyVersion: 'stale' },
      },
    });
    await expect(
      command('post-documents', {
        toDate: '2001-01-05',
        checksum: preview.checksum,
      }),
    ).rejects.toThrow('پیش‌نمایش');
    const changed = await command<PostingPreview>('document-posting-preview', {
      toDate: '2001-01-05',
    });
    await expect(
      command('post-documents', {
        toDate: '2001-01-05',
        checksum: changed.checksum,
      }),
    ).rejects.toThrow('قاعده تأیید');
    const unchanged = await db.accountingJournal.findMany({
      where: { id: { in: [first.id, second.id] } },
    });
    expect(unchanged.every((row) => row.status === 'APPROVED')).toBe(true);
    expect(
      await db.accountingJournalStateEvent.count({
        where: { journalId: { in: [first.id, second.id] }, toStatus: 'POSTED' },
      }),
    ).toBe(0);
    await db.accountingJournal.update({
      where: { id: second.id },
      data: { version: { increment: 1 }, attributes: approvedAttributes },
    });
    const ready = await command<PostingPreview>('document-posting-preview', {
      toDate: '2001-01-05',
    });
    const key = randomUUID();
    const payload = { toDate: '2001-01-05', checksum: ready.checksum };
    const result = await command<{ items: AccountingJournalV1[] }>(
      'post-documents',
      payload,
      undefined,
      maker,
      key,
    );
    expect(result.items.map((row) => row.status)).toEqual(['POSTED', 'POSTED']);
    expect(
      await command('post-documents', payload, undefined, maker, key),
    ).toEqual(result);
    await expect(command('journal-document-save', header)).rejects.toThrow(
      'قطعی',
    );
    for (const row of result.items)
      await expect(
        command('return', { id: row.id }, row.version, checker),
      ).rejects.toThrow();
  }, 60000);
  it('calculates document turnover from complete temporary records and excludes memorandum and legacy drafts', async () => {
    const parent = await db.accountingAccount.findUniqueOrThrow({
      where: { id: debitId },
    });
    const account = await command<{ id: string }>('save-account', {
      code: '11998801',
      title: 'Synthetic figures',
      level: 'SUBSIDIARY',
      nature: 'ANY',
      parentId: parent.parentId,
      attributes: { multiCurrency: true },
    });
    const header = {
      periodId,
      typeId,
      documentDate: '2026-01-05',
      description: '',
      lines: [
        {
          accountId: account.id,
          debit: '30',
          credit: '0',
          description: 'Synthetic debit',
        },
        {
          accountId: creditId,
          debit: '0',
          credit: '30',
          description: 'Synthetic credit',
        },
      ],
    };
    await command('journal-document-save', header);
    await command('journal-memorandum-save', {
      ...header,
      lines: [{ accountId: account.id, debit: '900', credit: '0' }],
    });
    await command('journal-save', {
      ...header,
      description: 'Incomplete legacy fixture',
      lines: [{ accountId: account.id, debit: '800', credit: '0' }],
    });
    const result = (await service.analyticalReport(
      bookId,
      'document-turnover',
      {
        accountId: account.id,
        periodId,
        level: '3',
      },
      maker,
    )) as {
      total: number;
      rows: { debit: string; balance: string }[];
      totals: { balance: string };
    };
    expect(result.total).toBe(1);
    expect(result.rows[0]?.debit).toBe('30');
    expect(result.rows[0]?.balance).toBe('30');
    expect(result.totals.balance).toBe('30');
    const fx = (await service.analyticalReport(
      bookId,
      'document-fx-balance',
      {
        accountId: account.id,
        level: '3',
      },
      maker,
    )) as {
      rows: {
        currency: string;
        debit: string;
        credit: string;
        balance: string;
      }[];
    };
    expect(fx.rows).toHaveLength(1);
    expect(fx.rows[0]).toMatchObject({
      currency: 'IRR',
      debit: '30',
      credit: '0',
      balance: '30',
    });
    await expect(
      service.analyticalReport(
        bookId,
        'document-turnover',
        { accountId: account.id, periodId: randomUUID(), level: '3' },
        maker,
      ),
    ).rejects.toThrow();
    await expect(
      service.analyticalReport(
        bookId,
        'document-turnover',
        { accountId: account.id, periodId, level: '4;DROP' },
        maker,
      ),
    ).rejects.toThrow();
  });
  it('deletes only unused base records with version, scope, permission and replay guards', async () => {
    const record = await command<{ id: string; version: number }>(
      'save-configuration',
      {
        kind: 'voucher-types',
        code: randomUUID(),
        title: 'Disposable toolbar fixture',
        active: true,
        attributes: {},
      },
    );
    const payload = { entity: 'configuration', id: record.id };
    await expect(
      command('delete-base-record', payload, record.version + 1),
    ).rejects.toThrow();
    await expect(
      command('delete-base-record', payload, record.version, {
        ...maker,
        permissions: ['finance.read', 'finance.journal.read'],
      }),
    ).rejects.toThrow();
    await expect(
      command('delete-base-record', payload, record.version, {
        ...maker,
        branchIds: [],
      }),
    ).rejects.toThrow();
    expect(
      await db.accountingConfiguration.count({ where: { id: record.id } }),
    ).toBe(1);
    const key = randomUUID();
    const deleted = await command(
      'delete-base-record',
      payload,
      record.version,
      maker,
      key,
    );
    expect(deleted).toMatchObject({ id: record.id, deleted: true });
    expect(
      await command('delete-base-record', payload, record.version, maker, key),
    ).toEqual(deleted);
    await expect(
      command('delete-base-record', payload, record.version, checker, key),
    ).rejects.toThrow();
    expect(
      await db.accountingConfiguration.count({ where: { id: record.id } }),
    ).toBe(0);
  });
  it('rejects deletion of FK-used and JSON-used records without losing financial data', async () => {
    const used = await db.accountingConfiguration.findUniqueOrThrow({
      where: { id: typeId },
    });
    // Add an explicit restrictive dependency independent of test execution order.
    const dependencyJournal = await draft();
    await expect(
      command(
        'delete-base-record',
        { entity: 'configuration', id: typeId },
        used.version,
      ),
    ).rejects.toThrow();
    const disposable = await command<{ id: string; version: number }>(
      'save-configuration',
      {
        kind: 'voucher-types',
        code: randomUUID(),
        title: 'JSON referenced fixture',
        active: true,
        attributes: {},
      },
    );
    await db.accountingConfiguration.create({
      data: {
        bookId,
        kind: 'toolbar-reference-test',
        code: randomUUID(),
        title: 'Reference fixture',
        attributes: { target: disposable.id },
      },
    });
    await expect(
      command(
        'delete-base-record',
        { entity: 'configuration', id: disposable.id },
        disposable.version,
      ),
    ).rejects.toThrow();
    expect(
      await db.accountingConfiguration.count({
        where: { id: { in: [typeId, disposable.id] } },
      }),
    ).toBe(2);
    await expect(
      command('delete-base-record', { entity: 'book', id: bookId }, 1),
    ).rejects.toThrow();
    expect(await db.accountingBook.count({ where: { id: bookId } })).toBe(1);
    await command(
      'cancel',
      { id: dependencyJournal.id },
      dependencyJournal.version,
    );
  });
  it('deletes unused accounts, details, groups and templates without deleting historical dependencies', async () => {
    const account = await db.accountingAccount.create({
      data: {
        bookId,
        code: randomUUID().slice(0, 20),
        title: 'Disposable account',
        level: 'GROUP',
        nature: 'DEBIT',
        attributes: {},
      },
    });
    const detailType = await db.accountingConfiguration.create({
      data: {
        bookId,
        kind: 'detail-types',
        code: randomUUID(),
        title: 'Disposable detail type',
        attributes: { classificationNumberLength: 4 },
      },
    });
    const detail = await db.accountingDetail.create({
      data: {
        bookId,
        typeId: detailType.id,
        code: randomUUID().slice(0, 20),
        title: 'Disposable detail',
        attributes: {},
      },
    });
    const accountGroup = await db.accountingAccountGroup.create({
      data: {
        bookId,
        code: randomUUID().slice(0, 20),
        title: 'Disposable account group',
      },
    });
    const detailGroup = await db.accountingDetailGroup.create({
      data: {
        bookId,
        code: randomUUID().slice(0, 20),
        title: 'Disposable detail group',
      },
    });
    const template = await db.accountingTemplate.create({
      data: {
        bookId,
        kind: 'AUTOMATIC',
        code: randomUUID().slice(0, 20),
        title: 'Disposable template',
      },
    });
    const allocation = await command<{ id: string; version: number }>(
      'save-configuration',
      {
        kind: 'allocation-templates',
        code: randomUUID(),
        title: 'Disposable allocation',
        active: true,
        attributes: {
          sourceAccountId: debitId,
          targets: JSON.stringify([{ accountId: creditId, percentage: '100' }]),
        },
      },
    );
    const mapping = await command<{ id: string; version: number }>(
      'save-configuration',
      {
        kind: 'account-mappings',
        code: randomUUID(),
        title: 'Disposable mapping',
        active: true,
        attributes: {
          effectiveFrom: '2026-01-01',
          reason: 'Synthetic fixture',
          rows: JSON.stringify([{ accountId: debitId, targetCode: 'X' }]),
        },
      },
    );
    for (const [entity, row] of [
      ['account', account],
      ['detail', detail],
      ['account-group', accountGroup],
      ['detail-group', detailGroup],
      ['template', template],
      ['configuration', allocation],
      ['configuration', mapping],
    ] as const) {
      await expect(
        command('delete-base-record', { entity, id: row.id }),
      ).rejects.toThrow();
      await expect(
        command('delete-base-record', { entity, id: row.id }, row.version),
      ).resolves.toMatchObject({ deleted: true, id: row.id });
    }
    expect(
      await db.accountingAccount.count({ where: { id: account.id } }),
    ).toBe(0);
    expect(await db.accountingDetail.count({ where: { id: detail.id } })).toBe(
      0,
    );
    expect(
      await db.accountingAccountGroup.count({ where: { id: accountGroup.id } }),
    ).toBe(0);
    expect(
      await db.accountingDetailGroup.count({ where: { id: detailGroup.id } }),
    ).toBe(0);
    expect(
      await db.accountingTemplate.count({ where: { id: template.id } }),
    ).toBe(0);
    const protectedTemplate = await db.accountingTemplate.create({
      data: {
        bookId,
        kind: 'AUTOMATIC',
        code: randomUUID().slice(0, 20),
        title: 'Historical template',
      },
    });
    const historical = await draft();
    const overlappingId = await db.accountingConfiguration.create({
      data: {
        id: historical.id,
        bookId,
        kind: 'voucher-types',
        code: randomUUID(),
        title: 'Overlapping UUID fixture',
        attributes: {},
      },
    });
    await db.accountingJournal.update({
      where: { id: historical.id },
      data: {
        attributes: {
          templateId: protectedTemplate.id.toUpperCase(),
          configurationReference: overlappingId.id,
        },
      },
    });
    await expect(
      command(
        'delete-base-record',
        { entity: 'template', id: protectedTemplate.id.toUpperCase() },
        protectedTemplate.version,
      ),
    ).rejects.toThrow();
    await expect(
      command(
        'delete-base-record',
        { entity: 'configuration', id: overlappingId.id },
        overlappingId.version,
      ),
    ).rejects.toThrow();
    await command('cancel', { id: historical.id }, historical.version);
    expect(
      (
        await service.journals(
          bookId,
          { id: historical.id, excludeCancelled: 'true' },
          maker,
        )
      ).total,
    ).toBe(0);
    expect(
      (
        await service.journals(
          bookId,
          { id: historical.id, status: 'CANCELLED', excludeCancelled: 'true' },
          maker,
        )
      ).total,
    ).toBe(1);
    expect(
      await db.accountingTemplate.count({
        where: { id: protectedTemplate.id },
      }),
    ).toBe(1);
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
  it('persists ledger form metadata with version and replay guards', async () => {
    const original = (await service.snapshot(bookId, maker)).book;
    const payload = {
      code: original.code,
      title: original.title,
      active: original.active,
      isMain: original.isMain,
      allowsPosting: original.allowsPosting,
      titleEn: 'General ledger',
      description: 'Synthetic ledger description',
      notes: 'Synthetic notes',
    };
    const key = randomUUID();
    const saved = await command(
      'save-book',
      payload,
      original.version,
      maker,
      key,
    );
    const snapshot = await service.snapshot(bookId, maker);
    expect(snapshot.book).toMatchObject({
      ...payload,
      version: original.version + 1,
    });
    expect(
      await command('save-book', payload, original.version, maker, key),
    ).toEqual(saved);
    await expect(
      command(
        'save-book',
        { ...payload, notes: 'Different notes' },
        original.version,
        maker,
        key,
      ),
    ).rejects.toThrow();
    await expect(
      command('save-book', payload, original.version),
    ).rejects.toThrow();
    // Older settings consumers omit the new optional fields; preserve them.
    await command(
      'save-book',
      {
        title: original.title,
        active: original.active,
        isMain: original.isMain,
        allowsPosting: original.allowsPosting,
      },
      snapshot.book.version,
    );
    expect((await service.snapshot(bookId, maker)).book.notes).toBe(
      payload.notes,
    );
  });

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
    await expect(
      command(
        'journal-save',
        {
          ...j,
          attributes: { ...j.attributes, lastModifierId: checkerId },
        },
        j.version,
      ),
    ).rejects.toThrow('ویژگی سیستمی');
    expect(
      (await db.accountingJournal.findUniqueOrThrow({ where: { id: j.id } }))
        .version,
    ).toBe(j.version);
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
