import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Post,
  Req,
  ServiceUnavailableException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { canViewRoute } from '@nora/contracts';
import { createHash } from 'node:crypto';
import { AuthGuard, readCookie } from '../../iam/auth.guard';
import { IamService } from '../../iam/iam.service';
import { ACCESS_COOKIE } from '../../iam/iam.constants';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { ContractCompanyScope } from '../contract-company-scope.public';
import {
  AGENT_CATALOG_VERSION,
  AGENT_SOURCES,
  allowedSources,
} from './catalog';
import { SalesAgentQueryService, type AgentScope } from './query.service';

@UseGuards(AuthGuard)
@Controller('sales/assistant-agent')
export class SalesAgentController {
  constructor(
    @Inject(ContractCompanyScope)
    private readonly companies: ContractCompanyScope,
    @Inject(SalesAgentQueryService)
    private readonly queries: SalesAgentQueryService,
    @Inject(IamService) private readonly iam: IamService,
  ) {}

  private async context(request: AuthenticatedRequest) {
    if (process.env.ASSISTANT_AGENT_ENABLED !== 'true')
      throw new ServiceUnavailableException('AGENT_DISABLED');
    const token = readCookie(request, ACCESS_COOKIE);
    if (!token) throw new ForbiddenException();
    const actor = await this.iam.authenticate(decodeURIComponent(token));
    if (
      actor.userId !== request.actor.userId ||
      !canViewRoute(actor.permissions, '/sales')
    )
      throw new ForbiddenException();
    const has = (permission: string) =>
      actor.permissions.some((value) => value === permission);
    const mode = has('sales.contracts.read.all')
      ? 'all'
      : has('sales.contracts.read.branch')
        ? 'branch'
        : has('sales.contracts.read.own')
          ? 'own'
          : undefined;
    if (!mode) throw new ForbiddenException('SALES_READ_REQUIRED');
    const scope: AgentScope = {
      userId: actor.userId,
      branchIds: [...actor.branchIds].sort(),
      mode,
      companyId: await this.companies.selected(actor),
      payments: has('sales.payments.read'),
    };
    const contextId = createHash('sha256')
      .update(
        JSON.stringify({ scope, permissions: [...actor.permissions].sort() }),
      )
      .digest('hex');
    return { scope, contextId, sources: allowedSources(scope.payments) };
  }

  @Get('catalog')
  @Header('Cache-Control', 'private, no-store')
  async catalog(@Req() request: AuthenticatedRequest) {
    const context = await this.context(request);
    return {
      version: AGENT_CATALOG_VERSION,
      contextId: context.contextId,
      sources: context.sources.map((id) => ({ id, ...AGENT_SOURCES[id] })),
      rules: [
        'Only nora_agent sources are queryable.',
        'Money is Decimal text: keep currencies separate.',
        'Amounts are before refunds, payments exclude cross-contract allocations; accounting receivables/outstanding and refund-adjusted net sales are unavailable.',
        'Scope is enforced independently of SQL. Times are UTC; interpret calendar days in Asia/Tehran.',
      ],
    };
  }

  @Post('query')
  @Header('Cache-Control', 'private, no-store')
  async query(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('INVALID_QUERY');
    const value = body as Record<string, unknown>;
    if (
      Object.keys(value).some((key) => !['sql', 'contextId'].includes(key)) ||
      typeof value.sql !== 'string' ||
      typeof value.contextId !== 'string'
    )
      throw new BadRequestException('INVALID_QUERY');
    const context = await this.context(request);
    if (context.contextId !== value.contextId)
      throw new ForbiddenException('AGENT_CONTEXT_CHANGED');
    let result;
    try {
      result = await this.queries.query(
        value.sql,
        context.scope,
        context.sources,
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === '57014') throw new BadRequestException('QUERY_TIMEOUT');
      if ((error as Error).message?.startsWith('AGENT_DATABASE'))
        throw new ServiceUnavailableException('AGENT_DATABASE_UNAVAILABLE');
      if (
        code === '42P01' ||
        (code && !code.startsWith('22') && !code.startsWith('42')) ||
        /connection|query read timeout/i.test((error as Error).message ?? '')
      )
        throw new ServiceUnavailableException('AGENT_SOURCE_UNAVAILABLE');
      throw new BadRequestException('QUERY_REJECTED');
    }
    const release = await this.context(request);
    if (release.contextId !== context.contextId)
      throw new ForbiddenException('AGENT_CONTEXT_CHANGED');
    return { ...result, contextId: context.contextId };
  }
}
