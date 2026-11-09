import { TravisDiagnosticError } from '../../integrations/insurance/travis-sandbox.service';
import {
  Inject,
  forwardRef,
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
import { SalesOperationalAmendmentService } from '../../sales/sales-operational-amendment.module';
import { InsuranceApplicantCrypto } from './insurance-applicant.crypto';

type State = {
  useDraft?: boolean;
  phase?: 'QUEUED' | 'CREATING' | 'CREATED' | 'CONFIRMING' | 'ISSUED';
  fingerprint?: string;
  firstError?: string;
  latestError?: string;
};
const message = {
  input: 'اطلاعات هویتی، پاسپورت و تماس بیمه‌شده را تکمیل کنید.',
  config: 'کشور و طرح فعال بیمه را در تنظیمات انتخاب کنید.',
  pending:
    'نتیجه بیمه‌گر نامشخص است؛ استعلام انجام می‌شود و درخواست تکراری ارسال نمی‌شود.',
  changed: 'اطلاعات بیمه پس از ارسال تغییر کرده است؛ نتیجه باید بررسی شود.',
  duration: 'مدت بیمه را از فهرست مجاز بیمه‌گر انتخاب کنید.',
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
    @Inject(forwardRef(() => SalesOperationalAmendmentService))
    private readonly sales: SalesOperationalAmendmentService,
    @Inject(InsuranceApplicantCrypto)
    private readonly applicantCrypto: InsuranceApplicantCrypto,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => void this.dispatch(), 15000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Kick a committed correction now; leases/fingerprints still prevent duplicate issuance. */
  requestImmediate(id: string) {
    if (!this.provider.configured()) return;
    void this.process(id).catch(() => {
      Logger.warn(
        'Insurance immediate attempt unavailable; durable retry remains queued.',
        'InsuranceAutomation',
      );
    });
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
    const snapshot = await this.sales.currentExecution(
      this.db.client,
      intake.snapshot as unknown as SalesReservationRequestV1,
      [intake.branchId],
    );
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
  private async identity(
    row: Prisma.ReservationInsurancePolicyGetPayload<Record<string, never>>,
  ) {
    if (row.applicantId) {
      const applicant =
        await this.db.client.reservationInsuranceApplicant.findUniqueOrThrow({
          where: { id: row.applicantId },
        });
      const person = this.applicantCrypto.open(
        applicant.id,
        applicant.branchId,
        applicant.encryptedData,
      );
      await this.db.client.reservationInsuranceApplicantAccess.create({
        data: {
          applicantId: applicant.id,
          actorUserId: applicant.createdByUserId,
          action: 'PROVIDER_READ',
        },
      });
      return {
        branchId: applicant.branchId,
        ownerUserId: applicant.createdByUserId,
        reference: 'بیمه مستقل',
        contract: null,
        snapshot: null,
        sourceProviderCode: applicant.sourceCountryCode,
        passportNo: person.passportNo,
        person: {
          nationalCode:
            person.nationalityCode === 'IRN'
              ? person.nationalCode
              : person.passportNo,
          isIranian: person.nationalityCode === 'IRN',
          firstName: person.firstName,
          lastName: person.lastName,
          firstNameLatin: person.firstNameLatin,
          lastNameLatin: person.lastNameLatin,
          gender: person.gender === 'M' ? 1 : 2,
          birthDate: new Date(person.birthDate + 'T00:00:00Z').toISOString(),
          mobile: person.mobile,
          email: person.email,
        },
      };
    }
    if (!row.intakeId || !row.customerId) throw new Error();
    const identity = await this.identities.read(row.intakeId, row.customerId);
    return {
      branchId: identity.intake.branchId,
      ownerUserId: identity.intake.contract.ownerUserId,
      reference: identity.intake.contract.contractNumber,
      contract: identity.intake.contract,
      snapshot: identity.snapshot,
      sourceProviderCode: null,
      person: identity.person,
      passportNo: identity.passportNo,
    };
  }
  async process(id: string) {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + 300000);
    const claimed = await this.db.client.reservationInsurancePolicy.updateMany({
      where: {
        id,
        automatic: true,
        sandbox: true,
        status: { in: ['DRAFT', 'INPUT_ERROR', 'PROVIDER_ERROR'] },
        OR: [{ processingUntil: null }, { processingUntil: { lt: now } }],
      },
      data: { processingUntil: leaseUntil },
    });
    if (!claimed.count) return;
    let error: string = message.pending;
    let state: State = {};
    try {
      const row =
        await this.db.client.reservationInsurancePolicy.findUniqueOrThrow({
          where: { id, processingUntil: leaseUntil },
        });
      state = (row.automation ?? {}) as State;
      error = message.input;
      const identity = await this.identity(row);
      error = message.config;
      const contract = identity.contract;
      const destination = contract
        ? await this.db.client.masterCity.findUnique({
            where: { id: contract.destinationId },
            select: { countryId: true },
          })
        : null;
      const origin = contract
        ? await this.db.client.masterCity.findUnique({
            where: { id: contract.originId },
            include: { country: true },
          })
        : null;
      const config = await this.settings.automationConfig(identity.branchId);
      const country = config.countries.find(
        (c) =>
          c.active &&
          (state.useDraft
            ? c.providerCountryCode === row.destinationCode
            : c.countryId === destination?.countryId),
      );
      const insurance = identity.snapshot?.serviceSelections.find(
        (s) =>
          s.kind === 'INSURANCE' &&
          identity.snapshot?.passengerAssignments?.some(
            (p) =>
              p.customerId === row.customerId &&
              p.serviceClientKeys.includes(s.clientKey),
          ),
      );
      const plan = country?.plans.find((p) =>
        state.useDraft
          ? p.providerPlanCode === row.planCode
          : p.masterPlanId === insurance?.referenceId,
      );
      const departureDate = (
        state.useDraft || !contract ? row.departureDate : contract.departureDate
      )
        .toISOString()
        .slice(0, 10);
      const lastDay =
        [
          contract?.returnNotBefore?.toISOString().slice(0, 10),
          identity.snapshot?.hotelSelection?.checkOutDate?.slice(0, 10),
          ...(identity.snapshot?.hotelSelection?.additionalStays ?? []).map(
            (s) => s.checkOutDate.slice(0, 10),
          ),
          ...salesContractFlights(
            identity.snapshot?.serviceSelections ?? [],
            identity.snapshot?.ticketSelections ?? [],
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
      const durationDays = state.useDraft
        ? row.durationDays
        : Math.max(
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
        !(identity.sourceProviderCode || origin?.country.code) ||
        durationDays > 365
      )
        throw new Error();
      const catalog = await this.provider.catalog();
      if (
        !row.providerId &&
        (!state.phase || state.phase === 'QUEUED') &&
        !catalog.durations.some((duration) => duration.days === durationDays)
      ) {
        error = message.duration;
        throw new Error();
      }
      const source = catalog.countries.find((c) =>
        identity.sourceProviderCode
          ? String(c.id) === identity.sourceProviderCode
          : c.standardCode === origin?.country.code,
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
      const save = async (
        data: Prisma.ReservationInsurancePolicyUpdateInput,
      ) => {
        const saved = await this.db.client.reservationInsurancePolicy.update({
          where: {
            id,
            processingUntil: leaseUntil,
            AND: [{ processingUntil: { gt: new Date() } }],
          },
          data,
        });
        if (data.automation && typeof data.automation === 'object')
          state = data.automation as State;
        return saved;
      };
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
          automation: {
            ...state,
            phase: 'CREATED',
            fingerprint,
            useDraft: state.useDraft === true,
          },
        });
      }
      if (!providerId) {
        await save({
          status: 'DRAFT',
          destinationCode: country.providerCountryCode,
          planCode: plan.providerPlanCode,
          departureDate: new Date(departureDate),
          durationDays,
          automation: {
            ...state,
            phase: 'CREATING',
            fingerprint,
            useDraft: state.useDraft === true,
          },
          lastError: null,
        });
        providerId = String(await this.provider.createPolicy(input));
        await save({
          providerId,
          automation: {
            ...state,
            phase: 'CREATED',
            fingerprint,
            useDraft: state.useDraft === true,
          },
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
        await save({
          automation: {
            ...state,
            phase: 'CONFIRMING',
            fingerprint,
            useDraft: state.useDraft === true,
          },
        });
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
          where: {
            id,
            processingUntil: leaseUntil,
            AND: [{ processingUntil: { gt: new Date() } }],
          },
          data: {
            status: 'ISSUED',
            policyNumber: result!.policyNumber,
            amount: new Prisma.Decimal(result!.amount!),
            currencyCode: result!.currencyCode,
            pdfUrl: result!.pdfUrl,
            issuedAt: new Date(),
            automation: {
              ...state,
              phase: 'ISSUED',
              fingerprint,
              useDraft: state.useDraft === true,
            },
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
            actorUserId: identity.ownerUserId,
            action: 'SANDBOX_CONFIRMED',
            snapshot: {
              sandbox: true,
              policyNumber: saved.policyNumber,
              status: saved.status,
              previousError: state.firstError ?? null,
            },
          },
        });
        await this.notifications.createWithinTransaction(tx, {
          recipientUserIds: [identity.ownerUserId],
          actorUserId: null,
          sourceModule: 'reservations',
          eventType: 'insurance.sandbox.issued',
          title: 'بیمه‌نامه آزمایشی آماده شد',
          message: `${identity.reference} · ${saved.policyNumber}`,
          entityType: 'RESERVATION_INSURANCE',
          entityId: id,
          href: row.applicantId ? '/reservations/insurance' : '/sales',
        });
      });
    } catch (cause) {
      if (cause instanceof TravisDiagnosticError) error = cause.message;
      const firstError =
        state.firstError ??
        (cause instanceof TravisDiagnosticError ? cause.message : undefined);
      await this.db.client.reservationInsurancePolicy.updateMany({
        where: { id, processingUntil: leaseUntil, status: { not: 'ISSUED' } },
        data: {
          status:
            error === message.input ||
            error === message.config ||
            error === message.duration
              ? 'INPUT_ERROR'
              : 'PROVIDER_ERROR',
          lastError: (firstError &&
          error !== firstError &&
          error !== message.pending
            ? firstError + ' · ' + error
            : (firstError ?? error)
          ).slice(0, 500),
          ...(firstError
            ? {
                automation: {
                  ...state,
                  firstError,
                  latestError:
                    error === message.pending
                      ? (state.latestError ?? firstError)
                      : error,
                },
              }
            : {}),
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
    const snapshot =
      intake.contract.status === 'CANCELLED'
        ? (intake.snapshot as unknown as SalesReservationRequestV1)
        : await this.sales.currentExecution(
            this.db.client,
            intake.snapshot as unknown as SalesReservationRequestV1,
            actor.branchIds,
          );
    const ids = insurancePassengerIds(snapshot);
    const rows = await this.db.client.reservationInsurancePolicy.findMany({
      where: {
        contractId: intake.contractId,
        customerId: { in: ids },
      },
      orderBy: { customerId: 'asc' },
    });
    return { intake: { ...intake, snapshot }, ids, rows };
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
      selected: snapshot.serviceSelections.some(
        (service) => service.kind === 'INSURANCE',
      ),
      canPrepare: actor.permissions.includes('reservations.documents.manage'),
      total: ids.length,
      policies: ids.map((customerId) => {
        const p = rows.find((row) => row.customerId === customerId);
        return {
          id: p?.id ?? null,
          customerId,
          passengerName:
            snapshot.passengerAssignments?.find(
              (a) => a.customerId === customerId,
            )?.displayNameSnapshot ?? '',
          policyNumber: p?.status === 'ISSUED' ? p.policyNumber : null,
          status: p?.status ?? 'PENDING',
          error:
            intake.status === 'CANCELLED' ||
            intake.contract.status === 'CANCELLED'
              ? 'قرارداد ابطال شده است.'
              : p?.status === 'CANCELLED'
                ? 'بیمه‌نامه لغو شده است.'
                : p?.lastError ||
                  (!this.provider.configured()
                    ? 'اتصال بیمه‌گر روی سرور تنظیم نشده است.'
                    : !p
                      ? 'درخواست صدور برای این مسافر هنوز ثبت نشده است.'
                      : p.status !== 'ISSUED'
                        ? 'در انتظار پردازش درخواست بیمه‌گر.'
                        : !p.pdfUrl
                          ? 'فایل بیمه‌نامه هنوز از بیمه‌گر دریافت نشده است.'
                          : null),
          sandbox: p?.sandbox ?? true,
          ready:
            p?.status === 'ISSUED' &&
            Boolean(p.pdfUrl) &&
            intake.status !== 'CANCELLED' &&
            intake.contract.status !== 'CANCELLED',
        };
      }),
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

  async prepare(
    intakeId: string,
    actor: AuthenticatedActor,
    salesContractId?: string,
  ) {
    if (!actor.permissions.includes('reservations.documents.manage'))
      throw new ForbiddenException();
    const { intake } = await this.scoped(intakeId, actor, salesContractId);
    if (intake.status === 'CANCELLED' || intake.contract.status === 'CANCELLED')
      throw new ForbiddenException();
    await this.enqueue(intakeId);
    return this.summary(intakeId, actor, salesContractId);
  }
}
