import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  Inject,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  PartnerFinanceV1,
  PartnerPaymentV1,
  PartnerRoleV1,
  FinancePartnerExposurePortV1,
  B2bFinanceExposureV1,
} from '@nora/contracts';
import { DatabaseService } from '../../database/database.service';
import { MasterDataModule } from '../../master-data/master-data.module';
import { MasterOrganizationDirectory } from '../../master-data/master-organization-directory';
import { ProcurementModule } from '../../procurement/procurement.module';
import { ProcurementPublicService } from '../../procurement/procurement-public.service';
import { ReservationsRuntimeModule } from '../../reservations/reservations-runtime.module';
import { ReservationsPublicService } from '../../reservations/reservations-public.service';
import { IamModule } from '../../iam/iam.module';
import { AuthGuard } from '../../iam/auth.guard';
import { PermissionGuard } from '../../iam/permission.guard';
import { RequirePermissions } from '../../iam/iam.decorators';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { partnerFinanceTotals } from '../partner-finance.model';

/** Finance-owned operational payable projection, not a customer receipt or journal balance. */
@Injectable()
export class FinancePartnerService implements FinancePartnerExposurePortV1 {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(MasterOrganizationDirectory)
    private readonly directory: MasterOrganizationDirectory,
    @Inject(ReservationsPublicService)
    private readonly reservations: ReservationsPublicService,
    @Inject(ProcurementPublicService)
    private readonly procurement: ProcurementPublicService,
  ) {}

  async getPartnerExposure(
    query: {
      organizationId: string;
      branchId: string;
      role: PartnerRoleV1;
      currencyCode: string;
    },
    actor: AuthenticatedActor,
  ): Promise<B2bFinanceExposureV1> {
    const finance = await this.read(
      query.organizationId,
      query.role,
      query.branchId,
      actor,
    );
    if (finance.reconciliationRequired.length)
      return { status: 'UNAVAILABLE', reason: 'NO_EXPOSURE_SNAPSHOT' };
    const balance =
      finance.totals.find((row) => row.currencyCode === query.currencyCode)
        ?.balance ?? '0';
    return {
      status: 'AVAILABLE',
      amount: balance.startsWith('-') ? '0' : balance,
      currencyCode: query.currencyCode,
      observedAt: finance.observedAt,
      sourceVersion: 1,
    };
  }

  async read(
    organizationId: string,
    role: PartnerRoleV1,
    branchId: string,
    actor: AuthenticatedActor,
  ): Promise<PartnerFinanceV1> {
    if (
      !actor.permissions.includes('finance.read') ||
      !actor.permissions.includes('b2b.agency.read') ||
      !actor.branchIds.includes(branchId)
    )
      throw new ForbiddenException('مجوز پرونده مالی یا شعبه را ندارید.');
    if (role !== 'SUPPLIER' && role !== 'BROKER')
      throw new BadRequestException('نقش طرف همکاری معتبر نیست.');
    const refs = await this.directory.partnerFinanceReference(
      organizationId,
      role,
    );
    const [reservationSources, invoiceSources] = await Promise.all([
      this.reservations.partnerFinanceSources(
        branchId,
        refs.organizationPurchaseId,
        refs.brokerId,
      ),
      refs.supplierId
        ? this.procurement.partnerFinanceSources(branchId, refs.supplierId)
        : [],
    ]);
    const purchases = [...reservationSources, ...invoiceSources];
    // A legacy organization-only purchase carries no role. Adding another role
    // must not silently reclassify history or advertise extra available credit.
    const ambiguousPurchases = refs.ambiguousOrganizationRole
      ? role === 'SUPPLIER'
        ? reservationSources
        : await this.reservations.partnerFinanceSources(
            branchId,
            organizationId,
            null,
          )
      : [];
    const operational =
      await this.database.client.financeOperationalRequest.findMany({
        where: {
          branchId,
          counterpartyOrganizationId: organizationId,
          counterpartyRole: role,
        },
        include: { revisions: { orderBy: { version: 'desc' }, take: 1 } },
        orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
        take: 10001,
      });
    if (operational.length > 10000)
      throw new ConflictException(
        'تعداد درخواست‌های مالی از سقف گزارش امن بیشتر است.',
      );
    const [reservationPayments, invoicePayments] = await Promise.all([
      this.database.client.financeSupplierPaymentRevision.findMany({
        where: {
          purchaseId: { in: reservationSources.map((row) => row.id) },
          status: { in: ['PAID', 'PARTIALLY_PAID'] },
        },
        include: { paymentMethod: { select: { name: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.database.client.financeProcurementInvoiceRevision.findMany({
        where: {
          branchId,
          sourceId: { in: invoiceSources.map((row) => row.id) },
          paidAmount: { not: null },
          status: { in: ['PAID', 'PARTIALLY_PAID'] },
        },
        include: { paymentMethod: { select: { name: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    const sourceById = new Map(purchases.map((row) => [row.id, row]));
    const ownedInvoicePayments = invoicePayments.filter((row) => {
      const versions = sourceById.get(row.sourceId)?.ownedVersions;
      return !versions || versions.includes(row.sourceVersion);
    });
    if (
      ownedInvoicePayments.some(
        (row) =>
          row.sourceVersion !== sourceById.get(row.sourceId)?.sourceVersion ||
          (row.paymentCurrencyCode &&
            row.paymentCurrencyCode !==
              sourceById.get(row.sourceId)?.currencyCode),
      )
    )
      throw new ConflictException(
        'پرداخت به نسخه یا ارز متفاوت فاکتور مرتبط است؛ ابتدا تطبیق مالی انجام شود.',
      );
    const payments: PartnerPaymentV1[] = [
      ...reservationPayments.map((row) => ({
        id: row.id,
        purchaseId: row.purchaseId,
        amount:
          row.paidAmount?.toString() ??
          (row.status === 'PAID' && row.cumulativePaid === null
            ? sourceById.get(row.purchaseId)!.amount
            : '0'),
        currencyCode: sourceById.get(row.purchaseId)!.currencyCode,
        occurredAt: (row.transferAt ?? row.createdAt).toISOString(),
        reference: row.paymentReference,
        method: row.paymentMethod?.name ?? null,
      })),
      ...ownedInvoicePayments.map((row) => ({
        id: row.id,
        purchaseId: row.sourceId,
        amount: row.paidAmount!.toString(),
        currencyCode: sourceById.get(row.sourceId)!.currencyCode,
        occurredAt: (row.transferAt ?? row.createdAt).toISOString(),
        reference: row.paymentReference,
        method: row.paymentMethod?.name ?? null,
      })),
    ];
    return {
      version: 1,
      organizationId,
      role,
      branchId,
      creditDirection: 'COUNTERPARTY_TO_US',
      observedAt: new Date().toISOString(),
      purchases,
      payments,
      requests: operational.map((row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        reference: row.reference,
        amount: row.amount.toString(),
        currencyCode: row.currencyCode,
        status: row.status,
        dueAt: row.dueAt.toISOString(),
        remainingAmount: row.revisions[0]?.remainingAmount.toString() ?? null,
      })),
      settlements: purchases
        .filter((row) => row.current)
        .map((source) => {
          const total = partnerFinanceTotals(
            [source],
            payments.filter((row) => row.purchaseId === source.id),
          )[0]!;
          return {
            purchaseId: source.id,
            paid: total.paid,
            remaining: total.balance,
            status: total.balance.startsWith('-')
              ? 'CREDIT'
              : total.balance === '0'
                ? 'SETTLED'
                : total.paid === '0'
                  ? 'OPEN'
                  : 'PARTIALLY_PAID',
          };
        }),
      totals: partnerFinanceTotals(purchases, payments),
      reconciliationRequired: [
        ...new Set([
          ...ambiguousPurchases.map((row) => row.id),
          ...purchases
            .filter(
              (row) =>
                !row.current && payments.some((p) => p.purchaseId === row.id),
            )
            .map((row) => row.id),
          // Standalone operational payments have no purchase allocation. Never
          // deduct them from another ledger or advertise available credit.
          ...operational
            .filter(
              (row) => row.status === 'PAID' || row.status === 'PARTIALLY_PAID',
            )
            .map((row) => row.id),
        ]),
      ],
    };
  }
}

@Controller('finance/partners')
@UseGuards(AuthGuard, PermissionGuard)
export class FinancePartnerController {
  constructor(
    @Inject(FinancePartnerService)
    private readonly service: FinancePartnerService,
  ) {}
  @Get(':role/:organizationId')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('finance.read', 'b2b.agency.read')
  read(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('role') role: PartnerRoleV1,
    @Headers('x-branch-id') branchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.read(organizationId, role, branchId, req.actor);
  }
}

@Module({
  imports: [
    IamModule,
    MasterDataModule,
    ReservationsRuntimeModule,
    ProcurementModule,
  ],
  controllers: [FinancePartnerController],
  providers: [AuthGuard, PermissionGuard, FinancePartnerService],
  exports: [FinancePartnerService],
})
export class FinancePartnerModule {}
