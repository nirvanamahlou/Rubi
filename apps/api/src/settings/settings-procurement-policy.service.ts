import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  ProcurementApprovalPolicyCreateV1,
  ProcurementApprovalPolicyStepV1,
  ProcurementApprovalPolicyV1,
  ProcurementDraftV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { SettingsRuntimeService } from './settings-runtime.service';

const amountPattern = /^(0|[1-9]\d{0,19})(\.\d{1,4})?$/;

@Injectable()
export class SettingsProcurementPolicyService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Optional()
    @Inject(SettingsRuntimeService)
    private readonly runtime?: SettingsRuntimeService,
  ) {}

  async resolve(
    draft: ProcurementDraftV1,
  ): Promise<ProcurementApprovalPolicyV1 | null> {
    if (!draft.unitId || !draft.currencyCode) return null;
    const row =
      await this.database.client.settingsProcurementApprovalPolicy.findFirst({
        where: {
          branchId: draft.branchId,
          unitId: draft.unitId,
          category: draft.category,
          currencyCode: draft.currencyCode,
          isActive: true,
        },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      });
    if (!row) return null;
    const policy = this.present(row);
    if (!this.runtime) return policy;

    const approval = await this.runtime.json<{
      ceiling?: unknown;
      currency?: unknown;
    }>('procurement', 'approval', { branchId: draft.branchId }, {});
    const currency = String(approval.value.currency ?? '').trim();
    const ceiling = decimalOrNull(approval.value.ceiling);
    return {
      ...policy,
      ...(currency === draft.currencyCode && ceiling
        ? { maximumAmount: ceiling }
        : {}),
    };
  }

  async list(actor: AuthenticatedActor) {
    this.manage(actor);
    const rows =
      await this.database.client.settingsProcurementApprovalPolicy.findMany({
        where: { branchId: { in: [...actor.branchIds] } },
        orderBy: [
          { branchId: 'asc' },
          { unitId: 'asc' },
          { category: 'asc' },
          { currencyCode: 'asc' },
          { version: 'desc' },
        ],
        take: 500,
      });
    return rows.map((row) => this.present(row));
  }

  async create(
    input: ProcurementApprovalPolicyCreateV1,
    actor: AuthenticatedActor,
  ) {
    this.manage(actor);
    const value = this.validate(input, actor);
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`${value.branchId}:${value.unitId}:${value.category}:${value.currencyCode}`}, 0))`,
      );
      const current = await tx.settingsProcurementApprovalPolicy.findFirst({
        where: {
          branchId: value.branchId,
          unitId: value.unitId,
          category: value.category,
          currencyCode: value.currencyCode,
        },
        orderBy: { version: 'desc' },
      });
      await tx.settingsProcurementApprovalPolicy.updateMany({
        where: {
          branchId: value.branchId,
          unitId: value.unitId,
          category: value.category,
          currencyCode: value.currencyCode,
          isActive: true,
        },
        data: { isActive: false },
      });
      const row = await tx.settingsProcurementApprovalPolicy.create({
        data: {
          branchId: value.branchId,
          unitId: value.unitId,
          category: value.category,
          currencyCode: value.currencyCode,
          maximumAmount: new Prisma.Decimal(value.maximumAmount),
          allowUnknownEstimate: value.allowUnknownEstimate,
          emergencyAllowed: value.emergencyAllowed,
          minimumQuotations: value.minimumQuotations,
          singleSourceAllowed: value.singleSourceAllowed,
          steps: value.steps,
          version: (current?.version ?? 0) + 1,
          createdByUserId: actor.userId,
        },
      });
      return this.present(row);
    });
  }

  async deactivate(id: string, actor: AuthenticatedActor) {
    this.manage(actor);
    const row =
      await this.database.client.settingsProcurementApprovalPolicy.findFirst({
        where: { id, branchId: { in: [...actor.branchIds] } },
      });
    if (!row) throw new NotFoundException('سیاست خرید یافت نشد.');
    if (!row.isActive)
      throw new ConflictException('سیاست خرید قبلاً غیرفعال شده است.');
    const updated =
      await this.database.client.settingsProcurementApprovalPolicy.update({
        where: { id },
        data: { isActive: false },
      });
    return this.present(updated);
  }

  private manage(actor: AuthenticatedActor) {
    if (!actor.permissions.includes('procurement.settings.manage'))
      throw new ForbiddenException('مجوز تنظیم سیاست خرید وجود ندارد.');
  }

  private validate(
    input: ProcurementApprovalPolicyCreateV1,
    actor: AuthenticatedActor,
  ) {
    const steps = Array.isArray(input?.steps) ? input.steps : [];
    if (
      input?.version !== 1 ||
      !actor.branchIds.includes(input.branchId) ||
      !input.unitId?.trim() ||
      input.unitId.trim().length > 160 ||
      !input.category?.trim() ||
      input.category.trim().length > 160 ||
      !/^[A-Z]{3}$/.test(input.currencyCode) ||
      !amountPattern.test(input.maximumAmount) ||
      !Number.isSafeInteger(input.minimumQuotations) ||
      input.minimumQuotations < 1 ||
      steps.length < 1 ||
      steps.length > 12 ||
      steps.some((step) => !this.validStep(step))
    )
      throw new BadRequestException('سیاست تأیید خرید معتبر نیست.');
    const uniqueApprovers = new Set(steps.map((step) => step.userId));
    if (uniqueApprovers.size !== steps.length)
      throw new BadRequestException('تأییدکننده تکراری است.');
    return {
      ...input,
      unitId: input.unitId.trim(),
      category: input.category.trim(),
      steps,
    };
  }

  private validStep(step: ProcurementApprovalPolicyStepV1) {
    return (
      typeof step?.userId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        step.userId,
      ) &&
      amountPattern.test(step.maximumAmount) &&
      step.permission === 'procurement.approve'
    );
  }

  private present(row: {
    id: string;
    version: number;
    branchId: string;
    unitId: string;
    category: string;
    currencyCode: string;
    maximumAmount: { toString(): string };
    allowUnknownEstimate: boolean;
    emergencyAllowed: boolean;
    minimumQuotations: number;
    singleSourceAllowed: boolean;
    steps: unknown;
    approvedAt: Date;
    isActive: boolean;
  }): ProcurementApprovalPolicyV1 {
    return {
      contract: 'settings.procurement-approval-policy.v1',
      id: row.id,
      version: row.version,
      branchId: row.branchId,
      unitId: row.unitId,
      category: row.category,
      currencyCode: row.currencyCode,
      maximumAmount: row.maximumAmount.toString(),
      allowUnknownEstimate: row.allowUnknownEstimate,
      emergencyAllowed: row.emergencyAllowed,
      minimumQuotations: row.minimumQuotations,
      singleSourceAllowed: row.singleSourceAllowed,
      steps: row.steps as ProcurementApprovalPolicyStepV1[],
      approvedAt: row.approvedAt.toISOString(),
      isActive: row.isActive,
    };
  }
}

function decimalOrNull(value: unknown): string | null {
  const candidate =
    typeof value === 'string' ? value.trim() : String(value ?? '');
  return amountPattern.test(candidate) ? candidate : null;
}
