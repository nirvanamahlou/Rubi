import { createHash } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsISO8601, IsString, Length, Matches } from 'class-validator';
import { IamService } from '../iam/iam.service';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { CustomerAffairsService } from './customer-affairs.service';
import { CustomerAffairsRepository } from './customer-affairs.repository';

/** Minimal inbound payload: websites cannot assign staff, raise priority or link arbitrary records. */
export class SiteTicketDto {
  @Matches(/^[A-Za-z0-9_.:-]{1,160}$/) externalId!: string;
  @IsString() @Length(3, 200) subject!: string;
  @IsString() @Length(3, 2000) description!: string;
  @IsISO8601({ strict: true }) occurredAt!: string;
}

@Injectable()
export class CustomerAffairsSiteGuard implements CanActivate {
  constructor(
    @Inject(IamService) private readonly iam: IamService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const code = request.params.site;
    if (typeof code !== 'string' || !['jahanbastan', 'nystkt'].includes(code))
      throw new NotFoundException();
    let bindings: Record<string, { userId?: string; branchId?: string }>;
    try {
      bindings = JSON.parse(
        this.config.get<string>('CUSTOMER_AFFAIRS_SITE_BINDINGS') ?? '{}',
      );
    } catch {
      throw new UnauthorizedException('اتصال سایت فعال نیست.');
    }
    const binding = bindings?.[code];
    if (!binding?.userId || !binding.branchId)
      throw new UnauthorizedException('اتصال سایت فعال نیست.');
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ') || authorization.length > 8192)
      throw new UnauthorizedException();
    const actor = await this.iam.authenticate(authorization.slice(7));
    if (
      actor.userId !== binding.userId ||
      !actor.branchIds.includes(binding.branchId)
    )
      throw new UnauthorizedException();
    this.iam.assertPermissions(actor, [
      request.method === 'POST'
        ? 'customer_affairs.ticket.create'
        : 'customer_affairs.ticket.read',
    ]);
    request.actor = { ...actor, branchIds: [binding.branchId] };
    return true;
  }
}

@Controller('customer-affairs/sites/:site/tickets')
@UseGuards(CustomerAffairsSiteGuard)
export class CustomerAffairsSiteController {
  constructor(
    @Inject(CustomerAffairsService)
    private readonly affairs: CustomerAffairsService,
    @Inject(CustomerAffairsRepository)
    private readonly repository: CustomerAffairsRepository,
  ) {}
  @Post()
  async create(
    @Param('site') code: string,
    @Body() input: SiteTicketDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const site = await this.repository.findSite(code);
    if (!site) throw new NotFoundException();
    const key =
      'site:' +
      createHash('sha256')
        .update(`${site.id}:${input.externalId}`)
        .digest('hex');
    const result = await this.affairs.createTicket(
      {
        subject: input.subject,
        description: input.description,
        channel: 'WEBSITE',
        category: 'OTHER',
        contactOccurredAt: input.occurredAt,
        priority: 'NORMAL',
        impact: 'LOW',
        urgency: 'LOW',
        nextAction: 'بررسی درخواست دریافتی از سایت',
        nextActionAt: new Date(
          new Date(input.occurredAt).getTime() + 4 * 60 * 60 * 1000,
        ).toISOString(),
      },
      req.actor,
      req.actor.branchIds[0],
      key,
      undefined,
      { siteId: site.id, externalId: input.externalId },
    );
    return { data: this.publicStatus(result.data) };
  }
  @Get(':externalId')
  @Header('Cache-Control', 'private, no-store')
  async status(
    @Param('site') code: string,
    @Param('externalId') externalId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(externalId))
      throw new NotFoundException();
    const site = await this.repository.findSite(code);
    if (!site) throw new NotFoundException();
    const origin = await this.repository.findSiteTicket(site.id, externalId);
    if (!origin) throw new NotFoundException();
    const result = await this.affairs.getTicket(origin.ticketId, req.actor);
    return { data: this.publicStatus(result.data) };
  }
  private publicStatus(ticket: {
    trackingNumber: string;
    status: string;
    updatedAt: string;
  }) {
    return {
      trackingNumber: ticket.trackingNumber,
      status: ticket.status,
      updatedAt: ticket.updatedAt,
    };
  }
}
