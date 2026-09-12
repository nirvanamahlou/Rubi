import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type {
  CustomerAffairsLeadInput,
  CustomerAffairsTicketInput,
  CustomerAffairsTimelineInput,
} from '@rubi/contracts';

import { AuthGuard } from '../iam/auth.guard';
import { Public, RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
// Runtime imports are required for Nest validation metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CorrectiveActionDto,
  HandoffDto,
  HandoffResponseDto,
  LeadMutationDto,
  LeadTransitionDto,
  ListQueryDto,
  QualificationDto,
  ReferralDto,
  ReferralResponseDto,
  SatisfactionDto,
  TicketActionDto,
  TicketMutationDto,
  TicketTransitionDto,
  TimelineDto,
} from './customer-affairs.dto';
import { CustomerAffairsService } from './customer-affairs.service';

@ApiTags('Customer Affairs')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('customer-affairs')
export class CustomerAffairsController {
  constructor(
    @Inject(CustomerAffairsService)
    private readonly service: CustomerAffairsService,
  ) {}

  @Get('dashboard')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(
    'customer_affairs.lead.read',
    'customer_affairs.ticket.read',
  )
  dashboard(@Req() req: AuthenticatedRequest) {
    return this.service.dashboard(req.actor);
  }

  @Get('reports/summary')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.export')
  report(@Req() req: AuthenticatedRequest) {
    return this.service.report(req.actor);
  }

  @Get('leads/:id/audit')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.audit.read')
  leadAudit(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.audit('LEAD', id, req.actor);
  }

  @Get('tickets/:id/audit')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.audit.read')
  ticketAudit(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.audit('TICKET', id, req.actor);
  }

  @Get('leads')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.lead.read')
  leads(@Query() query: ListQueryDto, @Req() req: AuthenticatedRequest) {
    return this.service.listLeads(query, req.actor);
  }

  @Get('leads/:id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.lead.read')
  lead(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.getLead(id, req.actor);
  }

  @Post('leads')
  @RequirePermissions('customer_affairs.lead.create')
  createLead(
    @Body() dto: LeadMutationDto,
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('idempotency-key') key?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.createLead(
      dto as CustomerAffairsLeadInput,
      req.actor,
      branchId,
      key,
      traceId,
    );
  }

  @Patch('leads/:id')
  @RequirePermissions('customer_affairs.lead.update')
  updateLead(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LeadMutationDto,
    @Req() req: AuthenticatedRequest,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.updateLead(
      id,
      dto as CustomerAffairsLeadInput,
      req.actor,
      traceId,
    );
  }

  @Post('leads/:id/timeline')
  @RequirePermissions('customer_affairs.lead.update')
  leadTimeline(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TimelineDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.addLeadTimeline(
      id,
      dto as CustomerAffairsTimelineInput,
      req.actor,
    );
  }

  @Post('leads/:id/qualification')
  @RequirePermissions('customer_affairs.lead.qualify')
  qualify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: QualificationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.qualify(id, dto, req.actor);
  }

  @Post('leads/:id/transition')
  @RequirePermissions('customer_affairs.lead.update')
  transitionLead(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LeadTransitionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.transitionLead(id, dto, req.actor);
  }

  @Post('leads/:id/handoffs')
  @RequirePermissions('customer_affairs.lead.handoff.propose')
  handoff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HandoffDto,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.proposeHandoff(id, dto.expectedVersion, req.actor, key);
  }

  @Post('handoffs/:id/respond')
  @RequirePermissions('customer_affairs.lead.handoff.respond')
  respondHandoff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HandoffResponseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.respondHandoff(id, dto, req.actor);
  }

  @Get('tickets')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.ticket.read')
  tickets(@Query() query: ListQueryDto, @Req() req: AuthenticatedRequest) {
    return this.service.listTickets(query, req.actor);
  }

  @Get('tickets/:id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.ticket.read')
  ticket(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.getTicket(id, req.actor);
  }

  @Post('tickets')
  @RequirePermissions('customer_affairs.ticket.create')
  createTicket(
    @Body() dto: TicketMutationDto,
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('idempotency-key') key?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.createTicket(
      dto as CustomerAffairsTicketInput,
      req.actor,
      branchId,
      key,
      traceId,
    );
  }

  @Patch('tickets/:id')
  @RequirePermissions('customer_affairs.ticket.update')
  updateTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TicketMutationDto,
    @Req() req: AuthenticatedRequest,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.updateTicket(
      id,
      dto as CustomerAffairsTicketInput,
      req.actor,
      traceId,
    );
  }

  @Post('tickets/:id/timeline')
  @RequirePermissions('customer_affairs.ticket.update')
  ticketTimeline(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TimelineDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.addTicketTimeline(
      id,
      dto as CustomerAffairsTimelineInput,
      req.actor,
    );
  }

  @Post('tickets/:id/transition')
  @RequirePermissions('customer_affairs.ticket.update')
  transitionTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TicketTransitionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.transitionTicket(id, dto, req.actor);
  }

  @Post('tickets/:id/referrals')
  @RequirePermissions('customer_affairs.ticket.assign')
  referral(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReferralDto,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.createReferral(id, dto, req.actor, key);
  }

  @Patch('referrals/:id')
  @RequirePermissions('customer_affairs.ticket.update')
  respondReferral(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReferralResponseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.respondReferral(id, dto, req.actor);
  }

  @Get('workbench/referrals')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.ticket.read')
  workbench(@Req() req: AuthenticatedRequest) {
    return this.service.workbench(req.actor);
  }

  @Post('tickets/:id/escalate')
  @RequirePermissions('customer_affairs.ticket.escalate')
  escalate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TicketActionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.ticketAction(id, 'ESCALATE', dto, req.actor);
  }

  @Post('tickets/:id/resolve')
  @RequirePermissions('customer_affairs.ticket.close')
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TicketActionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.ticketAction(id, 'RESOLVE', dto, req.actor);
  }

  @Post('tickets/:id/close')
  @RequirePermissions('customer_affairs.ticket.close')
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TicketActionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.ticketAction(id, 'CLOSE', dto, req.actor);
  }

  @Post('tickets/:id/reopen')
  @RequirePermissions('customer_affairs.ticket.reopen')
  reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TicketActionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.ticketAction(id, 'REOPEN', dto, req.actor);
  }

  @Post('tickets/:id/satisfaction-invitations')
  @RequirePermissions('customer_affairs.satisfaction.record')
  satisfactionInvitation(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createSatisfactionInvitation(id, req.actor);
  }

  @Patch('corrective-actions/:id')
  @RequirePermissions('customer_affairs.corrective_action.manage')
  correctiveAction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CorrectiveActionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateCorrectiveAction(id, dto, req.actor);
  }
}

@ApiTags('Customer Affairs / Public')
@Controller('customer-affairs/public')
export class CustomerAffairsPublicController {
  constructor(
    @Inject(CustomerAffairsService)
    private readonly service: CustomerAffairsService,
  ) {}

  @Public()
  @Post('satisfaction/:token')
  satisfaction(@Param('token') token: string, @Body() dto: SatisfactionDto) {
    return this.service.submitSatisfaction(token, dto);
  }
}
