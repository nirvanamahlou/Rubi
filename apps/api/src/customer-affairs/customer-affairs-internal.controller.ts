import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { CustomerAffairsRepository } from './customer-affairs.repository';
import { CustomerAffairsService } from './customer-affairs.service';
// DTO must remain a runtime import for Nest validation.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReferralResponseDto } from './customer-affairs.dto';

const modulePermissions: Record<string, string[]> = {
  sales: [
    'sales.contracts.read.all',
    'sales.contracts.read.branch',
    'sales.contracts.read.own',
  ],
  reservations: ['reservations.read'],
  finance: ['finance.read'],
  documents: ['documents.list'],
};

@Controller('customer-affairs/internal/:module/referrals')
@UseGuards(AuthGuard, PermissionGuard)
export class CustomerAffairsInternalController {
  constructor(
    @Inject(CustomerAffairsRepository)
    private readonly repository: CustomerAffairsRepository,
    @Inject(CustomerAffairsService)
    private readonly affairs: CustomerAffairsService,
  ) {}
  private assertModule(module: string, req: AuthenticatedRequest) {
    const allowed = modulePermissions[module];
    if (!Array.isArray(allowed)) throw new NotFoundException();
    if (
      !allowed.some((permission) =>
        new Set<string>(req.actor.permissions).has(permission),
      )
    )
      throw new ForbiddenException();
  }
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.ticket.read')
  async list(
    @Param('module') module: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.assertModule(module, req);
    const rows = await this.repository.workbenchReferrals(
      req.actor.userId,
      req.actor.branchIds,
      module,
    );
    return {
      data: rows.map((row) => ({
        id: row.id,
        ticketId: row.ticketId,
        trackingNumber: row.ticket.trackingNumber,
        title: row.title,
        description: row.description,
        status: row.status,
        dueAt: row.dueAt.toISOString(),
      })),
      meta: { limit: 100 },
    };
  }
  @Patch(':id')
  @RequirePermissions('customer_affairs.ticket.update')
  async respond(
    @Param('module') module: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ReferralResponseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.assertModule(module, req);
    const row = await this.repository.findReferral(id);
    if (
      !row ||
      row.destinationModule !== module ||
      !req.actor.branchIds.includes(row.ticket.branchId)
    )
      throw new NotFoundException();
    await this.affairs.respondReferral(id, input, req.actor);
    return { data: { id, status: input.status } };
  }
}
