import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  InsuranceStandaloneInputV1,
} from '@nora/contracts';
import Joi from 'joi';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../../database/database.service';
import { InsuranceSettingsService } from '../../integrations/insurance/insurance-settings';
import { TravisSandboxService } from '../../integrations/insurance/travis-sandbox.service';
import { InsuranceApplicantCrypto } from './insurance-applicant.crypto';
import {
  draftSchema,
  lockInsurancePolicy,
  validateInsuranceDates,
} from './insurance.service';
import { CustomerInsuranceIdentity } from '../../customers/customer-insurance-identity';

const schema = draftSchema
  .fork(['intakeId', 'customerId'], () => Joi.forbidden())
  .append({
    branchId: Joi.string().uuid().required(),
    requestKey: Joi.string().uuid().required(),
    sourceCountryCode: Joi.string()
      .pattern(/^\d{1,10}$/)
      .required(),
    passenger: draftSchema.extract('passenger').required(),
  });
export function parseStandaloneInsurance(
  raw: unknown,
): InsuranceStandaloneInputV1 {
  const result = schema.validate(raw, { convert: false });
  if (result.error)
    throw new BadRequestException('اطلاعات درخواست بیمه معتبر نیست.');
  const input = result.value as InsuranceStandaloneInputV1;
  validateInsuranceDates(input);
  return input;
}

@Injectable()
export class StandaloneInsuranceService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(InsuranceSettingsService)
    private readonly settings: InsuranceSettingsService,
    @Inject(InsuranceApplicantCrypto)
    private readonly crypto: InsuranceApplicantCrypto,
    @Inject(TravisSandboxService)
    private readonly provider: TravisSandboxService,
    @Inject(CustomerInsuranceIdentity)
    private readonly identities: CustomerInsuranceIdentity,
  ) {}
  private authorize(actor: AuthenticatedActor, write = false) {
    if (
      !actor.permissions.includes('reservations.read') ||
      !actor.permissions.includes('customers.read') ||
      (write && !actor.permissions.includes('reservations.documents.manage'))
    )
      throw new ForbiddenException();
  }
  private async row(id: string, actor: AuthenticatedActor, write = false) {
    this.authorize(actor, write);
    const row = await this.db.client.reservationInsurancePolicy.findFirst({
      where: { id, applicant: { branchId: { in: [...actor.branchIds] } } },
      include: { applicant: true },
    });
    if (!row?.applicant) throw new NotFoundException();
    return { ...row, applicant: row.applicant };
  }
  async read(id: string, actor: AuthenticatedActor) {
    const row = await this.row(id, actor, true),
      applicant = row.applicant;
    const passenger = this.crypto.open(
      applicant.id,
      applicant.branchId,
      applicant.encryptedData,
    );
    await this.db.client.reservationInsuranceApplicantAccess.create({
      data: {
        applicantId: applicant.id,
        actorUserId: actor.userId,
        action: 'CORRECTION_READ',
      },
    });
    return {
      data: {
        branchId: applicant.branchId,
        requestKey: applicant.requestKey,
        sourceCountryCode: applicant.sourceCountryCode,
        destinationCode: row.destinationCode,
        planCode: row.planCode,
        departureDate: row.departureDate.toISOString().slice(0, 10),
        durationDays: row.durationDays,
        notes: row.notes,
        expectedVersion: row.version,
        passenger: { ...passenger, version: row.version },
      } satisfies InsuranceStandaloneInputV1,
    };
  }
  async save(raw: unknown, actor: AuthenticatedActor, id?: string) {
    this.authorize(actor, true);
    const input = parseStandaloneInsurance(raw);
    this.identities.validateApplicant(input.passenger);
    if (!actor.branchIds.includes(input.branchId))
      throw new ForbiddenException();
    const [settings, catalog] = await Promise.all([
      this.settings.read(input.branchId, actor),
      this.settings.issuanceCatalog(input.branchId, actor),
    ]);
    if (!catalog.durations.some((d) => d.days === input.durationDays))
      throw new BadRequestException(
        'مدت بیمه را از فهرست مجاز بیمه‌گر انتخاب کنید.',
      );
    if (
      !catalog.countries.some((c) => String(c.id) === input.sourceCountryCode)
    )
      throw new BadRequestException('کشور مبدا معتبر نیست.');
    const country = settings.config.countries.find(
      (c) => c.active && c.providerCountryCode === input.destinationCode,
    );
    if (
      !country?.plans.some((p) => p.providerPlanCode === input.planCode) ||
      !catalog.plans.some((p) => String(p.id) === input.planCode)
    )
      throw new BadRequestException(
        'کشور و طرح فعال بیمه را در تنظیمات انتخاب کنید.',
      );
    const fingerprint = this.crypto.fingerprint(input.requestKey, input);
    return this.db.client.$transaction(async (tx) => {
      await lockInsurancePolicy(tx, 'standalone', input.requestKey);
      if (id)
        await tx.$queryRaw(
          Prisma.sql`SELECT p.id FROM reservation_insurance_policies p JOIN reservation_insurance_applicants a ON a.id = p."applicantId" WHERE p.id = ${id}::uuid AND a."branchId" = ${input.branchId}::uuid FOR UPDATE OF p`,
        );
      const existing = await tx.reservationInsuranceApplicant.findUnique({
        where: { requestKey: input.requestKey },
        include: { policy: true },
      });
      if (!id && existing) {
        if (
          existing.branchId !== input.branchId ||
          existing.requestFingerprint !== fingerprint ||
          !existing.policy
        )
          throw new ConflictException(
            'شناسه درخواست بیمه قبلاً استفاده شده است.',
          );
        return {
          data: {
            id: existing.policy.id,
            status: existing.policy.status,
            version: existing.policy.version,
          },
        };
      }
      const current = id
        ? await tx.reservationInsurancePolicy.findFirst({
            where: {
              id,
              applicant: {
                requestKey: input.requestKey,
                branchId: input.branchId,
              },
            },
            include: { applicant: true },
          })
        : null;
      if (id && !current?.applicant) throw new NotFoundException();
      if ((current?.version ?? 0) !== input.expectedVersion)
        throw new ConflictException(
          'اطلاعات بیمه تغییر کرده است؛ دوباره دریافت کنید.',
        );
      const state = current?.automation as {
        phase?: string;
        fingerprint?: string;
        firstError?: string;
      } | null;
      if (
        current &&
        (!['DRAFT', 'INPUT_ERROR', 'PROVIDER_ERROR'].includes(current.status) ||
          current.providerId ||
          state?.fingerprint ||
          (state?.phase && state.phase !== 'QUEUED') ||
          (current.processingUntil && current.processingUntil > new Date()))
      )
        throw new ConflictException(
          'درخواست نزد بیمه‌گر در حال بررسی است؛ پیش از اصلاح، نتیجه ارسال قبلی باید مشخص شود.',
        );
      const applicantId = current?.applicantId ?? randomUUID();
      const applicantData = {
        displayName: [
          input.passenger.firstNameLatin,
          input.passenger.lastNameLatin,
        ].join(' '),
        encryptedData: this.crypto.seal(
          applicantId,
          input.branchId,
          input.passenger,
        ),
        sourceCountryCode: input.sourceCountryCode,
      };
      if (current)
        await tx.reservationInsuranceApplicant.update({
          where: { id: applicantId },
          data: applicantData,
        });
      else
        await tx.reservationInsuranceApplicant.create({
          data: {
            id: applicantId,
            branchId: input.branchId,
            createdByUserId: actor.userId,
            requestKey: input.requestKey,
            requestFingerprint: fingerprint,
            ...applicantData,
          },
        });
      const values = {
        destinationCode: input.destinationCode,
        planCode: input.planCode,
        departureDate: new Date(input.departureDate + 'T00:00:00Z'),
        durationDays: input.durationDays,
        notes: input.notes,
        status: 'DRAFT',
        automatic: true,
        sandbox: true,
        automation: { phase: 'QUEUED', useDraft: true },
        nextAttemptAt: new Date(),
        lastError: null,
        version: (current?.version ?? 0) + 1,
      };
      const saved = current
        ? await tx.reservationInsurancePolicy.update({
            where: { id: current.id, version: current.version },
            data: values,
          })
        : await tx.reservationInsurancePolicy.create({
            data: { ...values, applicantId },
          });
      await tx.reservationInsuranceRevision.create({
        data: {
          policyId: saved.id,
          version: saved.version,
          actorUserId: actor.userId,
          action: current ? 'DRAFT_SAVED' : 'STANDALONE_CREATED',
          snapshot: {
            status: saved.status,
            standalone: true,
            previousError: current?.lastError ?? null,
          },
        },
      });
      return {
        data: { id: saved.id, status: saved.status, version: saved.version },
      };
    });
  }
  async pdf(id: string, actor: AuthenticatedActor) {
    const row = await this.row(id, actor);
    if (row.status !== 'ISSUED' || !row.pdfUrl)
      throw new ConflictException(
        'بیمه‌نامه‌های مسافران هنوز آماده دریافت نیستند.',
      );
    return {
      bytes: await this.provider.policyPdf(row.pdfUrl),
      type: 'application/pdf',
      filename: `insurance-${row.id}.pdf`,
    };
  }
}
