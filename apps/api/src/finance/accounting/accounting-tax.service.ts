import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@nora/database';
import type {
  AccountingTaxRecord,
  AccountingTaxValues,
  AuthenticatedActor,
} from '@nora/contracts';
import { DatabaseService } from '../../database/database.service';
import { IamFinanceDirectory } from '../../iam/iam-finance-directory';
import { setupNotes } from './accounting.setup-notes';
import { taxForm, taxValues } from './accounting-tax.validation';
import * as v from './accounting.validation';

const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, canonical(item)]),
        )
      : value;
const dto = (row: {
  id: string;
  kind: string;
  title: string;
  attributes: unknown;
  version: number;
}): AccountingTaxRecord => ({
  id: row.id,
  kind: row.kind.replace(/^vat-/, ''),
  title: row.title,
  values: row.attributes as AccountingTaxValues,
  version: row.version,
});

@Injectable()
export class AccountingTaxService {
  async remove(
    bookId: string,
    kind: string,
    id: string,
    input: unknown,
    actor: AuthenticatedActor,
  ) {
    taxForm(kind);
    v.uuid(id);
    const body = v.object(input);
    if (Object.keys(body).some((key) => !['version', 'key'].includes(key)))
      v.invalid('درخواست حذف معتبر نیست.');
    const key = v.uuid(body.key)!;
    if (!Number.isInteger(body.version) || Number(body.version) < 1)
      v.invalid('نسخه رکورد معتبر نیست.');
    const hash = createHash('sha256')
      .update(
        JSON.stringify({ kind, id, version: body.version, action: 'delete' }),
      )
      .digest('hex');
    return this.database.client.$transaction(
      async (tx) => {
        await this.book(tx, bookId, actor, true);
        const prior = await tx.accountingCommand.findUnique({
          where: { bookId_key: { bookId, key } },
        });
        if (prior) {
          if (prior.hash !== hash || prior.actorId !== actor.userId)
            throw new ConflictException('کلید درخواست قبلاً استفاده شده است.');
          return { id, deleted: true };
        }
        const row = await tx.accountingConfiguration.findFirst({
          where: { id, bookId, kind: `vat-${kind}` },
        });
        if (!row) throw new NotFoundException('رکورد مالیاتی پیدا نشد.');
        if (row.version !== body.version)
          throw new ConflictException(
            'رکورد تغییر کرده است؛ دوباره بارگذاری کنید.',
          );
        if (
          kind === 'aggregation' &&
          (await tx.accountingConfiguration.findFirst({
            where: {
              bookId,
              kind: 'vat-periods',
              attributes: { path: ['sltMergePattern_Input'], equals: id },
            },
          }))
        )
          v.rule('این روش تجمیع در دوره مالیاتی استفاده شده است.');
        const removed = await tx.accountingConfiguration.deleteMany({
          where: { id, bookId, kind: `vat-${kind}`, version: row.version },
        });
        if (removed.count !== 1)
          throw new ConflictException('رکورد تغییر کرده است.');
        await tx.accountingCommand.create({
          data: {
            bookId,
            actorId: actor.userId,
            key,
            hash,
            action: `vat-${kind}-delete`,
            result: json({ deleted: true, record: dto(row) }),
          },
        });
        return { id, deleted: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(IamFinanceDirectory) private readonly identity: IamFinanceDirectory,
  ) {}

  private async book(
    tx: Prisma.TransactionClient,
    bookId: string,
    actor: AuthenticatedActor,
    write = false,
  ) {
    if (
      !actor.permissions.includes('finance.read') ||
      !actor.permissions.includes(
        write ? 'finance.account.manage' : 'finance.journal.read',
      )
    )
      throw new ForbiddenException();
    v.uuid(bookId);
    const book = await tx.accountingBook.findFirst({
      where: { id: bookId, branchId: { in: actor.branchIds } },
    });
    if (!book) throw new NotFoundException('دفتر حسابداری پیدا نشد.');
    return book;
  }

  async list(bookId: string, kind: string, actor: AuthenticatedActor) {
    taxForm(kind);
    await this.book(this.database.client, bookId, actor);
    const rows = await this.database.client.accountingConfiguration.findMany({
      where: { bookId, kind: `vat-${kind}` },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    });
    const total = await this.database.client.accountingConfiguration.count({
      where: { bookId, kind: `vat-${kind}` },
    });
    return { items: rows.map(dto), truncated: total > rows.length };
  }

  async save(
    bookId: string,
    kind: string,
    input: unknown,
    actor: AuthenticatedActor,
  ) {
    taxForm(kind);
    const body = v.object(input);
    if (
      Object.keys(body).some(
        (key) => !['id', 'version', 'key', 'values', 'notes'].includes(key),
      )
    )
      v.invalid('درخواست مالیاتی معتبر نیست.');
    const id = v.uuid(body.id, true);
    const key = v.uuid(body.key)!;
    const values = taxValues(kind, body.values);
    if (id && (!Number.isInteger(body.version) || Number(body.version) < 1))
      v.invalid('نسخه رکورد معتبر نیست.');
    const hash = createHash('sha256')
      .update(
        JSON.stringify(
          canonical({
            kind,
            id,
            version: body.version,
            values,
            notes: body.notes,
          }),
        ),
      )
      .digest('hex');
    try {
      return await this.database.client.$transaction(
        async (tx) => {
          const book = await this.book(tx, bookId, actor, true);
          const prior = await tx.accountingCommand.findUnique({
            where: { bookId_key: { bookId, key } },
          });
          if (prior) {
            if (prior.hash !== hash || prior.actorId !== actor.userId)
              throw new ConflictException(
                'کلید درخواست قبلاً برای عملیات دیگری استفاده شده است.',
              );
            return prior.result as unknown as AccountingTaxRecord;
          }
          const existing = id
            ? await tx.accountingConfiguration.findFirst({
                where: { id, bookId, kind: `vat-${kind}` },
              })
            : null;
          if (id && !existing)
            throw new NotFoundException('رکورد مالیاتی پیدا نشد.');
          if (existing && existing.version !== body.version)
            throw new ConflictException(
              'رکورد تغییر کرده است؛ دوباره بارگذاری کنید.',
            );
          if (kind === 'periods' && values.sltMergePattern_Input) {
            const pattern = await tx.accountingConfiguration.findFirst({
              where: {
                id: String(values.sltMergePattern_Input),
                bookId,
                kind: 'vat-aggregation',
                active: true,
              },
            });
            if (!pattern) v.invalid('روش تجمیع باید متعلق به همین دفتر باشد.');
          }
          const name =
            (
              await this.identity.displayNames([actor.userId], [book.branchId])
            )[0]?.displayName ?? actor.userId;
          const old = existing?.attributes as AccountingTaxValues | undefined;
          const notes = setupNotes(body.notes, old?.notes, name);
          if (notes.some((note) => !note.text.trim()))
            v.invalid('متن یادداشت را وارد کنید.');
          const attributes = { ...values, notes: JSON.stringify(notes) };
          const recordId = id ?? randomUUID();
          const data = {
            title: String(values.txtTitle),
            attributes: json(attributes),
          };
          if (existing) {
            const changed = await tx.accountingConfiguration.updateMany({
              where: {
                id: recordId,
                bookId,
                kind: `vat-${kind}`,
                version: existing.version,
              },
              data: { ...data, version: { increment: 1 } },
            });
            if (changed.count !== 1)
              throw new ConflictException('رکورد تغییر کرده است.');
          } else
            await tx.accountingConfiguration.create({
              data: {
                id: recordId,
                bookId,
                kind: `vat-${kind}`,
                code: `VAT-${recordId.slice(0, 32)}`,
                ...data,
              },
            });
          const saved = await tx.accountingConfiguration.findUniqueOrThrow({
            where: { id: recordId },
          });
          const result = dto(saved);
          await tx.accountingCommand.create({
            data: {
              bookId,
              actorId: actor.userId,
              key,
              hash,
              action: `vat-${kind}-save`,
              result: json(result),
            },
          });
          return result;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code)
      )
        throw new ConflictException(
          'درخواست هم‌زمان ثبت شد؛ با همان کلید دوباره تلاش کنید.',
        );
      throw error;
    }
  }
}
