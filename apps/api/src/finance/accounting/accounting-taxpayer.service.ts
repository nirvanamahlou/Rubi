import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import type { AccountingTaxpayerSeller } from '@nora/contracts';
import type {
  TaxpayerDraftKind,
  AccountingTaxpayerDraft,
} from '@nora/contracts';
import { taxpayerDraftColumns, taxpayerPages } from '@nora/contracts';
import { draftKind, taxpayerDraftValues } from './accounting.taxpayer-draft';
import {
  TaxpayerSecretVault,
  taxpayerSecretInputs,
  validateTaxpayerSecrets,
} from './accounting.taxpayer-vault';

const draftPublicValues = (kind: TaxpayerDraftKind, input: unknown) => {
  const raw = v.object(input);
  const page = taxpayerPages.find(
    (p) =>
      p.route ===
      (kind === 'settings'
        ? 'taxpayer-system/settings'
        : kind === 'cancellations'
          ? 'taxpayer-system/cancellation-invoice'
          : 'taxpayer-system/operations/batch-schedules'),
  )!;
  return taxpayerDraftValues(
    kind,
    Object.fromEntries(
      page.fields
        .filter((f) => !f.sensitive && Object.hasOwn(raw, f.id))
        .map((f) => [f.id, raw[f.id]]),
    ),
  );
};
const storedSecretFields = (input: unknown): string[] => {
  const fields = v.object(input).__secretFieldIds;
  return Array.isArray(fields)
    ? fields.filter(
        (value): value is string =>
          typeof value === 'string' &&
          taxpayerPages[0]!.fields.some((f) => f.sensitive && f.id === value),
      )
    : [];
};
import { DatabaseService } from '../../database/database.service';
import * as v from './accounting.validation';
const kind = 'taxpayer-seller';
const code = 'TAXPAYER-SELLER';
const keys = [
  'fvwMain_lkpPartyType_ComboBox_Input',
  'fvwMain_txtNationalID',
  'fvwMain_txtEconomicID',
  'fvwMain_txtCivilParticipationID',
] as const;
export function taxpayerSellerValues(
  input: unknown,
): AccountingTaxpayerSeller['values'] {
  const body = v.object(input);
  if (Object.keys(body).some((k) => !keys.includes(k as (typeof keys)[number])))
    v.invalid('فیلد فروشنده معتبر نیست.');
  const type = v.text(body[keys[0]], 30, true);
  if (!['شخص', 'شرکت', 'مشارکت مدنی'].includes(type!))
    v.invalid('نوع فروشنده معتبر نیست.');
  const values = {
    fvwMain_lkpPartyType_ComboBox_Input:
      type as AccountingTaxpayerSeller['values']['fvwMain_lkpPartyType_ComboBox_Input'],
    fvwMain_txtNationalID: v.text(body[keys[1]], 100) ?? '',
    fvwMain_txtEconomicID: v.text(body[keys[2]], 100) ?? '',
    fvwMain_txtCivilParticipationID: v.text(body[keys[3]], 100) ?? '',
  };
  if (type === 'مشارکت مدنی' && values.fvwMain_txtNationalID)
    v.invalid('کد ملی در حالت مشارکت مدنی غیرفعال است.');
  if (type !== 'مشارکت مدنی' && values.fvwMain_txtCivilParticipationID)
    v.invalid('شناسه مشارکت مدنی فقط برای مشارکت مدنی مجاز است.');
  return values;
}
function dto(row: {
  version: number;
  attributes: unknown;
}): AccountingTaxpayerSeller {
  return { version: row.version, values: taxpayerSellerValues(row.attributes) };
}
@Injectable()
export class AccountingTaxpayerService {
  private readonly vault = new TaxpayerSecretVault();
  async drafts(
    bookId: string,
    kindText: string,
    query: Record<string, unknown>,
    actor: AuthenticatedActor,
  ) {
    const kind = draftKind(kindText);
    if (
      Object.keys(query).some((key) => !['page', 'id', 'filters'].includes(key))
    )
      v.invalid('فیلتر پیش‌نویس معتبر نیست.');
    const page = Number(query.page ?? 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 200000)
      v.invalid('صفحه معتبر نیست.');
    return this.database.client.$transaction(
      async (tx) => {
        await this.scope(tx, bookId, actor);
        const where: Prisma.AccountingConfigurationWhereInput = {
          bookId,
          ...(kind === 'settings'
            ? {
                OR: [
                  { kind: 'taxpayer-draft-settings', active: true },
                  { kind: 'tax-settings' },
                ],
              }
            : { kind: `taxpayer-draft-${kind}`, active: true }),
          ...(query.id ? { id: v.uuid(query.id)! } : {}),
        };
        if (query.filters) {
          if (typeof query.filters !== 'string' || query.filters.length > 12000)
            v.invalid('فیلتر پیش‌نویس معتبر نیست.');
          let filters: Record<string, unknown>;
          try {
            filters = v.object(JSON.parse(query.filters));
          } catch {
            v.invalid('فیلتر پیش‌نویس معتبر نیست.');
          }
          const route =
            kind === 'schedules'
              ? 'taxpayer-system/lists/batch-schedules'
              : `taxpayer-system/lists/${kind}`;
          const columns = taxpayerPages.find((p) => p.route === route)!.columns;
          const clauses: Prisma.AccountingConfigurationWhereInput[] = [];
          for (const [label, value] of Object.entries(filters)) {
            if (!columns.includes(label)) v.invalid('ستون فیلتر معتبر نیست.');
            const text = v.text(value, 160);
            if (!text) continue;
            if (label === 'وضعیت') {
              if (!'پیش‌نویس'.includes(text)) clauses.push({ id: { in: [] } });
            } else if (label === 'عنوان')
              clauses.push({ title: { contains: text, mode: 'insensitive' } });
            else {
              const key = taxpayerDraftColumns[kind][label];
              clauses.push(
                key
                  ? { attributes: { path: [key], string_contains: text } }
                  : { id: { in: [] } },
              );
            }
          }
          where.AND = clauses;
        }
        const rows = await tx.accountingConfiguration.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: 50,
          skip: (page - 1) * 50,
        });
        return {
          items: rows.map((row): AccountingTaxpayerDraft => ({
            id: row.id,
            version: row.version,
            kind,
            status: 'DRAFT',
            values:
              row.kind === 'tax-settings'
                ? { txtTitle: row.title, lkpSendingType_ComboBox_Input: '' }
                : draftPublicValues(kind, row.attributes),
            ...(storedSecretFields(row.attributes).length
              ? { storedSecretFields: storedSecretFields(row.attributes) }
              : {}),
            ...(row.kind === 'tax-settings' ? { legacyRequest: true } : {}),
            externalConnection: false,
            externalAcceptance: false,
            createdAt: row.createdAt.toISOString(),
          })),
          total: await tx.accountingConfiguration.count({ where }),
          page,
          pageSize: 50,
          secretStorageAvailable: this.vault.available,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async saveDraft(
    bookId: string,
    kindText: string,
    input: unknown,
    actor: AuthenticatedActor,
  ) {
    bookId = v.uuid(bookId)!.toLowerCase();
    const kind = draftKind(kindText),
      body = v.object(input);
    if (
      Object.keys(body).some(
        (key) => !['id', 'version', 'key', 'values'].includes(key),
      )
    )
      v.invalid('درخواست پیش‌نویس معتبر نیست.');
    const id = v.uuid(body.id, true)?.toLowerCase() ?? null,
      key = v.uuid(body.key)!.toLowerCase();
    if (
      !Number.isSafeInteger(body.version) ||
      Number(body.version) < 0 ||
      (!!id && Number(body.version) < 1)
    )
      v.invalid('نسخه پیش‌نویس معتبر نیست.');
    return this.database.client.$transaction(
      async (tx) => {
        await this.scope(tx, bookId, actor, true);
        const inputs =
          kind === 'settings' ? taxpayerSecretInputs(body.values) : {};
        const secretDigest = this.vault.fingerprint(inputs, bookId);
        const values = taxpayerDraftValues(
          kind,
          body.values,
          this.vault.available,
        );
        const hash = createHash('sha256')
          .update(
            JSON.stringify({
              kind,
              id,
              version: body.version,
              secretDigest,
              values: Object.fromEntries(
                Object.entries(values).sort(([a], [b]) => a.localeCompare(b)),
              ),
            }),
          )
          .digest('hex');

        await tx.$queryRaw`SELECT id FROM accounting_books WHERE id=${bookId}::uuid FOR UPDATE`;
        const prior = await tx.accountingCommand.findUnique({
          where: { bookId_key: { bookId, key } },
        });
        if (prior) {
          if (prior.hash !== hash || prior.actorId !== actor.userId)
            throw new ConflictException('کلید درخواست قبلاً استفاده شده است.');
          return prior.result as unknown as AccountingTaxpayerDraft;
        }
        const current = id
          ? await tx.accountingConfiguration.findFirst({
              where: {
                id,
                bookId,
                kind: `taxpayer-draft-${kind}`,
                active: true,
              },
            })
          : null;
        if (id && !current) throw new NotFoundException('پیش‌نویس پیدا نشد.');
        if ((current?.version ?? 0) !== body.version)
          throw new ConflictException(
            'پیش‌نویس تغییر کرده است؛ دوباره بارگذاری کنید.',
          );
        if (kind === 'cancellations') {
          const reference = String(values.txtUniqueBillNumberRef);
          if (
            current &&
            v.object(current.attributes).txtUniqueBillNumberRef !== reference
          )
            v.rule('مرجع پیش‌نویس ابطال قابل تغییر نیست.');
          if (
            await tx.accountingConfiguration.findFirst({
              where: {
                bookId,
                kind: 'taxpayer-draft-cancellations',
                active: true,
                ...(id ? { id: { not: id } } : {}),
                attributes: {
                  path: ['txtUniqueBillNumberRef'],
                  equals: reference,
                },
              },
            })
          )
            throw new ConflictException(
              'برای این مرجع پیش‌نویس ابطال موجود است.',
            );
        }
        const recordId = id ?? randomUUID();
        const currentAttributes = current ? v.object(current.attributes) : {};
        const sameMode =
          currentAttributes.lkpSendingType_ComboBox_Input ===
          values.lkpSendingType_ComboBox_Input;
        let envelope = sameMode ? currentAttributes.__sealedSecrets : undefined;
        let fields = sameMode ? storedSecretFields(currentAttributes) : [];
        if (Object.keys(inputs).length) {
          const secrets = {
            ...(envelope
              ? this.vault.open(envelope, `${bookId}:${recordId}`)
              : {}),
            ...inputs,
          };
          validateTaxpayerSecrets(secrets);
          envelope = this.vault.seal(secrets, `${bookId}:${recordId}`);
          fields = Object.keys(secrets);
        }
        if (
          kind === 'settings' &&
          this.vault.available &&
          values.lkpSendingType_ComboBox_Input === 'ارسال مستقیم' &&
          !fields.includes('txtDirectPrivate')
        )
          v.invalid('کلید خصوصی برای ارسال مستقیم لازم است.');
        const attributes = JSON.parse(
          JSON.stringify({
            ...values,
            ...(envelope
              ? { __sealedSecrets: envelope, __secretFieldIds: fields }
              : {}),
          }),
        ) as Prisma.InputJsonValue;
        const row = current
          ? await tx.accountingConfiguration.update({
              where: { id: recordId },
              data: {
                attributes,
                title: String(values.txtTitle || kind),
                version: { increment: 1 },
              },
            })
          : await tx.accountingConfiguration.create({
              data: {
                id: recordId,
                bookId,
                kind: `taxpayer-draft-${kind}`,
                code: recordId,
                title: String(values.txtTitle || kind),
                attributes,
              },
            });
        const result: AccountingTaxpayerDraft = {
          id: row.id,
          kind,
          version: row.version,
          status: 'DRAFT',
          values,
          ...(fields.length ? { storedSecretFields: fields } : {}),
          externalConnection: false,
          externalAcceptance: false,
          createdAt: row.createdAt.toISOString(),
        };
        await tx.accountingCommand.create({
          data: {
            bookId,
            actorId: actor.userId,
            key,
            hash,
            action: `taxpayer-${kind}-draft-save`,
            result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
          },
        });
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  private async scope(
    tx: Prisma.TransactionClient,
    bookId: string,
    actor: AuthenticatedActor,
    write = false,
  ) {
    v.uuid(bookId);
    if (
      !actor.permissions.includes('finance.read') ||
      !actor.permissions.includes(
        write ? 'finance.account.manage' : 'finance.journal.read',
      )
    )
      throw new ForbiddenException();
    const book = await tx.accountingBook.findFirst({
      where: { id: bookId, branchId: { in: actor.branchIds } },
    });
    if (!book) throw new NotFoundException('دفتر حسابداری پیدا نشد.');
  }
  async seller(bookId: string, actor: AuthenticatedActor) {
    await this.scope(this.database.client, bookId, actor);
    const row = await this.database.client.accountingConfiguration.findFirst({
      where: { bookId, kind, code },
    });
    return row ? dto(row) : null;
  }
  async saveSeller(bookId: string, input: unknown, actor: AuthenticatedActor) {
    const body = v.object(input);
    if (
      Object.keys(body).some((k) => !['version', 'key', 'values'].includes(k))
    )
      v.invalid('درخواست معتبر نیست.');
    const key = v.uuid(body.key)!;
    if (!Number.isInteger(body.version) || Number(body.version) < 0)
      v.invalid('نسخه معتبر نیست.');
    const values = taxpayerSellerValues(body.values);
    const hash = createHash('sha256')
      .update(JSON.stringify({ version: body.version, values }))
      .digest('hex');
    try {
      return await this.database.client.$transaction(
        async (tx) => {
          await this.scope(tx, bookId, actor, true);
          const prior = await tx.accountingCommand.findUnique({
            where: { bookId_key: { bookId, key } },
          });
          if (prior) {
            if (
              prior.hash !== hash ||
              prior.actorId !== actor.userId ||
              prior.action !== 'taxpayer-seller-save'
            )
              throw new ConflictException(
                'کلید درخواست قبلاً استفاده شده است.',
              );
            return prior.result as unknown as AccountingTaxpayerSeller;
          }
          const current = await tx.accountingConfiguration.findFirst({
            where: { bookId, kind, code },
          });
          if ((current?.version ?? 0) !== body.version)
            throw new ConflictException(
              'اطلاعات فروشنده تغییر کرده است؛ دوباره بارگذاری کنید.',
            );
          const id = current?.id ?? randomUUID();
          if (current) {
            const changed = await tx.accountingConfiguration.updateMany({
              where: { id, bookId, kind, version: current.version },
              data: { attributes: values, version: { increment: 1 } },
            });
            if (changed.count !== 1) throw new ConflictException();
          } else
            await tx.accountingConfiguration.create({
              data: {
                id,
                bookId,
                kind,
                code,
                title: 'اطلاعات فروشنده',
                active: false,
                attributes: values,
              },
            });
          const result = dto(
            await tx.accountingConfiguration.findUniqueOrThrow({
              where: { id },
            }),
          );
          await tx.accountingCommand.create({
            data: {
              bookId,
              actorId: actor.userId,
              key,
              hash,
              action: 'taxpayer-seller-save',
              result: JSON.parse(
                JSON.stringify(result),
              ) as Prisma.InputJsonValue,
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
