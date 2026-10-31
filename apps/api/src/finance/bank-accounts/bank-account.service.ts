import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  hasAccessControl,
  type AuthenticatedActor,
  type CompanyBankAccountV1,
  type CompanyBankAccountOptionsV1,
} from '@nora/contracts';
import { type Prisma, type DatabaseClient } from '@nora/database';
import { DatabaseService } from '../../database/database.service';
import { MasterProcurementDirectory } from '../../master-data/master-procurement-directory';
import { BankAccountCrypto, type BankIdentifiers } from './bank-account.crypto';
import {
  bankInput,
  bankUuid,
  bankVersion,
  maskedBankIdentifier,
  normalizeBankIdentifier,
} from './bank-account.validation';

type Account = NonNullable<
  Awaited<ReturnType<DatabaseClient['financeSettlementAccount']['findFirst']>>
>;
const fields = ['accountNumber', 'cardNumber', 'iban'] as const;

@Injectable()
export class BankAccountService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(MasterProcurementDirectory)
    private readonly directory: MasterProcurementDirectory,
    @Inject(BankAccountCrypto) private readonly crypto: BankAccountCrypto,
  ) {}

  private require(actor: AuthenticatedActor, manage = false) {
    if (
      !actor.permissions.includes('finance.read') ||
      !actor.permissions.includes('master_data.read') ||
      !hasAccessControl(actor.permissions, 'master-data.resource.banks') ||
      (manage && !actor.permissions.includes('finance.account.manage'))
    )
      throw new ForbiddenException(
        'مجوز مدیریت یا مشاهده حساب بانکی وجود ندارد.',
      );
  }
  private scope(actor: AuthenticatedActor, branchId: string) {
    if (!actor.branchIds.includes(branchId))
      throw new ForbiddenException('شعبه خارج از دسترسی است.');
  }
  private context(row: {
    id: string;
    branchId: string;
    bankId: string | null;
  }) {
    return `finance:company-bank:v1:${row.branchId}:${row.bankId}:${row.id}`;
  }
  private projection(row: Account): CompanyBankAccountV1 {
    return {
      id: row.id,
      branchId: row.branchId,
      bankId: row.bankId!,
      title: row.title,
      currencyCode: row.currencyCode,
      version: row.version,
      isActive: row.isActive,
      accountNumber: row.maskedAccountNumber,
      cardNumber: row.maskedCardNumber,
      iban: row.maskedIban,
    };
  }
  async options(
    bankId: string,
    actor: AuthenticatedActor,
  ): Promise<CompanyBankAccountOptionsV1> {
    this.require(actor);
    await this.directory.assertBank(bankUuid(bankId));
    const [branches, currencies] = await Promise.all([
      this.directory.branches([...actor.branchIds]),
      this.directory.currencies(),
    ]);
    return {
      branches,
      currencies: currencies.map(({ code, name }) => ({ code, name })),
      canManage: actor.permissions.includes('finance.account.manage'),
    };
  }
  async list(
    bankId: string,
    page: string | undefined,
    actor: AuthenticatedActor,
  ) {
    this.require(actor);
    bankId = bankUuid(bankId);
    const number = page === undefined ? 1 : Number(page);
    if (!Number.isSafeInteger(number) || number < 1 || number > 100000)
      throw new BadRequestException('صفحه حساب‌ها معتبر نیست.');
    const rows = await this.db.client.financeSettlementAccount.findMany({
      where: {
        bankId,
        kind: 'BANK',
        deletedAt: null,
        branchId: { in: [...actor.branchIds] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 26,
      skip: (number - 1) * 25,
    });
    return {
      items: rows.slice(0, 25).map((row) => this.projection(row)),
      hasMore: rows.length > 25,
      page: number,
    };
  }
  private async find(
    tx: Prisma.TransactionClient,
    bankId: string,
    id: string,
    actor: AuthenticatedActor,
  ) {
    const row = await tx.financeSettlementAccount.findFirst({
      where: {
        id,
        bankId,
        kind: 'BANK',
        deletedAt: null,
        branchId: { in: [...actor.branchIds] },
      },
    });
    if (!row) throw new NotFoundException('حساب بانکی پیدا نشد.');
    return row;
  }
  private async audit(
    tx: Prisma.TransactionClient,
    row: Account,
    actor: AuthenticatedActor,
    action: string,
    before?: CompanyBankAccountV1,
  ) {
    await tx.financeBankAccountAudit.create({
      data: {
        accountId: row.id,
        actorUserId: actor.userId,
        action,
        metadata: {
          branchId: row.branchId,
          bankId: row.bankId,
          version: row.version,
          ...(before ? { before: { ...before } } : {}),
          after: { ...this.projection(row) },
        },
      },
    });
  }
  async details(bankId: string, id: string, actor: AuthenticatedActor) {
    this.require(actor, true);
    bankId = bankUuid(bankId);
    id = bankUuid(id);
    return this.db.client.$transaction(async (tx) => {
      const row = await this.find(tx, bankId, id, actor);
      const identifiers = this.crypto.open(
        row.bankIdentifiers,
        this.context(row),
      );
      await this.audit(tx, row, actor, 'REVEAL');
      return { ...this.projection(row), ...identifiers };
    });
  }
  async remove(
    bankId: string,
    id: string,
    input: unknown,
    actor: AuthenticatedActor,
  ) {
    this.require(actor, true);
    bankId = bankUuid(bankId);
    id = bankUuid(id);
    const expectedVersion = bankVersion(
      bankInput(input, ['expectedVersion']).expectedVersion,
    );
    return this.db.client.$transaction(
      async (tx) => {
        const current = await this.find(tx, bankId, id, actor);
        if (current.version !== expectedVersion)
          throw new ConflictException(
            'حساب هم‌زمان تغییر کرده است؛ دوباره آن را باز کنید.',
          );
        const usage = await tx.financeSettlementAccount.findUniqueOrThrow({
          where: { id },
          include: { _count: true },
        });
        if (
          Object.entries(usage._count).some(
            ([key, count]) => key !== 'bankAccountAudits' && count > 0,
          )
        )
          throw new ConflictException('حساب بانکی استفاده‌شده قابل حذف نیست.');
        const result = await tx.financeSettlementAccount.updateMany({
          where: {
            id,
            bankId,
            branchId: current.branchId,
            version: expectedVersion,
            deletedAt: null,
          },
          data: {
            isActive: false,
            deletedAt: new Date(),
            version: { increment: 1 },
          },
        });
        if (result.count !== 1)
          throw new ConflictException(
            'حساب هم‌زمان تغییر کرده است؛ دوباره آن را باز کنید.',
          );
        await this.audit(
          tx,
          { ...current, isActive: false, version: current.version + 1 },
          actor,
          'DELETE',
          this.projection(current),
        );
        return { id };
      },
      { isolationLevel: 'Serializable' },
    );
  }
  private identifiers(
    input: Record<string, unknown>,
    previous: BankIdentifiers,
  ): BankIdentifiers {
    const values = { ...previous };
    for (const field of fields)
      if (Object.hasOwn(input, field))
        values[field] = normalizeBankIdentifier(field, input[field]);
    if (fields.every((field) => !values[field]))
      throw new BadRequestException(
        'حداقل یکی از شماره حساب، کارت یا شبا را وارد کنید.',
      );
    return values;
  }
  private protectedData(values: BankIdentifiers, context: string) {
    return {
      bankIdentifiers: this.crypto.seal(values, context),
      maskedAccountNumber: maskedBankIdentifier(values.accountNumber),
      maskedCardNumber: maskedBankIdentifier(values.cardNumber),
      maskedIban: maskedBankIdentifier(values.iban),
      maskedIdentifier: maskedBankIdentifier(
        values.iban ?? values.accountNumber ?? values.cardNumber,
      ),
      accountFingerprint: this.crypto.fingerprint(
        'accountNumber',
        values.accountNumber,
      ),
      cardFingerprint: this.crypto.fingerprint('cardNumber', values.cardNumber),
      ibanFingerprint: this.crypto.fingerprint('iban', values.iban),
    };
  }
  async save(
    bankId: string,
    id: string | null,
    body: unknown,
    actor: AuthenticatedActor,
  ) {
    this.require(actor, true);
    bankId = bankUuid(bankId);
    if (id) id = bankUuid(id);
    const input = bankInput(body, [
      'title',
      'currencyCode',
      'isActive',
      ...fields,
      ...(id ? ['expectedVersion'] : ['branchId', 'requestId']),
    ]);
    if (
      typeof input.title !== 'string' ||
      !input.title.trim() ||
      input.title.trim().length > 160 ||
      typeof input.currencyCode !== 'string' ||
      !/^[A-Z]{3}$/.test(input.currencyCode) ||
      typeof input.isActive !== 'boolean'
    )
      throw new BadRequestException('اطلاعات حساب بانکی معتبر نیست.');
    const title = input.title.trim(),
      currencyCode = input.currencyCode,
      isActive = input.isActive;
    const expectedVersion = id ? bankVersion(input.expectedVersion) : null;
    const branchId = id ? null : bankUuid(input.branchId),
      requestId = id ?? bankUuid(input.requestId);
    if (branchId) this.scope(actor, branchId);
    try {
      return await this.db.client.$transaction(
        async (tx) => {
          await this.directory.assertBank(bankId, tx);
          await this.directory.assertCurrency(currencyCode, tx);
          if (id) {
            const current = await this.find(tx, bankId, id, actor);
            if (current.version !== expectedVersion)
              throw new ConflictException(
                'حساب هم‌زمان تغییر کرده است؛ دوباره آن را باز کنید.',
              );
            if (current.currencyCode !== currencyCode)
              throw new BadRequestException(
                'ارز حساب ثبت‌شده قابل تغییر نیست.',
              );
            const identifiers = this.identifiers(
              input,
              this.crypto.open(current.bankIdentifiers, this.context(current)),
            );
            const result = await tx.financeSettlementAccount.updateMany({
              where: {
                id,
                bankId,
                branchId: current.branchId,
                version: expectedVersion!,
              },
              data: {
                title,
                isActive,
                ...this.protectedData(identifiers, this.context(current)),
                version: { increment: 1 },
              },
            });
            if (result.count !== 1)
              throw new ConflictException(
                'حساب هم‌زمان تغییر کرده است؛ دوباره آن را باز کنید.',
              );
            const row = await this.find(tx, bankId, id, actor);
            await this.audit(
              tx,
              row,
              actor,
              'UPDATE',
              this.projection(current),
            );
            return this.projection(row);
          }
          const branches = await this.directory.branches([branchId!], tx);
          if (!branches.some((branch) => branch.id === branchId))
            throw new BadRequestException('شعبه خارج از دسترسی است.');
          const identifiers = this.identifiers(input, {
            accountNumber: null,
            cardNumber: null,
            iban: null,
          });
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`company-bank:${requestId}`}, 0))::text`;
          const previous = await tx.financeSettlementAccount.findUnique({
            where: { id: requestId },
          });
          const protectedData = this.protectedData(
            identifiers,
            this.context({ id: requestId, bankId, branchId: branchId! }),
          );
          if (previous) {
            if (
              previous.bankId !== bankId ||
              previous.branchId !== branchId ||
              previous.kind !== 'BANK' ||
              previous.title !== title ||
              previous.currencyCode !== currencyCode ||
              previous.isActive !== isActive ||
              previous.accountFingerprint !==
                protectedData.accountFingerprint ||
              previous.cardFingerprint !== protectedData.cardFingerprint ||
              previous.ibanFingerprint !== protectedData.ibanFingerprint
            )
              throw new ConflictException(
                'این درخواست قبلاً با اطلاعات دیگری ثبت شده است.',
              );
            return this.projection(previous);
          }
          const row = await tx.financeSettlementAccount.create({
            data: {
              id: requestId,
              branchId: branchId!,
              bankId,
              kind: 'BANK',
              title,
              currencyCode,
              isActive,
              createdByUserId: actor.userId,
              ...protectedData,
            },
          });
          await this.audit(tx, row, actor, 'CREATE');
          return this.projection(row);
        },
        { maxWait: 15000, timeout: 15000 },
      );
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'حساب یا شماره واردشده قبلاً برای این بانک و شعبه ثبت شده است.',
        );
      throw error;
    }
  }
}
