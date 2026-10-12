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
  ) {}

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
    const now = new Date();
    const windows = salesAssistantWindows(now);
    // Sales owns these tables. No Reporting demo table or cross-domain table is read.
    const facts = await this.database.client.salesContract.findMany({
      where: {
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
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: SALES_ASSISTANT_LIMIT + 1,
    });
    if (facts.length > SALES_ASSISTANT_LIMIT)
      throw new ConflictException('SALES_SOURCE_CAP_EXCEEDED');
    const report = buildSalesAssistantReport(facts, now);
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
