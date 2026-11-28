import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@nora/database';
import { canViewScreen, type AuthenticatedActor } from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { ContractCompanyScope } from '../sales/contract-company-scope.public';
import { readSettledHotelContracts } from '../sales/settled-hotel-contracts.public';
import {
  readVoucherCoverage,
  stayVoucherStatus,
  type VoucherEvidence,
} from '../reservations/voucher-coverage.public';
import { buildIssuedTicketWorkbook } from '../reservations/issued-ticket-workbook';

function authorize(actor: AuthenticatedActor, exporting: boolean) {
  const permissions: readonly string[] = actor.permissions;
  if (
    (exporting &&
      (!permissions.includes('finance.export') ||
        !permissions.includes('reporting.export'))) ||
    !actor.permissions.includes('finance.read') ||
    !actor.permissions.includes('finance.financial_release.read') ||
    !actor.permissions.includes('reservations.read') ||
    !canViewScreen(actor.permissions, 'finance.delivery') ||
    !canViewScreen(actor.permissions, 'reservations.home')
  )
    throw new ForbiddenException();
}

function positive(value: string | undefined, fallback: number, max: number) {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(n) || n > max)
    throw new BadRequestException();
  return n;
}

export function pendingVoucherPage(
  contracts: Awaited<ReturnType<typeof readSettledHotelContracts>>,
  evidence: VoucherEvidence[],
  page: number,
  pageSize: number,
) {
  const byId = new Map(evidence.map((e) => [e.contractId, e]));
  const rows: {
    contractId: string;
    contractNumber: string;
    intakeId: string;
    stayKey: string;
    hotelName: string;
    checkInDate: string;
    checkOutDate: string;
  }[] = [];
  let total = 0,
    unknownStayCount = 0;
  for (const c of contracts) {
    const e = byId.get(c.contractId);
    if (!e || e.branchId !== c.branchId || e.supplierStatus === 'CANCELLED')
      continue;
    for (const stay of c.stays) {
      const status = stayVoucherStatus(stay, e);
      // Floating vouchers can be opened without a recorded issuance transition.
      if (status === 'unknown' || (c.floating && status === 'missing')) {
        unknownStayCount++;
        continue;
      }
      if (status !== 'missing') continue;
      if (total >= (page - 1) * pageSize && rows.length < pageSize)
        rows.push({
          contractId: c.contractId,
          contractNumber: c.contractNumber,
          intakeId: e.intakeId,
          stayKey: stay.key,
          hotelName: stay.hotelName,
          checkInDate: stay.checkInDate,
          checkOutDate: stay.checkOutDate,
        });
      total++;
    }
  }
  return { page, pageSize, total, unknownStayCount, rows };
}

@Controller('reports/nora')
@UseGuards(AuthGuard)
export class SettledVouchersController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(IamService) private readonly iam: IamService,
    @Inject(ContractCompanyScope)
    private readonly companies: ContractCompanyScope,
  ) {}

  @Get('settled-vouchers')
  @Header('Cache-Control', 'private, no-store')
  async report(
    @Req() req: AuthenticatedRequest,
    @Query('page') inputPage?: string,
    @Query('pageSize') inputSize?: string,
  ) {
    const page = positive(inputPage, 1, 100000),
      pageSize = positive(inputSize, 10, 50);
    return this.read(req.actor, page, pageSize);
  }

  @Get('settled-vouchers/export')
  @Header('Cache-Control', 'private, no-store')
  async export(@Req() req: AuthenticatedRequest) {
    const { rows, total, unknownStayCount } = await this.read(
      req.actor,
      1,
      10000,
      true,
    );
    if (total !== rows.length)
      throw new ConflictException('REPORT_EXPORT_LIMIT');
    return new StreamableFile(
      buildIssuedTicketWorkbook(
        rows.map((r) => [
          r.contractNumber,
          r.hotelName,
          r.checkInDate,
          r.checkOutDate,
        ]),
        ['شماره قرارداد', 'هتل', 'تاریخ ورود', 'تاریخ خروج'],
        [
          ['تعداد', String(total)],
          ['وضعیت نامشخص', String(unknownStayCount)],
        ],
      ),
      {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        disposition: 'attachment; filename="settled-pending-vouchers.xlsx"',
      },
    );
  }

  private async read(
    actor: AuthenticatedActor,
    page: number,
    pageSize: number,
    exporting = false,
  ) {
    authorize(actor, exporting);
    const company = await this.companies.selected(actor);
    const observedAt = new Date().toISOString();
    const result = await this.database.client.$transaction(
      async (tx) => {
        const contracts = await readSettledHotelContracts(
          tx,
          actor.branchIds,
          company,
        );
        const evidence = await readVoucherCoverage(
          tx,
          contracts.map((c) => c.contractId),
        );
        return pendingVoucherPage(contracts, evidence, page, pageSize);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const current = await this.iam.authenticateSessionReferenceV1(
      actor.userId,
      actor.sessionId,
    );
    authorize(current, exporting);
    if (
      company !== (await this.companies.selected(current)) ||
      actor.branchIds.some((id) => !current.branchIds.includes(id))
    )
      throw new ForbiddenException();
    return { version: 1, observedAt, ...result };
  }
}
