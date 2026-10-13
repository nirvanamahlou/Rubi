import {
  parseAssistantReportFilters,
  type AssistantReportFilters,
} from './sales-assistant-filters';
import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Optional,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { DatabaseService } from '../database/database.service';
import { MasterDataService } from '../master-data/master-data.service';
import { IamFinanceDirectory } from '../iam/iam-finance-directory';
import { buildAssistantBalances } from './sales-assistant-balances';
import {
  buildSalesAssistantReport,
  SALES_ASSISTANT_LIMIT,
  SALES_ASSISTANT_STATUSES,
  salesAssistantWindows,
} from './sales-assistant-report';

@UseGuards(AuthGuard)
@Controller('sales/assistant')
export class SalesAssistantController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Optional()
    @Inject(MasterDataService)
    private readonly references?: MasterDataService,
    @Optional()
    @Inject(IamFinanceDirectory)
    private readonly directory?: IamFinanceDirectory,
  ) {}

  @Get('filter-options')
  @Header('Cache-Control', 'private, no-store')
  async filterOptions(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    if (Object.keys(query).length)
      throw new BadRequestException('ASSISTANT_FIXED_SCOPE');
    if (!request.actor.permissions.includes('sales.contracts.read.all'))
      throw new ForbiddenException('SALES_ALL_READ_REQUIRED');
    const rows = await this.database.client.salesContract.findMany({
      select: { originId: true, destinationId: true },
      distinct: ['originId', 'destinationId'],
      orderBy: [{ originId: 'asc' }, { destinationId: 'asc' }],
      take: 101,
    });
    const ids = [
      ...new Set(
        rows.slice(0, 100).flatMap((row) => [row.originId, row.destinationId]),
      ),
    ];
    const cities: { id: string; name: string }[] = [];
    // Bounded source lookup; never expose contract/customer rows as picker options.
    let index = 0;
    await Promise.all(
      Array.from({ length: Math.min(8, ids.length) }, async () => {
        while (index < ids.length) {
          const id = ids[index++]!;
          try {
            const city = await this.references?.detail('cities', id);
            if (typeof city?.data.name === 'string')
              cities.push({ id, name: city.data.name.slice(0, 200) });
          } catch {
            /* Missing names are disclosed in coverage. */
          }
        }
      }),
    );
    const branches = this.directory
      ? await this.directory.branches(request.actor.branchIds)
      : [];
    return {
      version: 2,
      source: 'sales.assistant.filter-options.v2',
      observedAt: new Date().toISOString(),
      cities: cities.sort((a, b) => a.name.localeCompare(b.name)),
      branches: branches.map(({ id, name }) => ({ id, name })),
      incomplete:
        rows.length > 100 || cities.length !== ids.length || !this.directory,
    };
  }

  @Get('contract-balances')
  @Header('Cache-Control', 'private, no-store')
  async balances(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    if (Object.keys(query).length)
      throw new BadRequestException('ASSISTANT_FIXED_SCOPE');
    if (
      !['sales.contracts.read.all', 'sales.payments.read'].every((permission) =>
        request.actor.permissions.includes(permission as never),
      )
    )
      throw new ForbiddenException('SALES_BALANCE_READ_REQUIRED');
    return this.balanceReport();
  }

  @Get('contract-balances/filtered')
  @Header('Cache-Control', 'private, no-store')
  async filteredBalances(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    if (
      !['sales.contracts.read.all', 'sales.payments.read'].every((permission) =>
        request.actor.permissions.includes(permission as never),
      )
    )
      throw new ForbiddenException('SALES_BALANCE_READ_REQUIRED');
    const { filters } = parseAssistantReportFilters(
      query,
      request.actor,
      new Date(),
    );
    const report = await this.balanceReport(filters);
    return {
      ...report,
      version: 2,
      source: 'sales.assistant.contract-balances.v2',
      filters,
      dateBasis: 'CURRENT_AS_OF_REQUEST',
    };
  }

  private async balanceReport(filters?: AssistantReportFilters) {
    const now = new Date();
    const facts = await this.database.client.salesContract.findMany({
      where: {
        ...(filters?.branchId ? { branchId: filters.branchId } : {}),
        ...(filters?.originId ? { originId: filters.originId } : {}),
        ...(filters?.destinationId
          ? { destinationId: filters.destinationId }
          : {}),
        status: { in: [...SALES_ASSISTANT_STATUSES] },
        confirmedAt: { not: null, lte: now },
      },
      select: {
        id: true,
        contractNumber: true,
        updatedAt: true,
        priceComponents: {
          select: { type: true, title: true, amount: true, currencyCode: true },
        },
        payments: {
          select: {
            amount: true,
            currencyCode: true,
            status: true,
            updatedAt: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: SALES_ASSISTANT_LIMIT + 1,
    });
    if (facts.length > SALES_ASSISTANT_LIMIT)
      throw new ConflictException('SALES_SOURCE_CAP_EXCEEDED');
    return buildAssistantBalances(
      facts.map((fact) => ({
        ...fact,
        updatedAt: new Date(
          Math.max(
            fact.updatedAt.getTime(),
            ...fact.payments.map((payment) => payment.updatedAt.getTime()),
          ),
        ),
        priceComponents: fact.priceComponents.map((row) => ({
          ...row,
          amount: row.amount.toString(),
        })),
        payments: fact.payments.map((row) => ({
          ...row,
          amount: row.amount.toString(),
        })),
      })),
      now,
    );
  }

  @Get('weekly')
  @Header('Cache-Control', 'private, no-store')
  async weekly(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    if (Object.keys(query).length)
      throw new BadRequestException('ASSISTANT_FIXED_SCOPE');
    if (!request.actor.permissions.includes('sales.contracts.read.all'))
      throw new ForbiddenException('SALES_ALL_READ_REQUIRED');
    return this.salesReport();
  }

  @Get('report')
  @Header('Cache-Control', 'private, no-store')
  async filtered(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    if (!request.actor.permissions.includes('sales.contracts.read.all'))
      throw new ForbiddenException('SALES_ALL_READ_REQUIRED');
    const now = new Date();
    const { filters, windows } = parseAssistantReportFilters(
      query,
      request.actor,
      now,
    );
    const report = await this.salesReport(filters, windows, now);
    return {
      ...report,
      version: 2,
      source: 'sales.assistant.report.v2',
      filters,
    };
  }

  private async salesReport(
    filters?: AssistantReportFilters,
    requestedWindows?: ReturnType<typeof salesAssistantWindows>,
    now = new Date(),
  ) {
    const windows = requestedWindows ?? salesAssistantWindows(now);
    // Sales owns these tables. No Reporting demo table or cross-domain table is read.
    const facts = await this.database.client.salesContract.findMany({
      where: {
        ...(filters?.branchId ? { branchId: filters.branchId } : {}),
        ...(filters?.originId ? { originId: filters.originId } : {}),
        ...(filters?.destinationId
          ? { destinationId: filters.destinationId }
          : {}),
        status: { in: [...SALES_ASSISTANT_STATUSES] },
        confirmedAt: { not: null, lte: now },
        createdAt: {
          gte: new Date(windows.previous.startUtc),
          lt: new Date(windows.current.endUtc),
        },
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        confirmedAt: true,
        status: true,
        originId: true,
        destinationId: true,
        _count: { select: { passengers: true } },
        priceComponents: {
          select: { type: true, title: true, amount: true, currencyCode: true },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: SALES_ASSISTANT_LIMIT + 1,
    });
    if (facts.length > SALES_ASSISTANT_LIMIT)
      throw new ConflictException('SALES_SOURCE_CAP_EXCEEDED');
    const report = buildSalesAssistantReport(
      facts.map((fact) => ({
        ...fact,
        priceComponents: fact.priceComponents?.map((row) => ({
          ...row,
          amount: row.amount.toString(),
        })),
      })),
      now,
      windows,
    );
    const names = new Map<string, string | null>();
    const cityIds = [
      ...new Set(facts.flatMap((fact) => [fact.originId, fact.destinationId])),
    ].slice(0, 100);
    let index = 0;
    await Promise.all(
      Array.from({ length: Math.min(8, cityIds.length) }, async () => {
        while (index < cityIds.length) {
          const id = cityIds[index++]!;
          try {
            const city = await this.references?.detail('cities', id);
            const name = city?.data.name;
            names.set(
              id,
              typeof name === 'string' && name.trim()
                ? name.slice(0, 200)
                : null,
            );
          } catch {
            names.set(id, null);
          }
        }
      }),
    );
    const named = (period: typeof report.current) => ({
      ...period,
      routes: period.routes.map((route) => ({
        ...route,
        originName: names.get(route.originId) ?? null,
        destinationName: names.get(route.destinationId) ?? null,
      })),
    });
    const current = named(report.current),
      previous = named(report.previous);
    return {
      ...report,
      current,
      previous,
      routeNamesComplete: [...current.routes, ...previous.routes].every(
        (route) => route.originName !== null && route.destinationName !== null,
      ),
    };
  }
}
