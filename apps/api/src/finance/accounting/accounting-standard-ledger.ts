import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import catalogs from './accounting-standard-catalogs.json';
import { DecimalValue } from '../finance.money';
import * as v from './accounting.validation';

type Tx = Prisma.TransactionClient;
type Config = Prisma.AccountingConfigurationGetPayload<object>;
const levels: Record<string, string> = {
  'گروه حساب': 'GROUP',
  'حساب کل': 'GENERAL',
  'حساب معین': 'SUBSIDIARY',
};

/** Metadata row IDs are local to a configuration, never global entity IDs. */
export async function syncStandardEntities(tx: Tx, config: Config) {
  const attributes = v.attributes(config.attributes);
  const rows = JSON.parse(String(attributes.entities || '[]')) as {
    id: string;
    title: string;
    titleEn: string;
    systemEntity: string;
    detailReference: string;
  }[];
  const old = await tx.accountingStandardEntity.findMany({
    where: { standardId: config.id, bookId: config.bookId },
    include: { _count: { select: { codes: true, mappings: true } } },
  });
  for (const entity of old) {
    const row = rows.find((item) => item.id === entity.rowId);
    if (!row) {
      if (entity._count.codes || entity._count.mappings)
        v.rule('موجودیت دارای کد یا نگاشت قابل حذف نیست.');
      await tx.accountingStandardEntity.delete({ where: { id: entity.id } });
    } else if (
      entity._count.mappings &&
      (row.systemEntity !== entity.systemEntity ||
        row.detailReference !== entity.detailReference)
    )
      v.rule('نوع موجودیت دارای نگاشت قابل تغییر نیست.');
  }
  for (const row of rows) {
    const data = {
      title: row.title,
      titleEn: row.titleEn,
      systemEntity: row.systemEntity,
      detailReference: row.detailReference,
      configVersion: config.version,
    };
    await tx.accountingStandardEntity.upsert({
      where: { standardId_rowId: { standardId: config.id, rowId: row.id } },
      create: {
        ...data,
        standardId: config.id,
        bookId: config.bookId,
        rowId: row.id,
      },
      update: { ...data, version: { increment: 1 } },
    });
  }
}

export async function seedStandardCatalogs(tx: Tx, bookId: string) {
  for (const catalog of catalogs) {
    const entities = catalog.entities.map((entity) => ({
      id: randomUUID(),
      title: entity.title,
      titleEn: entity.titleEn,
      systemEntity: entity.systemEntity,
      detailReference: 'STANDARD',
    }));
    const config = await tx.accountingConfiguration.create({
      data: {
        bookId,
        kind: 'coding-standards',
        code: `SYS-${catalog.key}`,
        title: catalog.title,
        titleEn: catalog.titleEn,
        attributes: {
          isSystem: true,
          catalogRevision: '20261111120000',
          protocolVersion: catalog.version,
          protocolTitle: catalog.protocolTitle,
          entities: JSON.stringify(entities),
          extraFields: '[]',
        },
      },
    });
    await syncStandardEntities(tx, config);
    for (let index = 0; index < entities.length; index++) {
      const entity = await tx.accountingStandardEntity.findUniqueOrThrow({
        where: {
          standardId_rowId: {
            standardId: config.id,
            rowId: entities[index]!.id,
          },
        },
      });
      await tx.accountingStandardCode.createMany({
        data: catalog.entities[index]!.codes.map((code, position) => ({
          bookId,
          entityId: entity.id,
          code: code.code,
          title: code.title,
          position,
        })),
      });
    }
  }
}

export async function copyStandardCodes(
  tx: Tx,
  config: Config,
  sourceId: unknown,
  sourceVersion: unknown,
) {
  const source = await tx.accountingConfiguration.findFirst({
    where: {
      id: v.uuid(sourceId)!,
      bookId: config.bookId,
      kind: 'coding-standards',
    },
  });
  if (!source) throw new NotFoundException();
  if (source.version !== sourceVersion)
    throw new ConflictException(
      'اطلاعات هم‌زمان تغییر کرده است؛ دوباره بارگذاری کنید.',
    );
  const targets = await tx.accountingStandardEntity.findMany({
    where: { standardId: config.id },
  });
  const sources = await tx.accountingStandardEntity.findMany({
    where: { standardId: source.id },
    include: { codes: true },
  });
  for (const target of targets) {
    const original = sources.find((entity) => entity.rowId === target.rowId);
    if (!original) continue;
    if (
      original.systemEntity !== target.systemEntity ||
      original.detailReference !== target.detailReference
    )
      v.rule('نوع موجودیت کپی با منبع سازگار نیست.');
    await tx.accountingStandardCode.createMany({
      data: original.codes.map((code) => ({
        bookId: config.bookId,
        entityId: target.id,
        code: code.code,
        title: code.title,
        titleEn: code.titleEn,
        position: code.position,
      })),
    });
  }
}

async function standard(tx: Tx, bookId: string, id: unknown) {
  const row = await tx.accountingConfiguration.findFirst({
    where: {
      id: v.uuid(id)!,
      bookId,
      kind: 'coding-standards',
      active: true,
    },
  });
  if (!row) throw new NotFoundException();
  return row;
}

function checkProjection(
  config: Config,
  entities: Prisma.AccountingStandardEntityGetPayload<object>[],
) {
  let rows: unknown;
  try {
    rows = JSON.parse(String(v.attributes(config.attributes).entities || '[]'));
  } catch {
    v.rule('اطلاعات موجودیت استاندارد نیاز به بازبینی دارد.');
  }
  if (
    !Array.isArray(rows) ||
    rows.length !== entities.length ||
    new Set(rows.map((row: Record<string, unknown>) => row?.id)).size !==
      rows.length
  )
    v.rule('اطلاعات موجودیت استاندارد نیاز به بازبینی دارد.');
  for (const entity of entities) {
    const row = rows.find(
      (item: Record<string, unknown>) =>
        typeof item?.id === 'string' && item.id.toLowerCase() === entity.rowId,
    ) as Record<string, unknown> | undefined;
    if (
      !row ||
      entity.configVersion !== config.version ||
      row.title !== entity.title ||
      String(row.titleEn || '') !== entity.titleEn ||
      String(row.systemEntity || '') !== entity.systemEntity ||
      row.detailReference !== entity.detailReference
    )
      v.rule('اطلاعات موجودیت استاندارد نیاز به بازبینی دارد.');
  }
}

/** Called only inside AccountingService's authorized, serialized/audited command. */
export async function standardCommand(
  tx: Tx,
  bookId: string,
  action: string,
  p: Record<string, unknown>,
  expected: number | undefined,
) {
  const entity = await tx.accountingStandardEntity.findFirst({
    where: { id: v.uuid(p.entityId)!, bookId },
    include: { standard: true },
  });
  if (
    !entity ||
    entity.standard.kind !== 'coding-standards' ||
    !entity.standard.active
  )
    throw new NotFoundException();
  if (
    entity.configVersion !== entity.standard.version ||
    entity.version !== expected
  )
    throw new ConflictException(
      'اطلاعات هم‌زمان تغییر کرده است؛ دوباره بارگذاری کنید.',
    );
  const codeId = v.uuid(p.codeId, action === 'standard-code-save');
  const code = codeId
    ? await tx.accountingStandardCode.findFirst({
        where: { id: codeId, entityId: entity.id, bookId },
      })
    : null;
  if (codeId && !code) throw new NotFoundException();
  let changes: unknown;
  if (action === 'standard-code-save' || action === 'standard-code-delete') {
    if (v.attributes(entity.standard.attributes).isSystem === true)
      v.rule('استاندارد پیش‌فرض قابل تغییر نیست.');
    if (action === 'standard-code-delete') {
      if (!code) throw new NotFoundException();
      if (
        await tx.accountingStandardMapping.count({
          where: { codeId: code.id, bookId },
        })
      )
        v.rule('کد دارای نگاشت قابل حذف نیست.');
      await tx.accountingStandardCode.delete({ where: { id: code.id } });
      changes = { deleted: code };
    } else {
      const data = {
        code: v.text(p.code, 40, true),
        title: v.text(p.title, 160, true),
        titleEn: v.text(p.titleEn, 160) || null,
      };
      if (
        await tx.accountingStandardCode.findFirst({
          where: {
            entityId: entity.id,
            code: data.code,
            ...(code ? { id: { not: code.id } } : {}),
          },
        })
      )
        v.rule('کد استاندارد تکراری است.');
      changes = code
        ? await tx.accountingStandardCode.update({
            where: { id: code.id },
            data,
          })
        : await tx.accountingStandardCode.create({
            data: { ...data, bookId, entityId: entity.id },
          });
    }
  } else {
    const level = levels[entity.systemEntity];
    if (!level) v.rule('نگاشت برای این نوع موجودیت هنوز فعال نشده است.');
    if (!code) throw new NotFoundException();
    if (
      !Array.isArray(p.accountIds) ||
      p.accountIds.length < 1 ||
      p.accountIds.length > 500
    )
      v.invalid('یک تا پانصد حساب انتخاب کنید.');
    const ids = p.accountIds.map((id) => v.uuid(id)!);
    if (new Set(ids).size !== ids.length)
      v.invalid('حساب تکراری انتخاب شده است.');
    const accounts = await tx.accountingAccount.findMany({
      where: { id: { in: ids }, bookId, level },
      select: { id: true, code: true, title: true },
    });
    if (accounts.length !== ids.length)
      v.rule('حساب متعلق به همین دفتر و سطح موجودیت انتخاب کنید.');
    if (action === 'standard-map') {
      if (
        await tx.accountingStandardMapping.count({
          where: { entityId: entity.id, accountId: { in: ids } },
        })
      )
        v.rule('حساب قبلاً نگاشت شده است؛ ابتدا نگاشت قبلی را بردارید.');
      await tx.accountingStandardMapping.createMany({
        data: ids.map((accountId) => ({
          bookId,
          entityId: entity.id,
          codeId: code.id,
          accountId,
        })),
      });
    } else if (action === 'standard-unmap') {
      if (
        (await tx.accountingStandardMapping.count({
          where: {
            entityId: entity.id,
            codeId: code.id,
            accountId: { in: ids },
          },
        })) !== ids.length
      )
        v.rule('نگاشت انتخاب‌شده هم‌زمان تغییر کرده است.');
      await tx.accountingStandardMapping.deleteMany({
        where: { entityId: entity.id, codeId: code.id, accountId: { in: ids } },
      });
    } else v.invalid('عملیات کدینگ استاندارد معتبر نیست.');
    changes = { code, accounts };
  }
  const updated = await tx.accountingStandardEntity.update({
    where: { id: entity.id },
    data: { version: { increment: 1 } },
  });
  return {
    entityId: entity.id,
    standardId: entity.standardId,
    version: updated.version,
    action,
    changes,
  };
}

/** Read-only reference catalogue + independently paged candidate/mapped panels. */
export async function standardMapping(
  tx: Tx,
  bookId: string,
  query: Record<string, string>,
) {
  if (
    Object.keys(query).some(
      (key) =>
        ![
          'standardId',
          'entityId',
          'codeId',
          'search',
          'page',
          'mappedPage',
        ].includes(key),
    )
  )
    v.invalid('فیلتر گزارش معتبر نیست.');
  const config = await standard(tx, bookId, query.standardId);
  const entities = await tx.accountingStandardEntity.findMany({
    where: { standardId: config.id, bookId },
    orderBy: { id: 'asc' },
  });
  checkProjection(config, entities);
  const entity = query.entityId
    ? entities.find((item) => item.id === v.uuid(query.entityId))
    : undefined;
  if (query.entityId && !entity) throw new NotFoundException();
  const codes = entity
    ? await tx.accountingStandardCode.findMany({
        where: { entityId: entity.id, bookId },
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
        take: 10001,
      })
    : [];
  if (codes.length > 10000) v.rule('تعداد کدها از سقف گزارش بیشتر است.');
  const selected = query.codeId
    ? codes.find((code) => code.id === v.uuid(query.codeId))
    : undefined;
  if (query.codeId && !selected) throw new NotFoundException();
  const page = (input: unknown) => {
    const n = Number(input || '1');
    if (!Number.isSafeInteger(n) || n < 1 || n > 200000)
      v.invalid('صفحه معتبر نیست.');
    return n;
  };
  const current = page(query.page),
    mappedPage = page(query.mappedPage);
  const supported = !!entity && !!levels[entity.systemEntity];
  if (!entity || !supported || !selected)
    return {
      standard: config,
      entities,
      entity: entity ?? null,
      codes,
      supported,
      unmapped: [],
      mapped: [],
      total: 0,
      mappedTotal: 0,
      page: current,
      mappedPage,
      pageSize: 50,
    };
  const search = v.text(query.search, 160);
  const base: Prisma.AccountingAccountWhereInput = {
    bookId,
    level: levels[entity.systemEntity]!,
    ...(search
      ? {
          OR: [
            { code: { contains: search } },
            { title: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const unmapped = {
    ...base,
    standardMappings: { none: { entityId: entity.id } },
  };
  const mapped = {
    ...base,
    standardMappings: { some: { entityId: entity.id, codeId: selected.id } },
  };
  const select = { id: true, code: true, title: true, active: true };
  return {
    standard: config,
    entities,
    entity,
    codes,
    supported,
    page: current,
    mappedPage,
    pageSize: 50,
    unmapped: await tx.accountingAccount.findMany({
      where: unmapped,
      select,
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
      take: 50,
      skip: (current - 1) * 50,
    }),
    mapped: await tx.accountingAccount.findMany({
      where: mapped,
      select,
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
      take: 50,
      skip: (mappedPage - 1) * 50,
    }),
    total: await tx.accountingAccount.count({ where: unmapped }),
    mappedTotal: await tx.accountingAccount.count({ where: mapped }),
  };
}

/** One tuple per line's ancestors: multiple standard entities must never multiply turnover. */
export async function standardTurnover(
  tx: Tx,
  bookId: string,
  query: Record<string, string>,
) {
  if (
    Object.keys(query).some(
      (key) =>
        ![
          'standardId',
          'periodId',
          'toPeriodId',
          'from',
          'to',
          'typeId',
        ].includes(key),
    )
  )
    v.invalid('فیلتر گزارش معتبر نیست.');
  const config = await standard(tx, bookId, query.standardId);
  const first = await tx.accountingPeriod.findFirst({
    where: { id: v.uuid(query.periodId)!, bookId },
  });
  const last = query.toPeriodId
    ? await tx.accountingPeriod.findFirst({
        where: { id: v.uuid(query.toPeriodId)!, bookId },
      })
    : first;
  if (!first || !last) throw new NotFoundException();
  if (last.startDate < first.startDate) v.invalid('بازه دوره مالی معتبر نیست.');
  const from = v.date(query.from || first.startDate)!,
    to = v.date(query.to || last.endDate)!;
  if (from < first.startDate || to > last.endDate || from > to)
    v.invalid('بازه تاریخ معتبر نیست.');
  const periods = await tx.accountingPeriod.findMany({
    where: {
      bookId,
      startDate: { gte: first.startDate },
      endDate: { lte: last.endDate },
    },
    select: { id: true },
  });
  const typeId = v.uuid(query.typeId, true);
  if (
    typeId &&
    !(await tx.accountingConfiguration.findFirst({
      where: { id: typeId, bookId, kind: 'voucher-types' },
    }))
  )
    throw new NotFoundException();
  const entities = await tx.accountingStandardEntity.findMany({
    where: { standardId: config.id, bookId },
    orderBy: { rowId: 'asc' },
    include: { mappings: { include: { code: true } } },
  });
  checkProjection(config, entities);
  if (
    !entities.length ||
    entities.some(
      (entity) =>
        !levels[entity.systemEntity] || entity.configVersion !== config.version,
    )
  )
    v.rule('موجودیت استاندارد قرارداد گزارش قابل اجرا ندارد.');
  const accounts = await tx.accountingAccount.findMany({
    where: { bookId },
    select: { id: true, parentId: true, level: true },
    take: 10001,
  });
  if (accounts.length > 10000) v.rule('تعداد حساب‌ها از سقف گزارش بیشتر است.');
  const totals = await tx.accountingJournalLine.groupBy({
    by: ['accountId'],
    where: {
      journal: {
        bookId,
        status: 'POSTED',
        periodId: { in: periods.map((period) => period.id) },
        documentDate: { gte: from, lte: to },
        ...(typeId ? { typeId } : {}),
      },
    },
    _sum: { debit: true, credit: true },
    _count: { _all: true },
  });
  const chart = new Map(accounts.map((account) => [account.id, account]));
  const indexes = entities.map(
    (entity) =>
      new Map(
        entity.mappings.map((mapping) => [mapping.accountId, mapping.code]),
      ),
  );
  const groups = new Map<
    string,
    {
      codes: ({ code: string; title: string } | null)[];
      debit: DecimalValue;
      credit: DecimalValue;
      lines: number;
      unmapped: boolean;
    }
  >();
  for (const total of totals) {
    const ancestors = new Map<string, string>(),
      visited = new Set<string>();
    let id: string | null = total.accountId;
    while (id) {
      if (visited.has(id)) v.rule('ساختار حساب دارای چرخه است.');
      visited.add(id);
      const account = chart.get(id);
      if (!account) v.rule('ساختار حساب گزارش کامل نیست.');
      ancestors.set(account.level, account.id);
      id = account.parentId;
    }
    const codes = entities.map((entity, index) => {
      const code = indexes[index]!.get(
        ancestors.get(levels[entity.systemEntity]!) || '',
      );
      return code ? { code: code.code, title: code.title } : null;
    });
    const key = JSON.stringify(codes.map((code) => code?.code ?? null));
    const group = groups.get(key) ?? {
      codes,
      debit: DecimalValue.zero(),
      credit: DecimalValue.zero(),
      lines: 0,
      unmapped: codes.some((code) => !code),
    };
    group.debit = group.debit.add(
      DecimalValue.parse(total._sum.debit?.toFixed() || '0'),
    );
    group.credit = group.credit.add(
      DecimalValue.parse(total._sum.credit?.toFixed() || '0'),
    );
    group.lines += total._count._all;
    groups.set(key, group);
  }
  const rows = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, row]) => ({
      key,
      ...row,
      debit: row.debit.toString(),
      credit: row.credit.toString(),
      balance: row.debit.subtract(row.credit).toString(),
    }));
  return {
    standard: config,
    from,
    to,
    periodId: first.id,
    toPeriodId: last.id,
    basis: 'INTERNAL_POSTED_TURNOVER',
    entities: entities.map(({ id, title, titleEn, version }) => ({
      id,
      title,
      titleEn,
      version,
    })),
    rows,
    debit: rows
      .reduce(
        (sum, row) => sum.add(DecimalValue.parse(row.debit)),
        DecimalValue.zero(),
      )
      .toString(),
    credit: rows
      .reduce(
        (sum, row) => sum.add(DecimalValue.parse(row.credit)),
        DecimalValue.zero(),
      )
      .toString(),
    unmappedLines: rows
      .filter((row) => row.unmapped)
      .reduce((count, row) => count + row.lines, 0),
  };
}
