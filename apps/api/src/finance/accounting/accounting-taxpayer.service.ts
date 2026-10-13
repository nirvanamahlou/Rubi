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
