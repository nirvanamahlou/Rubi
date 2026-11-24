import {
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { WebsiteAgencyDirectory } from '../master-data/website-agency-directory';

@Controller('sales/site-commerce/v1/:site/agency-terms')
@UseGuards(AuthGuard)
export class WebsiteAgencyTermsController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(WebsiteAgencyDirectory)
    private readonly agencies: WebsiteAgencyDirectory,
  ) {}

  @Get(':account')
  @Header('Cache-Control', 'private, no-store')
  async terms(
    @Param('site') site: string,
    @Param('account') account: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const binding = await this.agencies.activeWebsiteAccount(
      site,
      account,
      request.actor,
    );
    if (!binding) throw new NotFoundException();
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const now = new Date(day + 'T00:00:00.000Z');
    const profile = await this.db.client.agencyOperationalProfile.findFirst({
      where: {
        organizationId: binding.organizationId,
        branchId: binding.branchId,
        role: 'AGENCY',
        status: 'ACTIVE',
        isActive: true,
        organization: { isActive: true },
      },
      select: {
        agreements: {
          where: {
            isActive: true,
            status: 'ACTIVE',
            startsAt: { lte: now },
            OR: [{ endsAt: null }, { endsAt: { gte: now } }],
            activeRevision: { status: 'APPROVED' },
          },
          select: { code: true, title: true, startsAt: true, endsAt: true },
          orderBy: { startsAt: 'desc' },
          take: 25,
        },
        agreedRates: {
          where: {
            isActive: true,
            validFrom: { lte: now },
            OR: [{ validTo: null }, { validTo: { gte: now } }],
          },
          select: {
            code: true,
            title: true,
            kind: true,
            value: true,
            currencyCode: true,
            validTo: true,
          },
          orderBy: { validFrom: 'desc' },
          take: 100,
        },
      },
    });
    if (!profile) throw new NotFoundException();
    return {
      data: {
        agreements: profile.agreements.map((row) => ({
          ...row,
          startsAt: row.startsAt.toISOString().slice(0, 10),
          endsAt: row.endsAt?.toISOString().slice(0, 10) ?? null,
        })),
        rates: profile.agreedRates.map((row) => ({
          ...row,
          value: row.value.toString(),
          validTo: row.validTo?.toISOString().slice(0, 10) ?? null,
        })),
      },
    };
  }
}
