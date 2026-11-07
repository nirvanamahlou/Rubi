import {
  Inject,
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  insurancePassengerIds,
  canViewRoute,
  salesContractFlights,
  type AuthenticatedActor,
  type SalesReservationRequestV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../../database/database.service';
import { CustomerInsuranceIdentity } from '../../customers/customer-insurance-identity';
import { InsuranceSettingsService } from '../../integrations/insurance/insurance-settings';
import { TravisSandboxService } from '../../integrations/insurance/travis-sandbox.service';
import { NotificationsService } from '../../notifications/notifications.service';

type State = {
  phase?: 'QUEUED' | 'CREATING' | 'CREATED' | 'CONFIRMING' | 'ISSUED';
  fingerprint?: string;
};
const message = {
  input: 'اطلاعات هویتی، پاسپورت و تماس بیمه‌شده را تکمیل کنید.',
  config: 'کشور و طرح فعال بیمه را در تنظیمات انتخاب کنید.',
  pending:
    'نتیجه بیمه‌گر نامشخص است؛ استعلام انجام می‌شود و درخواست تکراری ارسال نمی‌شود.',
  changed: 'اطلاعات بیمه پس از ارسال تغییر کرده است؛ نتیجه باید بررسی شود.',
};
@Injectable()
export class InsuranceAutomation implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CustomerInsuranceIdentity)
    private readonly identities: CustomerInsuranceIdentity,
    @Inject(InsuranceSettingsService)
    private readonly settings: InsuranceSettingsService,
    @Inject(TravisSandboxService)
    private readonly provider: TravisSandboxService,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => void this.dispatch(), 15000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Called only by the trusted Sales->Reservations inbox, before acknowledging its durable outbox. */
  async enqueue(intakeId: string) {
    const source = await this.db.client.reservationIntake.findUnique({
      where: { id: intakeId },
    });
    if (!source) return;
    const contract = await this.db.client.salesContract.findFirst({
      where: { id: source.contractId, branchId: source.branchId },
    });
    if (
      !contract ||
      !['SENT_TO_RESERVATIONS', 'CONFIRMED'].includes(contract.status)
    )
      return;
    const intake = { ...source, contract };
    if (
      !intake ||
      intake.status === 'CANCELLED' ||
      intake.contract.status === 'CANCELLED'
    )
      return;
    const snapshot = intake.snapshot as unknown as SalesReservationRequestV1;
    for (const customerId of insurancePassengerIds(snapshot)) {
      await this.db.client.reservationInsurancePolicy.upsert({
        where: {
          contractId_customerId_provider: {
            contractId: intake.contractId,
            customerId,
            provider: 'NOYAN',
          },
        },
        update: {},
        create: {
          contractId: intake.contractId,
          intakeId,
          customerId,
          automatic: true,
          sandbox: true,
          destinationCode: '-',
          planCode: '-',
          departureDate: intake.contract.departureDate,
          durationDays: 1,
          automation: { phase: 'QUEUED' },
          nextAttemptAt: new Date(),
        },
      });
    }
  }
  async dispatch() {
    if (this.running || !this.provider.configured()) return;
    this.running = true;
    try {
      const rows = await this.db.client.reservationInsurancePolicy.findMany({
        where: {
          automatic: true,
          sandbox: true,
          status: { in: ['DRAFT', 'INPUT_ERROR', 'PROVIDER_ERROR'] },
          AND: [
            {
              OR: [
                { nextAttemptAt: null },
                { nextAttemptAt: { lte: new Date() } },
              ],
            },
            {
              OR: [
                { processingUntil: null },
                { processingUntil: { lt: new Date() } },
              ],
            },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
        select: { id: true },
      });
      for (const row of rows) await this.process(row.id);
    } catch {
      Logger.warn(
        'Insurance sandbox queue unavailable; retry scheduled.',
        'InsuranceAutomation',
      );
    } finally {
      this.running = false;
    }
  }
  async process(id: string) {
    const now = new Date();
    const claimed = await this.db.client.reservationInsurancePolicy.updateMany({
      where: {
        id,
        automatic: true,
        sandbox: true,
        status: { in: ['DRAFT', 'INPUT_ERROR', 'PROVIDER_ERROR'] },
        OR: [{ processingUntil: null }, { processingUntil: { lt: now } }],
      },
      data: { processingUntil: new Date(now.getTime() + 300000) },
    });
    if (!claimed.count) return;
    let error: string = message.pending;
    try {
      const row =
        await this.db.client.reservationInsurancePolicy.findUniqueOrThrow({
          where: { id },
        });
      const state = (row.automation ?? {}) as State;
      error = message.input;
      const identity = await this.identities.read(row.intakeId, row.customerId);
      error = message.config;
      const contract = identity.intake.contract;
      const destination = await this.db.client.masterCity.findUnique({
        where: { id: contract.destinationId },
        select: { countryId: true },
      });
      const origin = await this.db.client.masterCity.findUnique({
        where: { id: contract.originId },
        include: { country: true },
      });
      const config = await this.settings.automationConfig(
        identity.intake.branchId,
      );
      const country = config.countries.find(
        (c) => c.active && c.countryId === destination?.countryId,
      );
      const insurance = identity.snapshot.serviceSelections.find(
        (s) =>
          s.kind === 'INSURANCE' &&
          identity.snapshot.passengerAssignments?.some(
            (p) =>
              p.customerId === row.customerId &&
              p.serviceClientKeys.includes(s.clientKey),
          ),
      );
      const plan = country?.plans.find(
        (p) => p.masterPlanId === insurance?.referenceId,
      );
      const departureDate = contract.departureDate.toISOString().slice(0, 10);
      const lastDay =
        [
          contract.returnNotBefore?.toISOString().slice(0, 10),
          identity.snapshot.hotelSelection?.checkOutDate?.slice(0, 10),
          ...(identity.snapshot.hotelSelection?.additionalStays ?? []).map(
            (s) => s.checkOutDate.slice(0, 10),
          ),
          ...salesContractFlights(
            identity.snapshot.serviceSelections,
            identity.snapshot.ticketSelections ?? [],
          )
            .filter((f) => f.direction === 'RETURN')
            .map((f) =>
              new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Tehran',
              }).format(new Date(f.departureAt)),
            ),
        ]
          .filter((d): d is string => Boolean(d))
          .sort()
          .at(-1) ?? departureDate;
      const durationDays = Math.max(
        1,
        Math.ceil(
          (Date.parse(lastDay) - Date.parse(departureDate)) / 86400000,
        ) + 1,
      );
      if (
        !country ||
        !plan ||
        !/^\d+$/.test(country.providerCountryCode) ||
        !/^\d+$/.test(plan.providerPlanCode) ||
        !origin?.country.code ||
        durationDays > 365
      )
        throw new Error();
      const catalog = await this.provider.catalog();
      const source = catalog.countries.find(
        (c) => c.standardCode === origin.country.code,
      );
      if (
        !source ||
        !catalog.countries.some(
          (c) => c.id === Number(country.providerCountryCode),
        ) ||
        !catalog.plans.some((p) => p.id === Number(plan.providerPlanCode))
      )
        throw new Error();
      const input = {
        sourceCountryId: source.id,
        destinationCountryId: Number(country.providerCountryCode),
        durationOfStay: durationDays,
        travelKind: 1,
        travelTypeId: 1,
        planId: Number(plan.providerPlanCode),
        contractNo: id,
        passportNo: identity.passportNo,
        person: identity.person,
      };
      const fingerprint = createHash('sha256')
        .update(JSON.stringify({ input, departureDate }))
        .digest('hex');
      if (state.fingerprint && state.fingerprint !== fingerprint) {
        error = message.changed;
        throw new Error();
      }
      const save = async (data: Prisma.ReservationInsurancePolicyUpdateInput) =>
        this.db.client.reservationInsurancePolicy.update({
          where: { id },
          data,
        });
      let providerId = row.providerId;
      let result: Awaited<ReturnType<TravisSandboxService['policy']>> = null;
      error = message.pending;
      if (!providerId && state.phase && state.phase !== 'QUEUED') {
        result = await this.provider.findCorrelatedPolicy(
          identity.person.nationalCode,
          input.planId,
          id,
        );
        if (!result) throw new Error(); // Never repeat Create after an ambiguous attempt.
        providerId = result.providerId;
        await save({
          providerId,
          automation: { phase: 'CREATED', fingerprint },
        });
      }
      if (!providerId) {
        await save({
          status: 'DRAFT',
          destinationCode: country.providerCountryCode,
          planCode: plan.providerPlanCode,
          departureDate: new Date(departureDate),
          durationDays,
          automation: { phase: 'CREATING', fingerprint },
          lastError: null,
        });
        providerId = String(await this.provider.createPolicy(input));
        await save({
          providerId,
          automation: { phase: 'CREATED', fingerprint },
        });
      }
      const expected = {
        contractNo: id,
        planId: input.planId,
        passportNo: input.passportNo,
        nationalCode: identity.person.nationalCode,
      };
      result = await this.provider.policy(Number(providerId), expected);
      if (!result?.active) {
        if (state.phase === 'CONFIRMING') throw new Error(); // Confirm outcome is reconciled, not blindly replayed.
        await save({ automation: { phase: 'CONFIRMING', fingerprint } });
        await this.provider.confirmPolicy(Number(providerId));
        result = await this.provider.policy(Number(providerId), expected);
      }
      if (
        !result?.active ||
        !result.policyNumber ||
        !result.amount ||
        !result.currencyCode ||
        !result.pdfUrl
      )
        throw new Error();
      await this.db.client.$transaction(async (tx) => {
        const saved = await tx.reservationInsurancePolicy.update({
          where: { id },
          data: {
            status: 'ISSUED',
            policyNumber: result!.policyNumber,
            amount: new Prisma.Decimal(result!.amount!),
            currencyCode: result!.currencyCode,
            pdfUrl: result!.pdfUrl,
            issuedAt: new Date(),
            automation: { phase: 'ISSUED', fingerprint },
            lastError: null,
            processingUntil: null,
            nextAttemptAt: null,
            version: { increment: 1 },
          },
        });
        await tx.reservationInsuranceRevision.create({
          data: {
            policyId: id,
            version: saved.version,
            actorUserId: contract.ownerUserId,
            action: 'SANDBOX_CONFIRMED',
            snapshot: {
              sandbox: true,
              policyNumber: saved.policyNumber,
              status: saved.status,
            },
          },
        });
        await this.notifications.createWithinTransaction(tx, {
          recipientUserIds: [contract.ownerUserId],
          actorUserId: null,
          sourceModule: 'reservations',
          eventType: 'insurance.sandbox.issued',
          title: 'بیمه‌نامه آزمایشی آماده شد',
          message: `${contract.contractNumber} · ${saved.policyNumber}`,
          entityType: 'RESERVATION_INSURANCE',
          entityId: id,
          href: '/sales',
        });
      });
    } catch {
      await this.db.client.reservationInsurancePolicy.updateMany({
        where: { id, status: { not: 'ISSUED' } },
        data: {
          status:
            error === message.input || error === message.config
              ? 'INPUT_ERROR'
              : 'PROVIDER_ERROR',
          lastError: error,
          processingUntil: null,
          nextAttemptAt: new Date(Date.now() + 60000),
        },
      });
    }
  }

  private async scoped(
    intakeId: string,
    actor: AuthenticatedActor,
    salesContractId?: string,
  ) {
    if (
      !salesContractId &&
      (!actor.permissions.includes('reservations.read') ||
        !actor.permissions.includes('customers.read'))
    )
      throw new ForbiddenException();
    const source = await this.db.client.reservationIntake.findFirst({
      where: {
        id: intakeId,
        branchId: { in: [...actor.branchIds] },
        ...(salesContractId ? { contractId: salesContractId } : {}),
      },
    });
    if (!source) throw new NotFoundException();
    const contract = await this.db.client.salesContract.findFirst({
      where: { id: source.contractId, branchId: source.branchId },
    });
    if (!contract) throw new NotFoundException();
    const intake = { ...source, contract };
    if (
      salesContractId &&
      !(
        actor.permissions.includes('sales.contracts.read.all') ||
        actor.permissions.includes('sales.contracts.read.branch') ||
        ((actor.permissions.includes('sales.contracts.read.own') ||
          (actor.permissions.includes('sales.contracts.create') &&
            canViewRoute(actor.permissions, '/sales/contracts/new'))) &&
          intake.contract.ownerUserId === actor.userId)
      )
    )
      throw new ForbiddenException();
    const snapshot = intake.snapshot as unknown as SalesReservationRequestV1;
    const ids = insurancePassengerIds(snapshot);
    const rows = await this.db.client.reservationInsurancePolicy.findMany({
      where: {
        contractId: intake.contractId,
        intakeId: intake.id,
        customerId: { in: ids },
      },
      orderBy: { customerId: 'asc' },
    });
    return { intake, ids, rows };
  }
  async summary(
    intakeId: string,
    actor: AuthenticatedActor,
    salesContractId?: string,
  ) {
    const { intake, ids, rows } = await this.scoped(
      intakeId,
      actor,
      salesContractId,
    );
    const snapshot = intake.snapshot as unknown as SalesReservationRequestV1;
    return {
      sandbox: true,
      total: ids.length,
      policies: rows.map((p) => ({
        id: p.id,
        customerId: p.customerId,
        passengerName:
          snapshot.passengerAssignments?.find(
            (a) => a.customerId === p.customerId,
          )?.displayNameSnapshot ?? '',
        policyNumber: p.status === 'ISSUED' ? p.policyNumber : null,
        status: p.status,
        error: p.lastError,
        sandbox: p.sandbox,
        ready:
          p.status === 'ISSUED' &&
          Boolean(p.pdfUrl) &&
          intake.status !== 'CANCELLED' &&
          intake.contract.status !== 'CANCELLED',
      })),
      ready:
        ids.length > 0 &&
        rows.length === ids.length &&
        rows.every((p) => p.status === 'ISSUED' && p.pdfUrl) &&
        intake.status !== 'CANCELLED' &&
        intake.contract.status !== 'CANCELLED',
    };
  }
  async download(
    intakeId: string,
    actor: AuthenticatedActor,
    policyId: string,
    salesContractId?: string,
  ) {
    const { intake, rows } = await this.scoped(
      intakeId,
      actor,
      salesContractId,
    );
    if (intake.status === 'CANCELLED' || intake.contract.status === 'CANCELLED')
      throw new ForbiddenException();
    const row = rows.find((p) => p.id === policyId);
    if (!row) throw new NotFoundException();
    if (row.status !== 'ISSUED' || !row.pdfUrl)
      throw new ConflictException(
        'بیمه‌نامه‌های مسافران هنوز آماده دریافت نیستند.',
      );
    return {
      bytes: await this.provider.policyPdf(row.pdfUrl),
      type: 'application/pdf',
      filename: `sandbox-insurance-${row.id}.pdf`,
    };
  }
}
