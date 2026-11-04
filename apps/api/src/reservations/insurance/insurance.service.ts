import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Joi from 'joi';
import { Prisma } from '@nora/database';
import type {
  AuthenticatedActor,
  InsuranceDraftInputV1,
  InsurancePolicyRowV1,
  SalesReservationRequestV1,
} from '@nora/contracts';
import { DatabaseService } from '../../database/database.service';
import { CustomerService } from '../../customers/customer.service';
import { TravelWorkflowService } from '../travel-workflow.service';
import { InsuranceSettingsService } from '../../integrations/insurance/insurance-settings';
type ReservationInsurancePolicy = Prisma.ReservationInsurancePolicyGetPayload<
  Record<string, never>
>;

const shortCode = Joi.string()
  .pattern(/^[a-zA-Z0-9._-]{1,40}$/)
  .required();
const draftSchema = Joi.object({
  intakeId: Joi.string().uuid().required(),
  customerId: Joi.string().uuid().required(),
  destinationCode: shortCode,
  planCode: shortCode,
  departureDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  durationDays: Joi.number().integer().min(1).max(365).required(),
  notes: Joi.string().max(2000).allow('').required(),
  expectedVersion: Joi.number().integer().min(0).required(),
});

export function insurancePassengerIds(snapshot: SalesReservationRequestV1) {
  const keys = new Set(
    snapshot.serviceSelections
      .filter((s) => s.kind === 'INSURANCE')
      .map((s) => s.clientKey),
  );
  if (!keys.size) return [];
  return [
    ...new Set(
      (snapshot.passengerAssignments ?? [])
        .filter(
          (p) =>
            p.serviceClientKeys.some((k) => keys.has(k)) &&
            snapshot.passengerIds.includes(p.customerId),
        )
        .map((p) => p.customerId),
    ),
  ];
}

export function parseInsuranceDraft(raw: unknown): InsuranceDraftInputV1 {
  const result = draftSchema.validate(raw, { convert: false });
  if (result.error)
    throw new BadRequestException('اطلاعات درخواست بیمه معتبر نیست.');
  const draft = result.value as InsuranceDraftInputV1;
  const date = new Date(draft.departureDate + 'T00:00:00.000Z');
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== draft.departureDate
  )
    throw new BadRequestException('تاریخ سفر معتبر نیست.');
  return draft;
}

@Injectable()
export class ReservationInsuranceService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(TravelWorkflowService)
    private readonly workflow: TravelWorkflowService,
    @Inject(CustomerService) private readonly customers: CustomerService,
    @Inject(InsuranceSettingsService)
    private readonly settings: InsuranceSettingsService,
  ) {}

  private authorize(actor: AuthenticatedActor, write = false) {
    if (
      !actor.permissions.includes('reservations.read') ||
      !actor.permissions.includes('customers.read') ||
      (write && !actor.permissions.includes('reservations.documents.manage'))
    )
      throw new ForbiddenException();
  }

  /** Exact contract/passenger projection; never copy the legacy global reference. */
  async issuedNumbers(
    contractId: string,
    customerIds: readonly string[],
    actor: AuthenticatedActor,
  ) {
    this.authorize(actor);
    const rows = await this.db.client.reservationInsurancePolicy.findMany({
      where: {
        contractId,
        customerId: { in: [...customerIds] },
        status: 'ISSUED',
        intake: { branchId: { in: [...actor.branchIds] } },
      },
      select: { customerId: true, policyNumber: true },
    });
    return new Map(
      rows
        .filter((r) => r.policyNumber)
        .map((r) => [r.customerId, r.policyNumber!]),
    );
  }

  async candidates(search: string, actor: AuthenticatedActor) {
    this.authorize(actor);
    if (search.trim().length < 2) return { data: [] };
    const rows = await this.db.client.reservationIntake.findMany({
      where: {
        branchId: { in: [...actor.branchIds] },
        snapshot: {
          path: ['contractNumber'],
          string_contains: search.trim().slice(0, 80),
        },
      },
      orderBy: [{ contractId: 'asc' }, { contractVersion: 'desc' }],
      distinct: ['contractId'],
      take: 21,
    });
    if (rows.length > 20)
      throw new BadRequestException('شماره قرارداد را دقیق‌تر وارد کنید.');
    const data = [];
    for (const row of rows) {
      const intake = await this.workflow.detail(row.id, actor.branchIds, true);
      const existing = await this.db.client.reservationInsurancePolicy.findMany(
        {
          where: { contractId: row.contractId },
          select: { customerId: true },
        },
      );
      for (const customerId of insurancePassengerIds(intake.snapshot)) {
        if (existing.some((p) => p.customerId === customerId)) continue;
        const { data: customer } = await this.customers.detail(
          customerId,
          actor,
        );
        data.push({
          intakeId: row.id,
          branchId: row.branchId,
          customerId,
          contractNumber: intake.snapshot.contractNumber,
          passengerName: customer.displayName,
        });
      }
    }
    return { data };
  }

  async list(raw: Record<string, unknown>, actor: AuthenticatedActor) {
    this.authorize(actor);
    const parsed = Joi.object({
      search: Joi.string().max(100).allow('').default(''),
      status: Joi.string()
        .valid(
          'ALL',
          'DRAFT',
          'INPUT_ERROR',
          'PROVIDER_ERROR',
          'ISSUED',
          'CANCELLED',
        )
        .default('ALL'),
      destinationCode: Joi.string().max(40).allow('').default(''),
      dateBasis: Joi.string()
        .valid('CREATED', 'TRAVEL', 'ISSUED')
        .default('CREATED'),
      from: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .allow(''),
      to: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .allow(''),
      page: Joi.number().integer().min(1).max(10000).default(1),
    }).validate(raw);
    if (parsed.error) throw new BadRequestException('فیلتر بیمه معتبر نیست.');
    const q = parsed.value as {
      search: string;
      status: string;
      destinationCode: string;
      dateBasis: string;
      from?: string;
      to?: string;
      page: number;
    };
    const range: { gte?: Date; lt?: Date } = {};
    for (const [field, value] of [
      ['gte', q.from],
      ['lt', q.to],
    ] as const) {
      if (!value) continue;
      const d = new Date(value + 'T00:00:00.000Z');
      if (
        !Number.isFinite(d.getTime()) ||
        d.toISOString().slice(0, 10) !== value
      )
        throw new BadRequestException('تاریخ فیلتر معتبر نیست.');
      if (field === 'lt') d.setUTCDate(d.getUTCDate() + 1);
      range[field] = d;
    }
    if (range.gte && range.lt && range.gte >= range.lt)
      throw new BadRequestException('بازه تاریخ معتبر نیست.');
    const where: Prisma.ReservationInsurancePolicyWhereInput = {
      intake: { branchId: { in: [...actor.branchIds] } },
      ...(q.status !== 'ALL' ? { status: q.status } : {}),
      ...(q.destinationCode ? { destinationCode: q.destinationCode } : {}),
      ...(q.search
        ? {
            OR: [
              { policyNumber: { contains: q.search } },
              {
                intake: {
                  snapshot: {
                    path: ['contractNumber'],
                    string_contains: q.search,
                  },
                },
              },
            ],
          }
        : {}),
      ...(Object.keys(range).length
        ? {
            [q.dateBasis === 'TRAVEL'
              ? 'departureDate'
              : q.dateBasis === 'ISSUED'
                ? 'issuedAt'
                : 'createdAt']: range,
          }
        : {}),
    };
    const [count, rows, totals] = await this.db.client.$transaction(
      [
        this.db.client.reservationInsurancePolicy.count({ where }),
        this.db.client.reservationInsurancePolicy.findMany({
          where,
          include: { intake: { select: { snapshot: true, branchId: true } } },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: 50,
          skip: (q.page - 1) * 50,
        }),
        this.db.client.reservationInsurancePolicy.groupBy({
          by: ['currencyCode', 'status'],
          where,
          _sum: { amount: true },
          _count: true,
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const data: InsurancePolicyRowV1[] = [];
    for (const row of rows) {
      const { data: customer } = await this.customers.detail(
        row.customerId,
        actor,
      );
      data.push({
        ...this.present(row),
        branchId: row.intake.branchId,
        contractNumber: (
          row.intake.snapshot as unknown as SalesReservationRequestV1
        ).contractNumber,
        passengerName:
          [customer.passportFirstName, customer.passportLastName]
            .filter(Boolean)
            .join(' ') || customer.displayName,
      });
    }
    return {
      data,
      count,
      page: q.page,
      pageSize: 50,
      totals: totals.map((r) => ({
        status: r.status,
        currencyCode: r.currencyCode,
        amount: r._sum.amount?.toString() ?? null,
        count: r._count,
      })),
      canManage: actor.permissions.includes('reservations.documents.manage'),
      providerStatus: 'NOT_CONFIGURED' as const,
    };
  }

  private present(row: ReservationInsurancePolicy) {
    return {
      id: row.id,
      intakeId: row.intakeId,
      customerId: row.customerId,
      policyNumber: ['ISSUED', 'CANCELLED'].includes(row.status)
        ? row.policyNumber
        : null,
      status: row.status as InsurancePolicyRowV1['status'],
      destinationCode: row.destinationCode,
      planCode: row.planCode,
      departureDate: row.departureDate.toISOString().slice(0, 10),
      durationDays: row.durationDays,
      amount: row.amount?.toString() ?? null,
      currencyCode: row.currencyCode,
      issuedAt: row.issuedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      notes: row.notes,
      version: row.version,
    };
  }

  async saveDraft(raw: unknown, actor: AuthenticatedActor) {
    this.authorize(actor, true);
    const input = parseInsuranceDraft(raw);
    const intake = await this.workflow.detail(
      input.intakeId,
      actor.branchIds,
      true,
    );
    if (!insurancePassengerIds(intake.snapshot).includes(input.customerId))
      throw new BadRequestException(
        'بیمه برای این مسافر در قرارداد انتخاب نشده است.',
      );
    await this.customers.detail(input.customerId, actor);
    const settings = await this.settings.read(intake.branchId, actor);
    const country = settings.config.countries.find(
      (c) => c.active && c.providerCountryCode === input.destinationCode,
    );
    if (!country?.plans.some((p) => p.providerPlanCode === input.planCode))
      throw new BadRequestException(
        'کشور و طرح فعال بیمه را در تنظیمات انتخاب کنید.',
      );
    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${'insurance:' + intake.contractId + ':' + input.customerId}, 0))`,
      );
      const current = await tx.reservationInsurancePolicy.findUnique({
        where: {
          contractId_customerId_provider: {
            contractId: intake.contractId,
            customerId: input.customerId,
            provider: 'NOYAN',
          },
        },
      });
      if ((current?.version ?? 0) !== input.expectedVersion)
        throw new ConflictException(
          'اطلاعات بیمه تغییر کرده است؛ دوباره دریافت کنید.',
        );
      if (
        current &&
        !['DRAFT', 'INPUT_ERROR', 'PROVIDER_ERROR'].includes(current.status)
      )
        throw new ConflictException(
          'اصلاح بیمه‌نامه صادرشده به تأیید بیمه‌گر نیاز دارد.',
        );
      const values = {
        destinationCode: input.destinationCode,
        planCode: input.planCode,
        departureDate: new Date(input.departureDate + 'T00:00:00Z'),
        durationDays: input.durationDays,
        notes: input.notes,
        status: 'DRAFT',
        version: (current?.version ?? 0) + 1,
      };
      const saved = current
        ? await tx.reservationInsurancePolicy.update({
            where: { id: current.id },
            data: values,
          })
        : await tx.reservationInsurancePolicy.create({
            data: {
              ...values,
              contractId: intake.contractId,
              intakeId: intake.id,
              customerId: input.customerId,
            },
          });
      await tx.reservationInsuranceRevision.create({
        data: {
          policyId: saved.id,
          version: saved.version,
          action: 'DRAFT_SAVED',
          actorUserId: actor.userId,
          snapshot: JSON.parse(
            JSON.stringify(this.present(saved)),
          ) as Prisma.InputJsonValue,
        },
      });
      return { data: this.present(saved) };
    });
  }

  async history(id: string, actor: AuthenticatedActor) {
    this.authorize(actor);
    const row = await this.db.client.reservationInsurancePolicy.findFirst({
      where: { id, intake: { branchId: { in: [...actor.branchIds] } } },
    });
    if (!row) throw new NotFoundException();
    await this.customers.detail(row.customerId, actor);
    return {
      data: await this.db.client.reservationInsuranceRevision.findMany({
        where: { policyId: id },
        orderBy: { version: 'desc' },
        take: 100,
        select: {
          version: true,
          action: true,
          snapshot: true,
          createdAt: true,
        },
      }),
    };
  }

  /**
   * Internal port for a future trusted provider adapter, deliberately not an HTTP
   * command. A draft or a provider's temporary policy ID is not an issued number.
   */
  async recordProviderConfirmation(
    id: string,
    expectedVersion: number,
    raw: unknown,
    actor: AuthenticatedActor,
  ) {
    this.authorize(actor, true);
    const parsed = Joi.object({
      providerId: Joi.string().trim().min(1).max(100).required(),
      policyNumber: Joi.string().trim().min(1).max(100).required(),
      amount: Joi.string()
        .pattern(/^\d{1,15}(\.\d{1,4})?$/)
        .required(),
      currencyCode: Joi.string()
        .pattern(/^[A-Z]{3}$/)
        .required(),
      issuedAt: Joi.string().isoDate().required(),
    }).validate(raw, { convert: false });
    if (
      parsed.error ||
      !Number.isSafeInteger(expectedVersion) ||
      expectedVersion < 1
    )
      throw new BadRequestException('پاسخ تأیید صدور بیمه کامل نیست.');
    const result = parsed.value as {
      providerId: string;
      policyNumber: string;
      amount: string;
      currencyCode: string;
      issuedAt: string;
    };
    const row = await this.db.client.reservationInsurancePolicy.findFirst({
      where: { id, intake: { branchId: { in: [...actor.branchIds] } } },
    });
    if (!row) throw new NotFoundException();
    await this.customers.detail(row.customerId, actor);
    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${'insurance:' + row.contractId + ':' + row.customerId}, 0))`,
      );
      const current = await tx.reservationInsurancePolicy.findUniqueOrThrow({
        where: { id },
      });
      // Repeat the same confirmed result safely; different results require review.
      if (
        current.status === 'ISSUED' &&
        current.providerId === result.providerId &&
        current.policyNumber === result.policyNumber &&
        current.amount?.equals(new Prisma.Decimal(result.amount)) &&
        current.currencyCode === result.currencyCode &&
        current.issuedAt?.getTime() === new Date(result.issuedAt).getTime()
      )
        return this.present(current);
      if (
        current.version !== expectedVersion ||
        !['DRAFT', 'INPUT_ERROR', 'PROVIDER_ERROR'].includes(current.status)
      )
        throw new ConflictException(
          'نتیجه صدور با نسخه جاری درخواست سازگار نیست.',
        );
      const saved = await tx.reservationInsurancePolicy.update({
        where: { id },
        data: {
          ...result,
          amount: new Prisma.Decimal(result.amount),
          issuedAt: new Date(result.issuedAt),
          status: 'ISSUED',
          version: current.version + 1,
        },
      });
      await tx.reservationInsuranceRevision.create({
        data: {
          policyId: id,
          version: saved.version,
          action: 'PROVIDER_CONFIRMED',
          actorUserId: actor.userId,
          snapshot: JSON.parse(
            JSON.stringify(this.present(saved)),
          ) as Prisma.InputJsonValue,
        },
      });
      return this.present(saved);
    });
  }
}
