import {
  parseAssistantReportFilters,
  type AssistantReportFilters,
} from '../sales/sales-assistant-filters';
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
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { DatabaseService } from '../database/database.service';
import { SalesAssistantConfirmationService } from '../sales/sales-assistant-confirmation.service';
import { salesAssistantWindows } from '../sales/sales-assistant-report';

@UseGuards(AuthGuard)
@Controller('customer-affairs/assistant')
export class CustomerAffairsAssistantController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(SalesAssistantConfirmationService)
    private readonly sales: SalesAssistantConfirmationService,
  ) {}
  @Get('call-conversion')
  @Header('Cache-Control', 'private, no-store')
  async conversion(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    if (Object.keys(query).length)
      throw new BadRequestException('ASSISTANT_FIXED_SCOPE');
    return this.conversionReport(request);
  }

  @Get('call-conversion/filtered')
  @Header('Cache-Control', 'private, no-store')
  async filtered(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    const now = new Date();
    const { filters, windows } = parseAssistantReportFilters(
      query,
      request.actor,
      now,
    );
    if (filters.originId || filters.destinationId)
      throw new BadRequestException('ASSISTANT_ROUTE_COHORT_UNAVAILABLE');
    const report = await this.conversionReport(request, filters, windows, now);
    return {
      ...report,
      version: 2,
      source: 'customer-affairs.assistant.call-conversion.v2',
      filters,
    };
  }

  private async conversionReport(
    request: AuthenticatedRequest,
    filters?: AssistantReportFilters,
    requestedWindows?: ReturnType<typeof salesAssistantWindows>,
    now = new Date(),
  ) {
    const actor = request.actor;
    if (
      !['customer_affairs.lead.read', 'sales.contracts.read.all'].every(
        (permission) => actor.permissions.includes(permission as never),
      )
    )
      throw new ForbiddenException('ASSISTANT_COHORT_READ_REQUIRED');
    const windows = requestedWindows ?? salesAssistantWindows(now);
    const branchIds = filters?.branchId ? [filters.branchId] : actor.branchIds;
    const periods = [];
    let lastUpdate: Date | null = null;
    for (const window of [windows.current, windows.previous]) {
      const callWhere = {
        type: 'CALL',
        occurredAt: {
          gte: new Date(window.startUtc),
          lt: new Date(window.endUtc),
        },
      };
      const leads = await this.database.client.customerAffairsLead.findMany({
        where: {
          branchId: { in: branchIds },
          timeline: { some: callWhere },
        },
        select: {
          id: true,
          updatedAt: true,
          timeline: {
            where: callWhere,
            select: { occurredAt: true },
            orderBy: { occurredAt: 'asc' },
            take: 1,
          },
          handoffs: {
            where: {
              status: 'ACCEPTED',
              respondedAt: { lte: now },
              salesContractId: { not: null },
            },
            select: { salesContractId: true, updatedAt: true },
            take: 101,
          },
        },
        orderBy: { id: 'asc' },
        take: 5001,
      });
      if (
        leads.length > 5000 ||
        leads.some((lead) => lead.handoffs.length > 100)
      )
        throw new ConflictException('SALES_SOURCE_CAP_EXCEEDED');
      const ids = [
        ...new Set(
          leads.flatMap((lead) =>
            lead.handoffs.map((handoff) => handoff.salesContractId!),
          ),
        ),
      ];
      if (ids.length > 5000)
        throw new ConflictException('SALES_SOURCE_CAP_EXCEEDED');
      const confirmed = await this.sales.assistantConfirmedContracts(
        ids,
        actor,
        now,
      );
      const confirmations = new Map(
        confirmed.map((contract) => [contract.id, contract.confirmedAt]),
      );
      const converted = leads.filter((lead) =>
        lead.handoffs.some((handoff) => {
          const at = confirmations.get(handoff.salesContractId!);
          return at && lead.timeline[0] && at >= lead.timeline[0].occurredAt;
        }),
      ).length;
      for (const date of [
        ...leads.flatMap((lead) => [
          lead.updatedAt,
          ...lead.handoffs.map((handoff) => handoff.updatedAt),
        ]),
        ...confirmed.map((contract) => contract.updatedAt),
      ])
        if (!lastUpdate || date > lastUpdate) lastUpdate = date;
      periods.push({
        ...window,
        contactedLeads: leads.length,
        convertedLeads: converted,
        conversionBasisPoints: leads.length
          ? Math.round((converted * 10000) / leads.length)
          : null,
      });
    }
    return {
      version: 1,
      source: 'customer-affairs.assistant.call-conversion.v1',
      scope: 'AUTHORIZED_BRANCHES',
      branchCount: branchIds.length,
      timeZone: 'Asia/Tehran',
      observedAt: now.toISOString(),
      sourceUpdatedAt: lastUpdate?.toISOString() ?? null,
      current: periods[0],
      previous: periods[1],
      basis:
        'UNIQUE_LEADS_WITH_LOGGED_CALL_TO_ACCEPTED_CONFIRMED_CONTRACT_AS_OF_REQUEST',
      coverage: {
        rowLimitPerPeriod: 5000,
        answeredCallVerified: false,
        attributionComplete: false,
      },
    };
  }
}
